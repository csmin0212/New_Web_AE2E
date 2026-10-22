"use client";

// 내 주사위 색 — 내 브라우저에 기억해 두고, 굴릴 때 메시지에 실어 보낸다 (다른 사람 화면에도 그 색으로)
//   비워 두면 테마 색을 따른다

const KEY = "vtt:dice-color";

export const DICE_PALETTE: { color: string; label: string }[] = [
  { color: "#e3192b", label: "진홍" },
  { color: "#ff8a3d", label: "주황" },
  { color: "#e8c34a", label: "금" },
  { color: "#4fae5c", label: "숲" },
  { color: "#2aa7ff", label: "하늘" },
  { color: "#5b6cff", label: "남" },
  { color: "#b25cff", label: "보라" },
  { color: "#ff6fb5", label: "분홍" },
  { color: "#9aa4b5", label: "은" },
];

export function readDiceColor(): string | undefined {
  try {
    return localStorage.getItem(KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function writeDiceColor(color: string | undefined) {
  try {
    if (color) localStorage.setItem(KEY, color);
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent(KEY));
}

export function onDiceColor(cb: () => void) {
  window.addEventListener(KEY, cb);
  return () => window.removeEventListener(KEY, cb);
}
