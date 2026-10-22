import type { ThemeId } from "./themes";

// 테마마다 깔 수 있는 그림 자리 (docs/theme-images.md 참고)
//   그림 파일은 public/themes/<테마>/<자리>.webp 에 두고, 아래 목록에 적으면 켜진다.
//   목록에 없으면 지금처럼 색·무늬 배경이 나온다.
export type ArtSlot = "stage" | "party" | "battle" | "page";

export const ART_SLOTS: { slot: ArtSlot; cssVar: string; label: string }[] = [
  { slot: "stage", cssVar: "--art-stage", label: "대화 무대 기본 배경" },
  { slot: "party", cssVar: "--art-party", label: "모험가들 무대 뒤" },
  { slot: "battle", cssVar: "--art-battle", label: "전투 그리드 기본 바닥" },
  { slot: "page", cssVar: "--art-page", label: "저널·도감 페이지 배경" },
];

// public/themes 에 저장된 기본 배경. 등록하지 않은 자리는 색·무늬로 대체한다.
export const THEME_ART: Partial<Record<ThemeId, Partial<Record<ArtSlot, true>>>> = {
  classic: { stage: true, party: true, battle: true, page: true },
  gothic: { stage: true, party: true, battle: true, page: true },
  phantom: { stage: true, party: true, battle: true, page: true },
  arcane: { stage: true, party: true, battle: true, page: true },
  online: { stage: true, party: true, battle: true, page: true },
};

// ThemeRoot 가 CSS 변수로 깔아 준다 → 각 화면은 var(--art-…) 로 쓴다
export function themeArtVars(id: ThemeId): Record<string, string> {
  const have = THEME_ART[id] ?? {};
  const out: Record<string, string> = {};
  for (const { slot, cssVar } of ART_SLOTS) if (have[slot]) out[cssVar] = `url("/themes/${id}/${slot}.webp")`;
  return out;
}
