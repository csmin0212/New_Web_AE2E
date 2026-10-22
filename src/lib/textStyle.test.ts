import { describe, expect, it } from "vitest";
import { parseStyledText } from "./styledText";
import { styleToCss, wrapStyled } from "./textStyle";

describe("글씨 꾸미기", () => {
  it("옵션 → Roll20 꾸밈 문법, 그리고 다시 읽기", () => {
    const s = wrapStyled("화염 대미지", { bold: true, color: "#ff6a2b", glow: true });
    expect(s).toBe('[화염 대미지](#" style="color:#ff6a2b; font-weight:bold; text-shadow:0 0 6px #ff6a2b")');
    expect(parseStyledText(s)[0]).toMatchObject({ kind: "styled", text: "화염 대미지", style: { color: "#ff6a2b", fontWeight: "bold" } });
  });
  it("굵게만이면 짧게, 다시 꾸미면 겹치지 않게", () => {
    expect(wrapStyled("강조", { bold: true })).toBe("**강조**");
    expect(wrapStyled("**강조**", { italic: true })).toBe('[강조](#" style="font-style:italic")');
    expect(wrapStyled('[글자](#" style="color:red")', { center: true })).toBe('[글자](#" style="display:block; text-align:center")');
  });
  it("띠 배경은 글자를 하얗게", () => {
    expect(styleToCss({ bg: "#8c2f22" })).toContain("color:#ffffff");
  });
});
