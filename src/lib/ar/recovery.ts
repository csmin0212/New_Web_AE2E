import type { InlineResult, Segment } from "../inline";

// 아이템 설명 "MP를 [[4d6+16]]만큼 회복" → 굴린 값을 MP 에 더한다
export function findRecovery(body: Segment[]): { key: "hp" | "mp"; amount: number } | null {
  for (let i = 0; i < body.length - 1; i++) {
    const before = body[i];
    const val = body[i + 1];
    const after = body[i + 2];
    if (typeof before !== "string" || typeof val === "string") continue;
    const m = before.match(/(HP|MP)\s*를?\s*$/i);
    if (m && typeof after === "string" && /^\s*(점\s*)?(만큼\s*)?회복/.test(after)) {
      return { key: m[1].toLowerCase() as "hp" | "mp", amount: (val as InlineResult).total };
    }
  }
  return null;
}
