import type { InlineResult } from "./inline";
import type { ChatMessage } from "./types";

// Realtime DB 는 빈 배열을 저장하지 않는다 → 주사위 없는 굴림([[5+3]])·빈 메타 등은 읽어 오면 칸 자체가 없다.
// 화면이 .map 하다 깨지지 않게, 받을 때 빈 배열로 채워 둔다.
function fillInline(r: unknown): unknown {
  if (!r || typeof r !== "object") return r;
  const x = r as InlineResult;
  return { ...x, dice: (x.dice ?? []).map((d) => ({ ...d, results: d.results ?? [] })) };
}

export function normalizeMessage(v: Omit<ChatMessage, "id">, id: string): ChatMessage {
  const m: ChatMessage = { ...v, id, ts: typeof v.ts === "number" ? v.ts : Date.now(), speaker: v.speaker ?? { name: "?", uid: v.uid } };
  if (m.roll) m.roll = { ...m.roll, groups: (m.roll.groups ?? []).map((g) => ({ ...g, results: g.results ?? [] })) };
  if (m.card) {
    const c = m.card;
    m.card = {
      ...c,
      meta: c.meta ?? [],
      body: (c.body ?? []).map((seg) => (typeof seg === "string" ? seg : (fillInline(seg) as InlineResult))),
      extra: c.extra ? { ...c.extra, result: fillInline(c.extra.result) as typeof c.extra.result } : undefined,
    };
  }
  return m;
}

