"use client";

import { onValue, push, ref, remove, serverTimestamp, set, update } from "firebase/database";
import { rtdb } from "./firebase";
import type { BsDef, StatusMap, TurnState } from "./battleRules";
import type { DamageWindow } from "./damageRules";
import type { TerrainDef } from "./terrain";
import type { CutinPreset, ScenePreset, TransitionState } from "./fx";
import type { ThemeId } from "./themes";

// 세션 무대 상태 (Realtime DB). GM 만 쓰고 참가자 모두 읽는다.
//   scene/{cid}            모드·페이즈·배경·테마·고정 출연진·NPC 화자 목록
//   battle/{cid}/meta      그리드 크기·배경, 라운드, 차례
//   battle/{cid}/tokens    토큰 정보 (GM)
//   battle/{cid}/pos       토큰 위치 (GM 또는 토큰 주인)
//   battle/{cid}/turn      지금 차례 (battle.ts)

export type SceneMode = "talk" | "battle";
export type Phase = "opening" | "middle" | "climax" | "ending" | "free";

export const PHASES: { id: Phase; ko: string; en: string }[] = [
  { id: "opening", ko: "오프닝 페이즈", en: "OPENING PHASE" },
  { id: "middle", ko: "미들 페이즈", en: "MIDDLE PHASE" },
  { id: "climax", ko: "클라이맥스 페이즈", en: "CLIMAX PHASE" },
  { id: "ending", ko: "엔딩 페이즈", en: "ENDING PHASE" },
  { id: "free", ko: "자유 진행", en: "INTERLUDE" },
];

// 대화 무대 보기: focus = 인물을 크게 세운다 (대화 집중), scene = 배경을 살리고 말하는 사람 얼굴만 (배경 모드)
export type TalkView = "focus" | "scene";

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
  talkView: TalkView;
  actorScale: number; // 무대 인물 크기 (1 = 기본)
  showcase?: { partyBg?: string; castBg?: string; atlasBg?: string }; // 등장인물·지역 도감 페이지 배경 (GM)
  cast: Record<string, CastEntry>;
  offstage: Record<string, true>; // GM 이 무대에서 내린 인물 ("char:id" / "name:이름")
  npcs: Record<string, NpcPreset>;
  presets: Record<string, ScenePreset>; // 저장해 둔 장면 (코코포리아의 씬)
  cutins: Record<string, CutinPreset>; // 컷인 모음
  transition: TransitionState | null; // 마지막 장면 전환 (모두의 화면에 전환 효과)
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
  talkView: "focus",
  actorScale: 1,
  cast: {},
  offstage: {},
  npcs: {},
  presets: {},
  cutins: {},
  transition: null,
};

export type TokenSide = "pc" | "ally" | "enemy";
export type Token = {
  name: string;
  image?: string;
  charId?: string;
  ownerUid?: string;
  side: TokenSide;
  init: number; // 행동치
  hp?: { cur: number; max: number }; // 예전 시트 없는 에너미 (GM 화면에만 보인다)
  cond?: "hurt" | "down"; // 에너미 상태 — 숫자 대신 플레이어에게 보여 준다 (GM 화면이 갱신)
  status?: StatusMap; // 배드 스테이터스 (GM 또는 토큰 주인이 붙이고 뗀다)
  size?: number; // 차지하는 칸 (1 = 1×1, 2 = 2×2 …) — GM 또는 토큰 주인
};
export type BattleMeta = { cols: number; rows: number; background: string | null; round: number; turn: number };
export type Battle = {
  meta: BattleMeta;
  tokens: Record<string, Token>;
  pos: Record<string, { x: number; y: number }>;
  turn: TurnState;
  terrain: Record<string, string>; // "x_y" → 지형 id (맵 기믹)
  terrainDefs: Record<string, TerrainDef>; // 비어 있으면 기본 지형
  damage?: DamageWindow; // 진행 중인 대미지 처리 (직전·직후 선언)
  statusDefs: Record<string, Omit<BsDef, "id">>; // GM 이 만든 상태 이상·버프
  loaded?: boolean; // 서버 값을 한 번이라도 받았는지 (기본값과 구분)
};

export const DEFAULT_BATTLE: Battle = {
  meta: { cols: 16, rows: 10, background: null, round: 1, turn: 0 },
  tokens: {},
  pos: {},
  turn: { actor: null, round: 1, acted: {} },
  terrain: {},
  terrainDefs: {},
  statusDefs: {},
};

// Realtime DB 는 undefined 를 거부한다
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function subscribeScene(cid: string, cb: (s: Scene) => void) {
  return onValue(ref(rtdb, `scene/${cid}`), (snap) => {
    const v = (snap.val() ?? {}) as Partial<Scene>;
    cb({ ...DEFAULT_SCENE, ...v, cast: v.cast ?? {}, offstage: v.offstage ?? {}, npcs: v.npcs ?? {}, presets: v.presets ?? {}, cutins: v.cutins ?? {}, transition: v.transition ?? null });
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
export function updateNpc(cid: string, key: string, npc: NpcPreset) {
  return set(ref(rtdb, `scene/${cid}/npcs/${key}`), clean(npc));
}
export function removeNpc(cid: string, key: string) {
  return remove(ref(rtdb, `scene/${cid}/npcs/${key}`));
}

// 무대에 고정으로 서 있는지 — 캐릭터는 charId, NPC 화자는 이름으로 찾는다
export function findCast(scene: Scene, who: { charId?: string; name: string }): string | null {
  for (const [k, c] of Object.entries(scene.cast)) {
    if (who.charId ? c.charId === who.charId : !c.charId && c.name === who.name) return k;
  }
  return null;
}

export function stageKeyOf(who: { charId?: string; name: string }) {
  return who.charId ? `char:${who.charId}` : `name:${who.name}`;
}

// 무대에 있는지 — 고정 출연이거나, 내리지 않았는데 최근에 말해서 자동으로 선 경우
export function isOnStage(scene: Scene, who: { charId?: string; name: string }, autoActorKeys: string[] = []) {
  return !!findCast(scene, who) || (!scene.offstage[stageKeyOf(who)] && autoActorKeys.includes(stageKeyOf(who)));
}

// 무대에 세우기: 내린 표시를 지우고 고정 출연으로
export async function putOnStage(cid: string, scene: Scene, who: { charId?: string; name: string; image?: string }) {
  await update(ref(rtdb, `scene/${cid}/offstage`), { [stageKeyOf(who)]: null });
  if (findCast(scene, who)) return;
  const slots = Object.values(scene.cast).map((c) => c.slot);
  await addCast(cid, { name: who.name, image: who.image, charId: who.charId, slot: slots.length ? Math.max(...slots) + 1 : 0 });
}

// 무대에서 내리기: 고정 출연이면 빼고, 말해도 자동으로 다시 오르지 않게 표시
export async function takeOffStage(cid: string, scene: Scene, who: { charId?: string; name: string }) {
  const key = findCast(scene, who);
  if (key) await removeCast(cid, key);
  await update(ref(rtdb, `scene/${cid}/offstage`), { [stageKeyOf(who)]: true });
}

export function toggleCast(cid: string, scene: Scene, who: { charId?: string; name: string; image?: string }) {
  return findCast(scene, who) ? takeOffStage(cid, scene, who) : putOnStage(cid, scene, who);
}

// ── 전투 ────────────────────────────────────────────────

export function subscribeBattle(cid: string, cb: (b: Battle) => void) {
  return onValue(ref(rtdb, `battle/${cid}`), (snap) => {
    const v = (snap.val() ?? {}) as Partial<Battle>;
    const meta = { ...DEFAULT_BATTLE.meta, ...(v.meta ?? {}) };
    cb({
      meta,
      tokens: v.tokens ?? {},
      pos: v.pos ?? {},
      turn: { actor: v.turn?.actor ?? null, round: v.turn?.round ?? meta.round, acted: v.turn?.acted ?? {}, ...(v.turn?.phase ? { phase: v.turn.phase } : {}) },
      terrain: v.terrain ?? {},
      terrainDefs: v.terrainDefs ?? {},
      damage: v.damage ?? undefined,
      statusDefs: v.statusDefs ?? {},
      loaded: true,
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

export function setTokenStatus(cid: string, key: string, status: StatusMap) {
  return set(ref(rtdb, `battle/${cid}/tokens/${key}/status`), Object.keys(status).length ? status : null);
}

export function setTokenSize(cid: string, key: string, size: number) {
  return set(ref(rtdb, `battle/${cid}/tokens/${key}/size`), size > 1 ? size : null);
}

export function removeToken(cid: string, key: string) {
  return update(ref(rtdb), { [`battle/${cid}/tokens/${key}`]: null, [`battle/${cid}/pos/${key}`]: null });
}

export function moveToken(cid: string, key: string, at: { x: number; y: number }) {
  return set(ref(rtdb, `battle/${cid}/pos/${key}`), at);
}
