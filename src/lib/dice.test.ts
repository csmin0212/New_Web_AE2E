import { describe, expect, it } from "vitest";
import { judgeCheck, parseExpr, roll } from "./dice";

// 지정한 눈이 순서대로 나오는 가짜 RNG
function fixed(...faces: number[]) {
  let i = 0;
  return () => (faces[i++ % faces.length] - 1) / 6 + 0.0001;
}

describe("parseExpr", () => {
  it("아리안로드 D 표기와 일반 표기를 읽는다", () => {
    expect(parseExpr("2D+5")).toEqual([
      { kind: "dice", sign: 1, count: 2, sides: 6 },
      { kind: "flat", sign: 1, value: 5 },
    ]);
    expect(parseExpr("1d100 - 3")).toEqual([
      { kind: "dice", sign: 1, count: 1, sides: 100 },
      { kind: "flat", sign: -1, value: 3 },
    ]);
    expect(parseExpr("6d6+13")[0]).toEqual({ kind: "dice", sign: 1, count: 6, sides: 6 });
  });

  it("잘못된 식은 거절한다", () => {
    expect(() => parseExpr("2D+abc")).toThrow();
    expect(() => parseExpr("")).toThrow();
    expect(() => parseExpr("2D+")).toThrow();
    expect(() => parseExpr("999D")).toThrow();
  });
});

describe("roll", () => {
  it("합계를 계산한다", () => {
    const r = roll("2D+5", { rng: fixed(3, 4) });
    expect(r.total).toBe(12);
    expect(r.groups[0].results).toEqual([3, 4]);
    expect(r.expr).toBe("2D+5");
  });

  it("페이트만큼 판정 주사위가 늘어난다", () => {
    const r = roll("2D+5", { check: true, fate: 2, rng: fixed(1, 2, 3, 4) });
    expect(r.expr).toBe("4D+5");
    expect(r.groups[0].results).toHaveLength(4);
    expect(r.fateUsed).toBe(2);
    expect(r.total).toBe(15);
  });
});

describe("judgeCheck", () => {
  const g = (...results: number[]) => [{ sides: 6, sign: 1 as const, results }];
  it("6이 2개 이상이면 크리티컬", () => {
    expect(judgeCheck(g(6, 6)).critical).toBe(true);
    expect(judgeCheck(g(6, 3, 6)).sixes).toBe(2);
    expect(judgeCheck(g(6, 5)).critical).toBe(false);
  });
  it("전부 1이면 펌블", () => {
    expect(judgeCheck(g(1, 1)).fumble).toBe(true);
    expect(judgeCheck(g(1, 1, 2)).fumble).toBe(false);
  });
});
