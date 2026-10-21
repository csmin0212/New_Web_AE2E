import { describe, expect, it } from "vitest";
import { evalExpr, rollInline } from "./inline";

const sixes = () => 0.99; // 모든 주사위 6
const ones = () => 0;

describe("evalExpr", () => {
  it("스킬 효과식 그대로 계산한다", () => {
    expect(evalExpr("5D6+17+2+20+2+10+8+9", ones).total).toBe(5 + 68);
    expect(evalExpr("4D6+3*22+20+2+2+10+6+9", ones).total).toBe(4 + 66 + 49);
    expect(evalExpr("22*5").total).toBe(110);
    expect(evalExpr("5*10").total).toBe(50);
    expect(evalExpr("20d6+20", sixes).total).toBe(140);
    expect(evalExpr("(2+3)*4").total).toBe(20);
  });
  it("주사위 눈을 남긴다", () => {
    const r = evalExpr("2d6+1", sixes);
    expect(r.dice).toEqual([{ sides: 6, results: [6, 6] }]);
  });
  it("잘못된 식은 오류", () => {
    expect(() => evalExpr("5D6+")).toThrow();
    expect(() => evalExpr("@{hp}")).toThrow();
  });
});

describe("rollInline", () => {
  it("[[식]] 만 굴린 결과로 바꾼다", () => {
    const seg = rollInline("MP를 [[4d6+16]]만큼 회복한다.", ones);
    expect(seg[0]).toBe("MP를 ");
    expect(seg[1]).toMatchObject({ expr: "4d6+16", total: 20 });
    expect(seg[2]).toBe("만큼 회복한다.");
  });
  it("못 읽는 식은 글자 그대로", () => {
    expect(rollInline("[[@{strength_attribute}+1]]")).toEqual(["[[@{strength_attribute}+1]]"]);
  });
});
