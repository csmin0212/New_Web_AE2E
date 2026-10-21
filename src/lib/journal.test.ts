import { describe, expect, it } from "vitest";
import { parseBody, splitBold } from "./journal";

describe("저널 본문", () => {
  it("제목·목록·문단·구분선", () => {
    expect(parseBody("# 사명\n왕녀를 지켜라.\n둘째 줄\n\n- 단서 하나\n- 단서 둘\n---\n> 인용")).toEqual([
      { kind: "h1", text: "사명" },
      { kind: "p", text: "왕녀를 지켜라.\n둘째 줄" },
      { kind: "li", text: "단서 하나" },
      { kind: "li", text: "단서 둘" },
      { kind: "hr", text: "" },
      { kind: "quote", text: "인용" },
    ]);
  });
  it("굵게", () => {
    expect(splitBold("그는 **배신자**다")).toEqual([
      { text: "그는 ", bold: false },
      { text: "배신자", bold: true },
      { text: "다", bold: false },
    ]);
  });
});
