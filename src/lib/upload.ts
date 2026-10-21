"use client";

import type { User } from "firebase/auth";

// 브라우저 쪽 그림 올리기. 큰 그림은 올리기 전에 webp 로 줄인다 (투명 배경 유지).

export type ImageKind = "portrait" | "standing" | "token" | "background";

const MAX_SIDE: Record<ImageKind, number> = {
  portrait: 512,
  token: 400,
  standing: 2000,
  background: 2400,
};

async function shrink(file: File, maxSide: number): Promise<Blob> {
  if (file.type === "image/gif") return file; // 움직이는 그림은 그대로
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.88));
  // webp 로 못 바꾸는 브라우저거나 오히려 커지면 원본
  return out && out.size < file.size ? out : file;
}

async function post(user: User, body: BodyInit, json: boolean): Promise<string> {
  const token = await user.getIdToken();
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...(json ? { "Content-Type": "application/json" } : {}) },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "그림을 올리지 못했어요.");
  return data.url;
}

export async function uploadImage(user: User, file: File, kind: ImageKind): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("그림 파일만 올릴 수 있어요.");
  const blob = await shrink(file, MAX_SIDE[kind]);
  const form = new FormData();
  const ext = blob.type === "image/webp" ? "webp" : (file.name.split(".").pop() ?? "png");
  form.append("file", new File([blob], `image.${ext}`, { type: blob.type || file.type }));
  return post(user, form, false);
}

// 이미 다른 곳에 있는 그림(Roll20 등)을 내 저장소로 복사
export async function copyImage(user: User, url: string): Promise<string> {
  return post(user, JSON.stringify({ url }), true);
}

// 이미 내 저장소에 있는 주소인지
export function isOwnImage(url: string): boolean {
  return url.startsWith("/local/") || url.includes(".blob.vercel-storage.com/");
}
