"use client";

import { onValue, push, ref, remove, serverTimestamp, set, update } from "firebase/database";
import { rtdb } from "./firebase";
import type { ThemeId } from "./themes";

// 세션 무대 상태 (Realtime DB). GM 만 쓰고 참가자 모두 읽는다.
//   scene/{cid}            모드·페이즈·배경·테마·고정 출연진·NPC 화자 목록
//   battle/{cid}/meta      그리드 크기·배경, 라운드, 차례
//   battle/{cid}/tokens    토큰 정보 (GM)
//   battle/{cid}/pos       토큰 위치 (GM 또는 토큰 주인)

export type SceneMode = "talk" | "battle";
export type Phase = "opening" | "middle" | "climax" | "ending" | "free";

export const PHASES: { id: Phase; ko: string; en: string }[] = [
  { id: "opening", ko: "오프닝 페이즈", en: "OPENING PHASE" },
  { id: "middle", ko: "미들 페이즈", en: "MIDDLE PHASE" },
  { id: "climax", ko: "클라이맥스 페이즈", en: "CLIMAX PHASE" },
  { id: "ending", ko: "엔딩 페이즈", en: "ENDING PHASE" },
  { id: "free", ko: "자유 진행", en: "INTERLUDE" },
];

export type CastEntry = { name: string; image?: string; charId?: string; slot: number };
export type NpcPreset = { name: string; image?: string; color?: string };

export type Scene = {
  mode: SceneMode;
  phase: Phase;
  phaseAt: number;
  theme: ThemeId;
  background: string | null;
  cg: string | null; // 장면 위에 띄우는 컷신 그림
  place: string;
  autoCast: boolean; // 말한 사람이 자동으로 무대에 오르는지
  cast: Record<string, CastEntry>;
  npcs: Record<string, NpcPreset>;
};

export const DEFAULT_SCENE: Scene = {
  mode: "talk",
  phase: "opening",
  phaseAt: 0,
  theme: "classic",
  background: null,
  cg: null,
  place: "",
  autoCast: true,
  cast: {},
  npcs: {},
};

export type TokenSide = "pc" | "ally" | "enemy";
export type Token = {
  name: string;
  image?: string;
  charId?: string;
  ownerUid?: string;
  side: TokenSide;
  init: number; // 행동치
  hp?: { cur: number; max: number }; // 시트와 연결 안 된 에너미용
};
export type BattleMeta = { cols: number; rows: number; background: string | null; round: number; turn: number };
export type Battle = {
  meta: BattleMeta;
  tokens: Record<string, Token>;
  pos: Record<string, { x: number; y: number }>;
};

export const DEFAULT_BATTLE: Battle = {
  meta: { cols: 16, rows: 10, background: null, round: 1, turn: 0 },
  tokens: {},
  pos: {},
};

// Realtime DB 는 undefined 를 거부한다
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function subscribeScene(cid: string, cb: (s: Scene) => void) {
  return onValue(ref(rtdb, `scene/${cid}`), (snap) => {
    const v = (snap.val() ?? {}) as Partial<Scene>;
    cb({ ...DEFAULT_SCENE, ...v, cast: v.cast ?? {}, npcs: v.npcs ?? {} });
  });
}

export function updateScene(cid: string, patch: Partial<Omit<Scene, "phaseAt">>) {
  return update(ref(rtdb, `scene/${cid}`), clean(patch));
}

export function setPhase(cid: string, phase: Phase) {
  return update(ref(rtdb, `scene/${cid}`), { phase, phaseAt: serverTimestamp() });
}

export function addCast(cid: string, entry: CastEntry) {
  return push(ref(rtdb, `scene/${cid}/cast`), clean(entry));
}
export function removeCast(cid: string, key: string) {
  return remove(ref(rtdb, `scene/${cid}/cast/${key}`));
}

export function saveNpc(cid: string, npc: NpcPreset) {
  return push(ref(rtdb, `scene/${cid}/npcs`), clean(npc));
}
export function removeNpc(cid: string, key: string) {
  return remove(ref(rtdb, `scene/${cid}/npcs/${key}`));
}

// ── 전투 ────────────────────────────────────────────────

export function subscribeBattle(cid: string, cb: (b: Battle) => void) {
  return onValue(ref(rtdb, `battle/${cid}`), (snap) => {
    const v = (snap.val() ?? {}) as Partial<Battle>;
    cb({
      meta: { ...DEFAULT_BATTLE.meta, ...(v.meta ?? {}) },
      tokens: v.tokens ?? {},
      pos: v.pos ?? {},
    });
  });
}

export function updateBattleMeta(cid: string, patch: Partial<BattleMeta>) {
  return update(ref(rtdb, `battle/${cid}/meta`), clean(patch));
}

export async function addToken(cid: string, token: Token, at: { x: number; y: number }) {
  const key = push(ref(rtdb, `battle/${cid}/tokens`)).key!;
  await update(ref(rtdb), {
    [`battle/${cid}/tokens/${key}`]: clean(token),
    [`battle/${cid}/pos/${key}`]: at,
  });
  return key;
}

export function updateToken(cid: string, key: string, patch: Partial<Token>) {
  return update(ref(rtdb, `battle/${cid}/tokens/${key}`), clean(patch));
}

export function removeToken(cid: string, key: string) {
  return update(ref(rtdb), { [`battle/${cid}/tokens/${key}`]: null, [`battle/${cid}/pos/${key}`]: null });
}

export function moveToken(cid: string, key: string, at: { x: number; y: number }) {
  return set(ref(rtdb, `battle/${cid}/pos/${key}`), at);
}
