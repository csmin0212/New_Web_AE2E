"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { themeArtVars } from "@/lib/themeArt";
import { getTheme, THEMES, themeStyle, type ThemeId } from "@/lib/themes";
import { useSession } from "./SessionContext";

const LOCAL_KEY = "trpg-vtt:theme-override";

type ThemeCtl = { override: ThemeId | null; setOverride: (t: ThemeId | null) => void };
const ThemeCtx = createContext<ThemeCtl>({ override: null, setOverride: () => {} });
export const useThemeControl = () => useContext(ThemeCtx);

// 캠페인 테마(GM이 정함 — 모두에게 보인다) 위에, 플레이어는 자기 화면에서만 다른 테마를 덮어쓸 수 있다
// 팝업·메뉴는 이 상자 안에 그려야 테마 색을 받는다 → portalRoot()

export function portalRoot(): Element {
  return document.querySelector(".theme-root") ?? document.body;
}
export function ThemeRoot({ children }: { children: ReactNode }) {
  const { scene, isGM } = useSession();
  const [override, setOverrideState] = useState<ThemeId | null>(() => {
    try {
      const v = localStorage.getItem(LOCAL_KEY);
      return THEMES.some((t) => t.id === v) ? (v as ThemeId) : null;
    } catch {
      return null;
    }
  });
  const setOverride = (t: ThemeId | null) => {
    setOverrideState(t);
    try {
      if (t) localStorage.setItem(LOCAL_KEY, t);
      else localStorage.removeItem(LOCAL_KEY);
    } catch {}
  };
  // GM 은 언제나 캠페인 테마를 본다 (GM 이 바꾸는 테마가 곧 모두의 테마)
  const theme = getTheme(isGM ? scene.theme : (override ?? scene.theme));

  return (
    <ThemeCtx.Provider value={{ override, setOverride }}>
      <div data-skin={theme.skin} data-theme={theme.id} style={{ ...themeStyle(theme), ...themeArtVars(theme.id) }} className="theme-root h-dvh overflow-hidden">
        {children}
      </div>
    </ThemeCtx.Provider>
  );
}
