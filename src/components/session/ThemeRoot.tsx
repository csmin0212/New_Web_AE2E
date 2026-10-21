"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { getTheme, THEMES, themeStyle, type ThemeId } from "@/lib/themes";
import { useSession } from "./SessionContext";

const LOCAL_KEY = "trpg-vtt:theme-override";

type ThemeCtl = { override: ThemeId | null; setOverride: (t: ThemeId | null) => void };
const ThemeCtx = createContext<ThemeCtl>({ override: null, setOverride: () => {} });
export const useThemeControl = () => useContext(ThemeCtx);

// 캠페인 테마(GM이 정함) 위에, 보는 사람이 자기 화면에서만 다른 테마를 덮어쓸 수 있다
export function ThemeRoot({ children }: { children: ReactNode }) {
  const { scene } = useSession();
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
  const theme = getTheme(override ?? scene.theme);

  return (
    <ThemeCtx.Provider value={{ override, setOverride }}>
      <div data-skin={theme.skin} data-theme={theme.id} style={themeStyle(theme)} className="theme-root h-dvh overflow-hidden">
        {children}
      </div>
    </ThemeCtx.Provider>
  );
}
