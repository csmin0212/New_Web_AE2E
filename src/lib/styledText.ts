// 스킬 설명 꾸밈 글씨 — Roll20 에서 쓰던 방식을 그대로 읽는다 (순수 함수 · 테스트 대상)
//   [글자](#" style="color:red; font-weight:bold")    ← Roll20 롤 템플릿 꾸미기
//   [글자](" style="color:red; …)                      ← 따옴표가 빠진 변형도
//   **굵게**   *기울임*
// 위험한 CSS(그림·위치·스크립트)는 버리고, 글자 꾸밈에 쓰는 속성만 남긴다.

export type StyledPiece =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "styled"; text: string; style: Record<string, string>; block: boolean };

const STYLED = /\[([^\]\n]*)\]\(#?"\s*style="((?:[^"()]|\([^()]*\))*)"?\s*\)/g;

const ALLOWED = new Set([
  "color",
  "background",
  "background-color",
  "font-size",
  "font-weight",
  "font-style",
  "text-align",
  "text-decoration",
  "text-shadow",
  "display",
  "line-height",
  "padding",
  "margin",
  "border",
  "border-radius",
  "border-bottom",
  "border-top",
  "letter-spacing",
]);

const BLACKISH = /^(black|#000|#000000|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))$/i;
const WHITISH = /^(white|#fff|#ffffff|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))$/i;

// "color:red; font-size:12px" → { color: "red", fontSize: "12px" } (허용된 것만)
export function sanitizeStyle(css: string): { style: Record<string, string>; block: boolean } {
  const style: Record<string, string> = {};
  for (const part of css.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const prop = part.slice(0, i).trim().toLowerCase();
    let value = part.slice(i + 1).trim();
    if (!ALLOWED.has(prop) || !value) continue;
    if (/url\(|expression|javascript:|@import|var\(/i.test(value)) continue;
    if (prop === "display" && !/^(block|inline|inline-block)$/.test(value)) continue;
    if (prop === "font-size") {
      const px = parseFloat(value);
      if (!Number.isFinite(px)) continue;
      value = `${Math.min(40, Math.max(8, px))}px`;
    }
    if ((prop === "padding" || prop === "margin") && /\d{3,}/.test(value)) continue; // 화면을 밀어내는 큰 값은 무시
    const key = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    style[key] = value;
  }
  // 검정·흰 글씨는 테마에 따라 안 보일 수 있다 → 배경을 따로 정하지 않았으면 테마 글자색으로
  const hasBg = !!(style.background || style.backgroundColor);
  if (style.color && !hasBg && (BLACKISH.test(style.color) || WHITISH.test(style.color))) delete style.color;
  return { style, block: style.display === "block" || !!style.textAlign };
}

function inline(text: string, out: StyledPiece[]) {
  // **굵게** 먼저, 그다음 *기울임*
  for (const part of text.split(/(\*\*[^*\n]+\*\*)/g)) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      out.push({ kind: "bold", text: part.slice(2, -2) });
      continue;
    }
    for (const p2 of part.split(/(\*[^*\n]+\*)/g)) {
      if (!p2) continue;
      if (p2.startsWith("*") && p2.endsWith("*") && p2.length > 2) out.push({ kind: "italic", text: p2.slice(1, -1) });
      else out.push({ kind: "text", text: p2 });
    }
  }
}

export function parseStyledText(text: string): StyledPiece[] {
  const out: StyledPiece[] = [];
  let last = 0;
  for (const m of text.matchAll(STYLED)) {
    if (m.index! > last) inline(text.slice(last, m.index), out);
    const { style, block } = sanitizeStyle(m[2]);
    out.push({ kind: "styled", text: m[1], style, block });
    last = m.index! + m[0].length;
  }
  if (last < text.length) inline(text.slice(last), out);
  return out;
}
