import { describe, expect, it } from "vitest";
import { normalizeMessage } from "./chatNormalize";

describe("채팅 메시지 채우기", () => {
  it("Realtime DB 가 지운 빈 배열을 되살린다", () => {
    const m = normalizeMessage(
      {
        ts: 1,
        uid: "u",
        speaker: { name: "A", uid: "u" },
        kind: "card",
        text: "",
        // 주사위 없는 [[5+3]] — dice 칸이 통째로 없다. meta 도 비어서 없다
        card: { title: "스킬", tag: "skill", body: ["피해 ", { expr: "5+3", total: 8 } as never] } as never,
      },
      "m1",
    );
    expect(m.card!.meta).toEqual([]);
    expect(m.card!.body[1]).toEqual({ expr: "5+3", total: 8, dice: [] });
    const r = normalizeMessage({ ts: 1, uid: "u", speaker: { name: "A", uid: "u" }, kind: "roll", text: "", roll: { expr: "5", flat: 5, total: 5 } as never }, "m2");
    expect(r.roll!.groups).toEqual([]);
  });
});
