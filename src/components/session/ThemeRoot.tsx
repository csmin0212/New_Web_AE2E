"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { themeArtVars } from "@/lib/themeArt";
import { getTheme, THEMES, themeStyle, type ThemeId } from "@/lib/themes";
import { useSession } from "./SessionContext";

const LOCAL_KEY = "trpg-vtt:theme-override";
// 캠페인마다 마지막으로 보인 테마 — 페이지를 옮겨 데이터를 다시 받는 동안 기본 테마(금박)가 번쩍이지 않게
const lastKey = (cid: string) => `trpg-vtt:theme:${cid}`;

function readLastTheme(cid: string): ThemeId | null {
  try {
    const v = localStorage.getItem(lastKey(cid));
    return THEMES.some((t) => t.id === v) ? (v as ThemeId) : null;
  } catch {
    return null;
  }
}

type ThemeCtl = { override: ThemeId | null; setOverride: (t: ThemeId | null) => void };
const ThemeCtx = createContext<ThemeCtl>({ override: null, setOverride: () => {} });
export const useThemeControl = () => useContext(ThemeCtx);

// 캠페인 테마(GM이 정함 — 모두에게 보인다) 위에, 플레이어는 자기 화면에서만 다른 테마를 덮어쓸 수 있다
// 팝업·메뉴는 이 상자 안에 그려야 테마 색을 받는다 → portalRoot()

export function portalRoot(): Element {
  return document.querySelector(".theme-root") ?? document.body;
}
export function ThemeRoot({ children }: { children: ReactNode }) {
  const { cid, scene, isGM } = useSession();
  const [last] = useState(() => readLastTheme(cid));
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
  // 장면을 아직 못 받았으면 지난번 테마로 그린다
  const theme = scene.loaded ? getTheme(isGM ? scene.theme : (override ?? scene.theme)) : getTheme(last ?? scene.theme);
  useEffect(() => {
    if (!scene.loaded) return;
    try {
      localStorage.setItem(lastKey(cid), theme.id);
    } catch {}
  }, [cid, scene.loaded, theme.id]);
  usePageBackground(theme.id);

  return (
    <ThemeCtx.Provider value={{ override, setOverride }}>
      <div data-skin={theme.skin} data-theme={theme.id} style={{ ...themeStyle(theme), ...themeArtVars(theme.id) }} className="theme-root h-dvh overflow-hidden">
        {children}
      </div>
    </ThemeCtx.Provider>
  );
}

// 캠페인 데이터를 받기 전(로그인 확인·불러오는 중) 화면 — 지난번 테마 색으로
const noSubscribe = () => () => {};

// 페이지가 바뀌는 찰나에 비치는 맨 바탕(body)도 테마 바탕색으로
function usePageBackground(id: ThemeId | null) {
  useEffect(() => {
    if (!id) return;
    const bg = (getTheme(id).vars as Record<string, string>)["--bg"];
    if (bg) document.body.style.background = bg;
  }, [id]);
}
export function LastThemeBox({ cid, children }: { cid: string; children: ReactNode }) {
  // 서버에서는 저장된 테마를 모른다 → 서버 그림과 어긋나지 않게 브라우저에서만 읽는다
  const id = useSyncExternalStore(noSubscribe, () => readLastTheme(cid), () => null);
  const theme = getTheme(id);
  usePageBackground(id ? theme.id : null);
  return (
    <div
      data-skin={theme.skin}
      data-theme={theme.id}
      style={{ ...themeStyle(theme), ...themeArtVars(theme.id), background: "var(--art-page, none) center / cover fixed, var(--pattern), var(--bg)", color: "var(--text)" }}
      className="theme-root h-dvh overflow-hidden"
    >
      {children}
    </div>
  );
}
