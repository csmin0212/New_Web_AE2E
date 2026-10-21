import { describe, expect, it } from "vitest";
import { computeStage, splitTitle } from "./stage";
import type { ChatMessage, Speaker } from "./types";

let n = 0;
function msg(speaker: Partial<Speaker> & { name: string }, kind: ChatMessage["kind"] = "say", extra: Partial<ChatMessage> = {}): ChatMessage {
  n++;
  return { id: `m${n}`, ts: n, uid: "u", speaker: { uid: "u", ...speaker }, kind, text: `대사${n}`, ...extra };
}

const elin = { name: "엘린", charId: "c1", image: "/elin.png" };
const yuz = { name: "유즈", charId: "c2", image: "/yuz.png" };
const gm = { name: "GM", narrator: true };
const npc = { name: "[제 3왕녀] 앤드리아", image: "/andria.png" };

describe("computeStage", () => {
  it("그림이 있는 화자가 자동으로 무대에 오르고, 마지막 화자가 말한다", () => {
    const v = computeStage([msg(elin), msg(yuz), msg(elin)], {}, true);
    expect(v.actors.map((a) => a.name)).toEqual(["엘린", "유즈"]);
    expect(v.actors.map((a) => a.left)).toEqual([32, 68]);
    expect(v.speakingKey).toBe("char:c1");
    expect(v.line).toMatchObject({ kind: "bubble", actorKey: "char:c1" });
  });

  it("귓속말·비밀 굴림·잡담은 무대에 영향을 주지 않는다", () => {
    const v = computeStage([msg(elin), msg(yuz, "say", { to: [{ uid: "x", name: "GM" }] }), msg(yuz, "ooc")], {}, true);
    expect(v.actors.map((a) => a.name)).toEqual(["엘린"]);
    expect(v.speakingKey).toBe("char:c1");
  });

  it("GM 서술과 @행동은 아래 띠 지문이 된다", () => {
    expect(computeStage([msg(elin), msg(gm)], {}, true).line?.kind).toBe("narration");
    const act = computeStage([msg(elin, "action")], {}, true);
    expect(act.line?.kind).toBe("narration");
    expect(act.actors).toHaveLength(1);
  });

  it("고정 출연진이 먼저 서고, 자동 출연은 최대 4명", () => {
    const cast = { k1: { name: npc.name, image: npc.image, slot: 0 } };
    const others = ["a", "b", "c", "d", "e"].map((x) => msg({ name: x, image: `/${x}.png` }));
    const v = computeStage(others, cast, true);
    expect(v.actors[0]).toMatchObject({ name: npc.name, pinned: true });
    expect(v.actors).toHaveLength(5);
    expect(v.actors.slice(1).map((a) => a.name)).toEqual(["b", "c", "d", "e"]);
  });

  it("자동 출연을 끄면 고정 출연진만", () => {
    const v = computeStage([msg(elin), msg(yuz)], {}, false);
    expect(v.actors).toHaveLength(0);
    expect(v.line).toMatchObject({ kind: "bubble", actorKey: null });
  });
});

describe("splitTitle", () => {
  it("[칭호] 이름을 나눈다", () => {
    expect(splitTitle("[제 3왕녀] 앤드리아 그랑펠덴")).toEqual({ title: "제 3왕녀", name: "앤드리아 그랑펠덴" });
    expect(splitTitle("엘린")).toEqual({ title: null, name: "엘린" });
  });
});
