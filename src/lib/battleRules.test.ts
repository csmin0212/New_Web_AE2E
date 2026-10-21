import { describe, expect, it } from "vitest";
import { computeEffect, conditionOf, endTurn, giveTurn, initiativeOrder, parseCost, startBattle } from "./battleRules";

const units = [
  { id: "gob", init: 8, side: "enemy" as const, name: "고블린" },
  { id: "elin", init: 8, side: "pc" as const, name: "엘린" },
  { id: "rex", init: 12, side: "pc" as const, name: "렉스" },
];

describe("행동 순서", () => {
  it("행동치 높은 순, 같으면 PC 먼저", () => {
    expect(initiativeOrder(units).map((u) => u.id)).toEqual(["rex", "elin", "gob"]);
  });

  it("차례를 끝내면 다음 유닛, 다 끝나면 다음 라운드", () => {
    const order = initiativeOrder(units);
    let t = startBattle(order);
    expect(t).toEqual({ actor: "rex", round: 1, acted: {} });
    t = endTurn(order, t);
    expect(t.actor).toBe("elin");
    t = endTurn(order, t);
    expect(t.actor).toBe("gob");
    t = endTurn(order, t);
    expect(t).toEqual({ actor: "rex", round: 2, acted: {} });
  });

  it("GM이 차례를 건네면 행동한 유닛도 다시 움직일 수 있다", () => {
    const order = initiativeOrder(units);
    let t = endTurn(order, startBattle(order)); // rex 행동 끝
    t = giveTurn(t, "rex");
    expect(t.actor).toBe("rex");
    t = endTurn(order, t);
    expect(t.actor).toBe("elin");
  });
});

describe("대미지·회복", () => {
  const g = { hp: { cur: 30, max: 40 }, mp: { cur: 5, max: 20 } };
  const def = { pdef: 7, mdef: 3 };
  it("물리·마법은 방어로 줄고 관통은 그대로", () => {
    expect(computeEffect(g, def, { kind: "damage", amount: 20, dmgType: "physical" })).toMatchObject({ after: 17, reduced: 7, dealt: 13 });
    expect(computeEffect(g, def, { kind: "damage", amount: 20, dmgType: "magic" })).toMatchObject({ after: 13, reduced: 3 });
    expect(computeEffect(g, def, { kind: "damage", amount: 20, dmgType: "pierce" })).toMatchObject({ after: 10, reduced: 0 });
    expect(computeEffect(g, def, { kind: "damage", amount: 5, dmgType: "physical" })).toMatchObject({ after: 30, reduced: 5, dealt: 0 });
    expect(computeEffect(g, def, { kind: "damage", amount: 99, dmgType: "pierce" }).after).toBe(0);
  });
  it("회복은 최대치까지", () => {
    expect(computeEffect(g, def, { kind: "heal", amount: 50 })).toMatchObject({ key: "hp", after: 40, dealt: 10 });
    expect(computeEffect(g, def, { kind: "mp-heal", amount: 3 })).toMatchObject({ key: "mp", after: 8 });
    expect(computeEffect(g, def, { kind: "mp-loss", amount: 9 })).toMatchObject({ key: "mp", after: 0, dealt: 5 });
  });
  it("에너미 상태는 숫자 없이", () => {
    expect(conditionOf({ cur: 30, max: 40 })).toBeNull();
    expect(conditionOf({ cur: 20, max: 40 })).toBe("hurt");
    expect(conditionOf({ cur: 0, max: 40 })).toBe("down");
  });
});

describe("코스트", () => {
  it("숫자만 있으면 MP, HP 표기도 읽는다", () => {
    expect(parseCost("6")).toEqual({ mp: 6, hp: 0 });
    expect(parseCost("MP 4")).toEqual({ mp: 4, hp: 0 });
    expect(parseCost("HP5")).toEqual({ mp: 0, hp: 5 });
    expect(parseCost("MP3+HP2")).toEqual({ mp: 3, hp: 2 });
    expect(parseCost("-")).toBeNull();
    expect(parseCost("특수")).toBeNull();
  });
});

describe("배드 스테이터스", () => {
  it("클린업에 멍함·격앙·넉백이 풀리고 독은 강도×5", async () => {
    const { cleanup, effectiveInit } = await import("./battleRules");
    expect(cleanup({ daze: 1, rage: 1, knockback: 2, poison: 3, awe: 1 })).toEqual({ next: { poison: 3, awe: 1 }, poison: 15 });
    expect(effectiveInit(12, { knockback: 2 })).toBe(2);
    expect(effectiveInit(12)).toBe(12);
  });
});
