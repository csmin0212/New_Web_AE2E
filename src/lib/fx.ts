"use client";

import { onValue, push, ref, remove, serverTimestamp, set, update } from "firebase/database";
import { rtdb } from "./firebase";
import type { CastEntry, Phase, SceneMode } from "./scene";

// 장면 전환·컷인 (코코포리아의 씬 전환 / 컷인 같은 연출)
//   scene/{cid}/presets/{key}   저장한 장면 (GM)
//   scene/{cid}/cutins/{key}    컷인 모음 (GM)
//   scene/{cid}/transition      마지막 전환 { type, ms, at } — 모두의 화면에서 전환 효과
//   fx/{cid}/cutin              지금 재생할 컷인 { key, at, uid } — 참가자 누구나 (채팅 키워드 등)

export type TransitionType = "cut" | "fade" | "flash" | "wipe" | "iris" | "curtain" | "blur";

export const TRANSITIONS: { id: TransitionType; label: string; hint: string }[] = [
  { id: "cut", label: "컷", hint: "바로 바뀜" },
  { id: "fade", label: "암전", hint: "검게 사라졌다 밝아짐" },
  { id: "flash", label: "섬광", hint: "하얗게 번쩍" },
  { id: "wipe", label: "사선 와이프", hint: "사선 띠가 쓸고 지나감 (페르소나풍)" },
  { id: "iris", label: "아이리스", hint: "원이 닫혔다 열림" },
  { id: "curtain", label: "커튼", hint: "막이 내렸다 오름" },
  { id: "blur", label: "흐림", hint: "흐려지며 겹쳐 바뀜" },
];

export type TransitionState = { type: TransitionType; ms: number; at: number };

export type ScenePreset = {
  name: string;
  mode: SceneMode;
  background: string | null;
  cg: string | null;
  place: string;
  phase?: Phase; // 넣으면 전환할 때 페이즈도 바뀐다 (페이즈 컷인 포함)
  autoCast: boolean;
  cast: Record<string, CastEntry>;
  battleBackground?: string | null;
  transition: TransitionType; // 이 장면으로 갈 때 기본 전환
  ms: number;
  createdAt: number;
};

export type CutinStyle = "band" | "side" | "flash" | "full";

export const CUTIN_STYLES: { id: CutinStyle; label: string; hint: string }[] = [
  { id: "band", label: "사선 띠", hint: "강조색 띠 위로 그림과 큰 글씨 (필살기·총공격)" },
  { id: "side", label: "옆에서 등장", hint: "오른쪽에서 인물이 미끄러져 들어오고 이름표 (스킬 발동)" },
  { id: "flash", label: "번쩍", hint: "화면 전체가 번쩍이며 그림이 튀어나옴 (크리티컬·충격)" },
  { id: "full", label: "한 장면", hint: "위아래 검은 띠 사이에 그림 한 장 + 대사 (회상·CG)" },
];

export type CutinPreset = {
  name: string;
  style: CutinStyle;
  image?: string;
  text?: string; // 큰 글씨
  sub?: string; // 작은 글씨
  color?: string; // 띠·강조색 (없으면 테마 강조색)
  ms: number;
  keyword?: string; // 채팅에 이 말이 들어가면 자동 재생
};

export type CutinPlay = { key: string; at: number; uid: string };

function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ── 장면 ──────────────────────────────────────────────

export function savePreset(cid: string, preset: ScenePreset, key?: string) {
  if (key) return set(ref(rtdb, `scene/${cid}/presets/${key}`), clean(preset));
  return push(ref(rtdb, `scene/${cid}/presets`), clean(preset));
}

export function deletePreset(cid: string, key: string) {
  return remove(ref(rtdb, `scene/${cid}/presets/${key}`));
}

// 전환 효과를 먼저 모두에게 알리고, 화면이 가려지는 순간(절반쯤)에 장면 내용을 바꾼다
export async function applyPreset(cid: string, p: ScenePreset, tr?: { type: TransitionType; ms: number }) {
  const type = tr?.type ?? p.transition ?? "fade";
  const ms = tr?.ms ?? p.ms ?? 1200;
  // Realtime DB 는 null 을 저장하지 않아서, 읽어 온 장면에는 빈 칸이 아예 없다 → 기본값으로 채워 쓴다
  const patch: Record<string, unknown> = {
    [`scene/${cid}/mode`]: p.mode ?? "talk",
    [`scene/${cid}/background`]: p.background ?? null,
    [`scene/${cid}/cg`]: p.cg ?? null,
    [`scene/${cid}/place`]: p.place ?? "",
    [`scene/${cid}/autoCast`]: p.autoCast ?? true,
    [`scene/${cid}/cast`]: clean(p.cast ?? {}),
    [`battle/${cid}/meta/background`]: p.battleBackground ?? null,
  };
  if (p.phase) {
    patch[`scene/${cid}/phase`] = p.phase;
    patch[`scene/${cid}/phaseAt`] = serverTimestamp();
  }

  if (type === "cut") {
    await update(ref(rtdb), patch);
    return;
  }
  await set(ref(rtdb, `scene/${cid}/transition`), { type, ms, at: serverTimestamp() });
  await new Promise((r) => setTimeout(r, ms * 0.45));
  await update(ref(rtdb), patch);
}

// 장면은 그대로 두고 전환 효과만 (분위기 전환·시간 경과)
export function playTransition(cid: string, type: TransitionType, ms: number) {
  return set(ref(rtdb, `scene/${cid}/transition`), { type, ms, at: serverTimestamp() });
}

// ── 컷인 ──────────────────────────────────────────────

export function saveCutin(cid: string, c: CutinPreset, key?: string) {
  if (key) return set(ref(rtdb, `scene/${cid}/cutins/${key}`), clean(c));
  return push(ref(rtdb, `scene/${cid}/cutins`), clean(c));
}

export function deleteCutin(cid: string, key: string) {
  return remove(ref(rtdb, `scene/${cid}/cutins/${key}`));
}

export function triggerCutin(cid: string, uid: string, key: string) {
  return set(ref(rtdb, `fx/${cid}/cutin`), { key, uid, at: serverTimestamp() });
}

export function subscribeCutin(cid: string, cb: (c: CutinPlay | null) => void) {
  return onValue(ref(rtdb, `fx/${cid}/cutin`), (snap) => cb((snap.val() as CutinPlay | null) ?? null));
}

// 채팅 글에 들어 있는 컷인 키워드 → 컷인 key
export function findKeywordCutin(text: string, cutins: Record<string, CutinPreset>): string | null {
  for (const [key, c] of Object.entries(cutins)) {
    if (c.keyword && c.keyword.trim() && text.includes(c.keyword.trim())) return key;
  }
  return null;
}
