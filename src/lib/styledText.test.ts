import { describe, expect, it } from "vitest";
import { parseStyledText, sanitizeStyle } from "./styledText";

describe("스킬 설명 꾸밈 글씨", () => {
  it("Roll20 꾸미기 — 따옴표가 빠진 변형까지", () => {
    const t =
      '[파워](" style="text-decoration:none; color:black; font-size:12px; font-weight:bold; display:block; text-align:center; margin: 0px 0px 5px 0px;)' +
      "[《최후의 요새》](#\" style=\"color:#c0392b; font-weight:bold\")";
    const p = parseStyledText(t);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ kind: "styled", text: "파워", block: true, style: { fontSize: "12px", fontWeight: "bold", textAlign: "center" } });
    expect(p[0].kind === "styled" && p[0].style.color).toBeUndefined(); // 검정은 테마색으로
    expect(p[1]).toMatchObject({ kind: "styled", text: "《최후의 요새》", style: { color: "#c0392b" } });
  });

  it("굵게·기울임·일반 글자", () => {
    expect(parseStyledText("*사용 조건: 장면 1회* 그리고 **강조**")).toEqual([
      { kind: "italic", text: "사용 조건: 장면 1회" },
      { kind: "text", text: " 그리고 " },
      { kind: "bold", text: "강조" },
    ]);
  });

  it("위험한 CSS 는 버린다", () => {
    const s = sanitizeStyle("color:red; background:url(http://x); position:fixed; font-size:200px; display:flex");
    expect(s.style).toEqual({ color: "red", fontSize: "40px" });
  });

  it("rgb() 처럼 괄호가 든 값도 읽는다", () => {
    const p = parseStyledText('[불꽃](#" style="color:rgb(255, 80, 0); text-shadow: 0 0 4px rgb(255,0,0)")');
    expect(p[0]).toMatchObject({ kind: "styled", text: "불꽃", style: { color: "rgb(255, 80, 0)" } });
  });
});
