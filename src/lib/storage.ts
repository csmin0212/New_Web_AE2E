import "server-only";

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

// 그림 저장소. 운영은 Vercel Blob, 로컬 개발에서 Blob 이 안 붙어 있으면 public/local/uploads 에 저장한다.
// 같은 그림은 같은 이름(내용 해시)이 되어 두 번 올려도 한 번만 저장된다.

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/avif": "avif",
};

export class StorageError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export function blobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function saveImage(uid: string, data: Buffer, contentType: string): Promise<string> {
  const ext = EXT[contentType];
  if (!ext) throw new StorageError("그림 파일(png·jpg·webp·gif)만 올릴 수 있어요.");
  if (data.length > MAX_IMAGE_BYTES) throw new StorageError("그림이 너무 커요 (8MB까지).");

  const hash = createHash("sha256").update(data).digest("hex").slice(0, 32);
  const name = `${uid}/${hash}.${ext}`;

  if (blobConfigured()) {
    const blob = await put(`trpg-vtt/${name}`, data, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return blob.url;
  }

  if (process.env.NODE_ENV !== "production") {
    const dir = path.join(process.cwd(), "public", "local", "uploads", uid);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${hash}.${ext}`), data);
    return `/local/uploads/${name}`;
  }

  throw new StorageError("그림 저장소(Vercel Blob)가 아직 연결되지 않았어요.", 501);
}

// 주소의 그림을 가져와 내 저장소에 복사한다 (Roll20 그림 등).
// 아무 서버나 대신 불러오지 않게 알려진 그림 호스트만 허용한다.
const ALLOWED_HOSTS = [
  "files.d20.io",
  "s3.amazonaws.com",
  "i.imgur.com",
  "cdn.discordapp.com",
  "media.discordapp.net",
  "pbs.twimg.com",
];

function allowedHost(host: string): boolean {
  return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

// Roll20 그림은 thumb/med 대신 큰 판(max)을 먼저 시도한다
function candidates(raw: string): string[] {
  const out: string[] = [];
  const m = raw.match(/^(https:\/\/[^?]+\/)(thumb|med|max|original)(\.(?:png|jpe?g|gif|webp))(\?.*)?$/i);
  if (m && /d20\.io|amazonaws/.test(raw)) out.push(`${m[1]}max${m[3]}`);
  out.push(raw);
  return [...new Set(out)];
}

export async function copyImageFromUrl(uid: string, raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new StorageError("그림 주소가 올바르지 않아요.");
  }
  if (url.protocol !== "https:" || !allowedHost(url.hostname)) {
    throw new StorageError(`이 주소에서는 가져올 수 없어요: ${url.hostname}`);
  }
  for (const c of candidates(url.toString())) {
    const res = await fetch(c, { redirect: "follow", cache: "no-store" }).catch(() => null);
    if (!res || !res.ok) continue;
    if (!allowedHost(new URL(res.url).hostname)) continue;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_IMAGE_BYTES) continue;
    const data = Buffer.from(await res.arrayBuffer());
    return saveImage(uid, data, type);
  }
  throw new StorageError("그림을 받아오지 못했어요.", 502);
}
