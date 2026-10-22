import { describe, expect, it } from "vitest";
import { emptyStats, type ArSheet } from "./ar/types";
import { buildRevealDoc, REVEAL_DEFAULT, REVEAL_IDENTIFIED, REVEAL_NOTHING, sameDoc } from "./reveal";
import type { Character } from "./types";

const ar: ArSheet = {
  version: 1,
  kind: "enemy",
  profile: { name: "고블린 대장", level: 5, category: "요마" },
  stats: emptyStats(),
  combat: { hitDice: 2, hitMod: 5, dmgDice: 2, dmgMod: 8, evaDice: 2, evaMod: 3, actionMod: 9, moveMod: 0, pdefMod: 4, mdefMod: 2 },
  checks: [],
  equipment: [],
  items: [],
  skills: [
    { id: "s1", name: "강타", sl: 1, slMax: "1", timing: "메이저", target: "단일", range: "지근", cost: "-", effect: "대미지 +5" },
    { id: "s2", name: "비장의 수", sl: 1, slMax: "1", timing: "메이저", target: "단일", range: "지근", cost: "-", effect: "비밀" },
  ],
  attacks: [],
  drops: [{ range: "7-9", name: "녹슨 검", price: 50, count: 1 }],
  source: "manual",
};
const c = {
  id: "c1",
  kind: "enemy",
  ownerUid: null,
  sheet: { name: "고블린 대장" },
  ar,
  hp: { cur: 10, max: 40 },
  mp: { cur: 5, max: 10 },
  fate: { cur: 0, max: 0 },
  portrait: "/g.png",
  syncedAt: 0,
  order: 0,
} as unknown as Character;

describe("플레이어 공개 본", () => {
  it("아무것도 공개 안 하면 이름도 ???", () => {
    const d = buildRevealDoc(c, REVEAL_NOTHING);
    expect(d).toEqual({ charId: "c1", kind: "enemy", listed: false, name: "???" });
  });
  it("기본: 이름·그림·HP 상태만 — 숫자는 안 간다", () => {
    const d = buildRevealDoc(c, REVEAL_DEFAULT);
    expect(d).toMatchObject({ name: "고블린 대장", image: "/g.png", cond: "hurt" });
    expect(d.hp).toBeUndefined();
    expect(d.stats).toBeUndefined();
    expect(d.skills).toBeUndefined();
  });
  it("고른 스킬만, 막대는 비율만", () => {
    const d = buildRevealDoc(c, { ...REVEAL_DEFAULT, hp: "bar", skills: ["s1"] });
    expect(d.skills?.map((s) => s.name)).toEqual(["강타"]);
    expect(d.hpBar).toBe(25);
    expect(d.hp).toBeUndefined();
  });
  it("식별 성공이면 전부", () => {
    const d = buildRevealDoc(c, REVEAL_IDENTIFIED);
    expect(d.hp).toEqual({ cur: 10, max: 40 });
    expect(d.skills).toHaveLength(2);
    expect(d.combat?.pdef).toBe(4);
    expect(d.drops?.[0].name).toBe("녹슨 검");
    expect(d.profile?.level).toBe(5);
  });
});

describe("같은 공개 본인지", () => {
  it("칸 순서가 달라도 같다", () => {
    expect(sameDoc({ a: 1, b: { c: 2, d: [1, { e: 3, f: 4 }] } }, { b: { d: [1, { f: 4, e: 3 }], c: 2 }, a: 1 })).toBe(true);
    expect(sameDoc({ a: 1 }, { a: 2 })).toBe(false);
  });
});
