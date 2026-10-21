import { fetchCharacterSheet, SheetError } from "@/lib/sheet/fetch";
import { extractSheetId } from "@/lib/sheet/parse";
import { verifyIdToken } from "@/lib/verifyIdToken";

// POST /api/sheet  { sheetId, tab }  (Authorization: Bearer <Firebase ID 토큰>)
// 구글 시트 탭 하나를 읽어 ParsedSheet 로 돌려준다. 저장은 클라이언트(GM)가 Firestore 에 한다.
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const user = await verifyIdToken(token);
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { sheetId?: string; tab?: string } | null;
  const sheetId = extractSheetId(body?.sheetId ?? "");
  const tab = (body?.tab ?? "").trim();
  if (!sheetId || !tab || tab.length > 60) {
    return Response.json({ error: "시트 ID와 탭 이름을 입력해주세요." }, { status: 400 });
  }

  // 서비스 계정이 읽을 수 있는 시트를 아무나 열람하지 못하게, 허용 목록이 있으면 그 안에서만 읽는다.
  const allowed = (process.env.ALLOWED_SHEET_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(sheetId)) {
    return Response.json({ error: "허용되지 않은 시트예요." }, { status: 403 });
  }

  try {
    const sheet = await fetchCharacterSheet(sheetId, tab);
    return Response.json({ sheet });
  } catch (e) {
    const message = e instanceof SheetError ? e.message : "시트를 불러오지 못했어요. 잠시 후 다시 시도해주세요.";
    return Response.json({ error: message }, { status: 502 });
  }
}
