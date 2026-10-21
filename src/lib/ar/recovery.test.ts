import { describe, expect, it } from "vitest";
import { rollInline } from "../inline";
import { findRecovery } from "./recovery";

const ones = () => 0;

describe("findRecovery", () => {
  it("MP를 [[4d6+16]]만큼 회복한다", () => {
    expect(findRecovery(rollInline("MP를 [[4d6+16]]만큼 회복한다.", ones))).toEqual({ key: "mp", amount: 20 });
  });
  it("HP를 [[20d6+20]]만큼 회복한다", () => {
    expect(findRecovery(rollInline("HP를 [[20d6+20]]만큼 회복한다.", ones))).toEqual({ key: "hp", amount: 40 });
  });
  it("회복이 아닌 문구는 무시", () => {
    expect(findRecovery(rollInline("메이저. 인게이지 단일 대상 전투불능 회복 [[2d6]]", ones))).toBeNull();
  });
});
