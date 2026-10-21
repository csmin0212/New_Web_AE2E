// 디자인 프리셋. GM이 캠페인 기본값을 고르고, 보는 사람은 자기 화면에서만 바꿔 볼 수 있다.
// 색은 CSS 변수로, 장식(사선·금박 모서리·마법진 선)은 data-skin 으로 globals.css 에서 갈린다.

export type ThemeId = "classic" | "gothic" | "phantom" | "arcane";

export type Theme = {
  id: ThemeId;
  name: string;
  tagline: string;
  skin: "ornate" | "harlequin" | "slant" | "arcane";
  swatch: [string, string, string];
  vars: Record<string, string>;
};

export const THEMES: Theme[] = [
  {
    id: "classic",
    name: "고서 · 금박",
    tagline: "양피지와 금박 장식. 아리안로드다운 고풍스러운 기본형",
    skin: "ornate",
    swatch: ["#1a140e", "#c9a45c", "#e9dcc0"],
    vars: {
      "--bg": "#120e0a",
      "--panel": "#1d1610",
      "--panel-2": "#271e15",
      "--line": "#4a3a26",
      "--text": "#efe4cc",
      "--muted": "#a8977a",
      "--accent": "#c9a45c",
      "--accent-ink": "#1a1206",
      "--accent-2": "#8c2f22",
      "--plate-bg": "linear-gradient(180deg,#3a2a18,#22180e)",
      "--plate-text": "#f3e3b8",
      "--dialog-bg": "linear-gradient(180deg,rgba(26,19,12,.92),rgba(14,10,6,.96))",
      "--dialog-line": "#c9a45c",
      "--font-display": "var(--font-serif-kr)",
      "--font-latin": "var(--font-cinzel)",
      "--st-bar": "#050403",
      "--st-outline": "#f0cf8a",
      "--st-bubble": "#fbf5e6",
      "--st-bubble-ink": "#2a2015",
      "--st-tag": "#2b2014",
      "--st-tag-accent": "#e2bd6e",
      "--pattern": "radial-gradient(circle at 50% 0,rgba(201,164,92,.08),transparent 60%)",
    },
  },
  {
    id: "gothic",
    name: "고딕 · 갈바테인풍",
    tagline: "CVGwent 스토리 화면 기준. 흑백 할리퀸 무늬, 장미빛 포인트, 금빛 인물 테두리",
    skin: "harlequin",
    swatch: ["#0d0b0e", "#d43d78", "#f2ece4"],
    vars: {
      "--bg": "#0c0a0d",
      "--panel": "#151217",
      "--panel-2": "#1e1a21",
      "--line": "#3b3240",
      "--text": "#f4efe8",
      "--muted": "#a69ca8",
      "--accent": "#d43d78",
      "--accent-ink": "#fff6fa",
      "--accent-2": "#c9a45c",
      "--plate-bg": "linear-gradient(90deg,#f4efe8,#ddd3c7)",
      "--plate-text": "#16121a",
      "--dialog-bg": "linear-gradient(180deg,rgba(16,13,18,.9),rgba(8,6,10,.96))",
      "--dialog-line": "#d43d78",
      "--font-display": "var(--font-serif-kr)",
      "--font-latin": "var(--font-cormorant)",
      "--st-bar": "#050505",
      "--st-outline": "#f0cf8a",
      "--st-bubble": "#fffdf8",
      "--st-bubble-ink": "#23211c",
      "--st-tag": "#26262b",
      "--st-tag-accent": "#7fe3e6",
      "--pattern":
        "conic-gradient(from 45deg at 50% 50%,rgba(255,255,255,.035) 0 25%,transparent 0 50%,rgba(255,255,255,.035) 0 75%,transparent 0) 0 0/48px 48px",
    },
  },
  {
    id: "phantom",
    name: "팬텀 · 페르소나풍",
    tagline: "빨강·검정·흰색, 사선 패널과 하프톤",
    skin: "slant",
    swatch: ["#0b0b0b", "#e3192b", "#ffffff"],
    vars: {
      "--bg": "#0a0a0a",
      "--panel": "#141414",
      "--panel-2": "#1d1d1d",
      "--line": "#3a3a3a",
      "--text": "#ffffff",
      "--muted": "#a3a3a3",
      "--accent": "#e3192b",
      "--accent-ink": "#ffffff",
      "--accent-2": "#ffffff",
      "--plate-bg": "#ffffff",
      "--plate-text": "#0a0a0a",
      "--dialog-bg": "rgba(5,5,5,.94)",
      "--dialog-line": "#e3192b",
      "--font-display": "var(--font-noto)", // Black Han Sans 는 작은 글씨에서 뭉개져서 굵은 고딕으로
      "--font-latin": "var(--font-anton)",
      "--st-bar": "#000000",
      "--st-outline": "#ffffff",
      "--st-bubble": "#ffffff",
      "--st-bubble-ink": "#0a0a0a",
      "--st-tag": "#e3192b",
      "--st-tag-accent": "#ffe14d",
      "--pattern": "radial-gradient(rgba(227,25,43,.16) 1.2px,transparent 1.4px) 0 0/9px 9px",
    },
  },
  {
    id: "arcane",
    name: "성야 · 마도서",
    tagline: "남색 밤하늘과 은빛 마법진",
    skin: "arcane",
    swatch: ["#0a1020", "#8fb8ff", "#e6ecff"],
    vars: {
      "--bg": "#080d1a",
      "--panel": "#0f1628",
      "--panel-2": "#152036",
      "--line": "#2a3a5c",
      "--text": "#e6ecff",
      "--muted": "#8d9bbd",
      "--accent": "#8fb8ff",
      "--accent-ink": "#08101f",
      "--accent-2": "#c9a45c",
      "--plate-bg": "linear-gradient(90deg,#1b2a4a,#0f1830)",
      "--plate-text": "#dfe8ff",
      "--dialog-bg": "linear-gradient(180deg,rgba(10,16,32,.9),rgba(6,10,22,.96))",
      "--dialog-line": "#8fb8ff",
      "--font-display": "var(--font-gowun)",
      "--font-latin": "var(--font-cormorant)",
      "--st-bar": "#03060e",
      "--st-outline": "#bcd4ff",
      "--st-bubble": "#eef3ff",
      "--st-bubble-ink": "#0d1530",
      "--st-tag": "#142342",
      "--st-tag-accent": "#8fd8ff",
      "--pattern":
        "radial-gradient(1px 1px at 20% 30%,rgba(230,236,255,.5),transparent),radial-gradient(1px 1px at 70% 60%,rgba(230,236,255,.35),transparent),radial-gradient(1.5px 1.5px at 45% 80%,rgba(143,184,255,.4),transparent)",
    },
  },
];

export const DEFAULT_THEME: ThemeId = "classic";

export function getTheme(id: string | undefined | null): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function themeStyle(t: Theme): React.CSSProperties {
  return t.vars as React.CSSProperties;
}
