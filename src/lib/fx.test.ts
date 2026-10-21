import { describe, expect, it } from "vitest";
import { findKeywordCutin, type CutinPreset } from "./fx";

const c = (name: string, keyword?: string): CutinPreset => ({ name, style: "band", ms: 2000, keyword });

describe("findKeywordCutin", () => {
  it("대사에 키워드가 들어 있으면 그 컷인", () => {
    const cutins = { a: c("총공격", "총공격이다!"), b: c("크리티컬") };
    expect(findKeywordCutin("좋아, 총공격이다! 가자", cutins)).toBe("a");
    expect(findKeywordCutin("평범한 대사", cutins)).toBeNull();
  });
  it("키워드가 비어 있으면 무시", () => {
    expect(findKeywordCutin("아무 말", { a: c("x", "  ") })).toBeNull();
  });
});
