import { copyImageFromUrl, MAX_IMAGE_BYTES, saveImage, StorageError } from "@/lib/storage";
import { verifyIdToken } from "@/lib/verifyIdToken";

// POST /api/upload  (Authorization: Bearer <Firebase ID 토큰>)
//   multipart/form-data { file }   → 그림 파일을 올린다 (브라우저에서 미리 webp 로 줄여서 보냄)
//   application/json    { url }    → 그 주소의 그림을 내 저장소로 복사한다 (Roll20 그림 등)
// 응답: { url }
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const user = await verifyIdToken(token);
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.startsWith("application/json")) {
      const body = (await request.json().catch(() => null)) as { url?: string } | null;
      if (!body?.url) return Response.json({ error: "그림 주소가 필요해요." }, { status: 400 });
      return Response.json({ url: await copyImageFromUrl(user.uid, body.url) });
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return Response.json({ error: "그림 파일이 필요해요." }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return Response.json({ error: "그림이 너무 커요 (8MB까지)." }, { status: 413 });
    const url = await saveImage(user.uid, Buffer.from(await file.arrayBuffer()), file.type);
    return Response.json({ url });
  } catch (e) {
    if (e instanceof StorageError) return Response.json({ error: e.message }, { status: e.status });
    console.error("upload failed", e);
    return Response.json({ error: "그림을 저장하지 못했어요." }, { status: 500 });
  }
}
