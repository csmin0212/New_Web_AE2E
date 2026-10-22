// 글씨 꾸미기 — 고른 옵션을 Roll20 꾸밈 문법으로 바꾼다 (채팅 카드·저널이 그대로 읽는다)
//   [글자](#" style="color:#c0392b; font-weight:bold")

export type TextStyle = {
  color?: string;
  size?: "sm" | "md" | "lg" | "xl";
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  center?: boolean; // 가운데 줄 (한 줄을 다 차지)
  bg?: string; // 띠 배경
  glow?: boolean; // 글자 빛 (글자색으로)
};

export const SIZE_PX: Record<NonNullable<TextStyle["size"]>, number> = { sm: 11, md: 13, lg: 16, xl: 20 };
export const SIZE_LABEL: Record<NonNullable<TextStyle["size"]>, string> = { sm: "작게", md: "보통", lg: "크게", xl: "아주 크게" };

export function styleToCss(t: TextStyle): string {
  const css: string[] = [];
  if (t.color) css.push(`color:${t.color}`);
  if (t.size && t.size !== "md") css.push(`font-size:${SIZE_PX[t.size]}px`);
  if (t.bold) css.push("font-weight:bold");
  if (t.italic) css.push("font-style:italic");
  if (t.underline) css.push("text-decoration:underline");
  if (t.center) css.push("display:block", "text-align:center");
  if (t.bg) css.push(`background:${t.bg}`, "padding:1px 8px", "border-radius:4px", ...(t.color ? [] : ["color:#ffffff"]));
  if (t.glow) css.push(`text-shadow:0 0 6px ${t.color ?? "#ffd34d"}`);
  return css.join("; ");
}

// 이미 꾸밈이 붙은 글자를 다시 꾸미면 겹치지 않게 안쪽 글자만 꺼낸다
export function unwrapStyled(text: string): string {
  const m = text.match(/^\[([^\]\n]*)\]\(#?"\s*style="[^"]*"?\s*\)$/);
  return m ? m[1] : text.replace(/^\*\*([\s\S]+)\*\*$/, "$1");
}

export function wrapStyled(text: string, t: TextStyle): string {
  const inner = unwrapStyled(text).replace(/[[\]]/g, "");
  const css = styleToCss(t);
  if (!css) return inner;
  // 굵게만이면 짧은 문법으로
  if (css === "font-weight:bold") return `**${inner}**`;
  return `[${inner}](#" style="${css}")`;
}

// 기본으로 주는 꾸밈 (아리안로드 속성 색)
export const PRESET_STYLES: { name: string; style: TextStyle }[] = [
  { name: "제목", style: { bold: true, center: true, size: "lg" } },
  { name: "강조", style: { bold: true, color: "#e3192b" } },
  { name: "조건", style: { italic: true, color: "#8d9bbd" } },
  { name: "화염", style: { bold: true, color: "#ff6a2b", glow: true } },
  { name: "냉기", style: { bold: true, color: "#5ec8ff", glow: true } },
  { name: "번개", style: { bold: true, color: "#ffd34d", glow: true } },
  { name: "빛", style: { bold: true, color: "#fff2b0", glow: true } },
  { name: "어둠", style: { bold: true, color: "#b25cff", glow: true } },
  { name: "띠", style: { bold: true, center: true, bg: "#8c2f22" } },
];

// 내가 만든 꾸밈 — 이 브라우저에 기억
const KEY = "vtt:my-text-styles";
export function loadMyStyles(): { name: string; style: TextStyle }[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
export function saveMyStyles(list: { name: string; style: TextStyle }[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40)));
  } catch {}
}
