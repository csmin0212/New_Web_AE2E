"use client";

import { onValue, ref, serverTimestamp, set } from "firebase/database";
import { rtdb } from "./firebase";

// 페르소나식 화면 연출 모음
//   자동: 전투 개시·라운드·차례·크리티컬·펌블 — 각자 화면이 상태 변화를 보고 스스로 튼다 (기록 없음)
//   GM:   승리·패배·경고·챕터 제목·레벨 업·총공격·띠 문구 — fx/{cid}/event 로 모두에게

export type FxKind =
  | "encounter"
  | "round"
  | "turn"
  | "critical"
  | "fumble"
  | "victory"
  | "defeat"
  | "warning"
  | "chapter"
  | "levelup"
  | "allout"
  | "banner";

export type FxEvent = {
  kind: FxKind;
  text?: string; // 큰 글씨
  sub?: string; // 작은 글씨
  image?: string; // 얼굴 (차례·크리티컬)
  color?: string;
  mine?: boolean; // 차례: 내 차례인지
  enemy?: boolean; // 차례: 적 차례인지
  at: number;
  uid?: string;
};

export type FxDef = { kind: FxKind; label: string; ms: number; auto?: boolean; text: string; sub?: string; hint: string };

export const FX_DEFS: FxDef[] = [
  { kind: "encounter", label: "전투 개시", ms: 2200, auto: true, text: "ENCOUNTER", sub: "전투 개시", hint: "섬광과 사선 베기 — 전투 개시를 누르면 자동" },
  { kind: "round", label: "라운드", ms: 1500, auto: true, text: "ROUND 02", hint: "가운데로 모이는 선 — 라운드가 넘어가면 자동" },
  { kind: "turn", label: "차례", ms: 1700, auto: true, text: "YOUR TURN", sub: "유즈의 차례", hint: "사선 띠 위로 얼굴과 이름 — 차례가 오면 자동" },
  { kind: "critical", label: "크리티컬", ms: 2000, auto: true, text: "CRITICAL!", sub: "6이 두 개!", hint: "검은 띠·하프톤·얼굴 컷 — 크리티컬이 뜨면 자동" },
  { kind: "fumble", label: "펌블", ms: 1700, auto: true, text: "FUMBLE…", sub: "전부 1", hint: "색이 빠지고 글자가 떨어진다 — 펌블이 뜨면 자동" },
  { kind: "victory", label: "승리", ms: 3600, text: "VICTORY", sub: "MISSION COMPLETE", hint: "금빛 빛살과 글자 — 전투가 끝나면" },
  { kind: "defeat", label: "패배", ms: 3600, text: "DEFEATED", sub: "모두 쓰러졌다…", hint: "화면이 어두워지며 금이 간다" },
  { kind: "warning", label: "경고 (보스)", ms: 3200, text: "WARNING", sub: "강대한 적이 나타났다", hint: "위아래 경고 띠가 흐르고 깜빡임 — 보스 등장" },
  { kind: "chapter", label: "챕터 제목", ms: 4200, text: "별의 아이", sub: "CHAPTER 1", hint: "검은 화면에 선이 그어지며 제목 — 회차 시작" },
  { kind: "levelup", label: "레벨 업", ms: 2600, text: "LEVEL UP!", sub: "성장", hint: "빛 알갱이와 함께 솟는 글자 — 세션 끝 성장" },
  { kind: "allout", label: "총공격", ms: 2400, text: "ALL-OUT ATTACK", sub: "다 같이 덤벼!", hint: "만화풍 폭발 컷 — 결정타" },
  { kind: "banner", label: "띠 문구", ms: 2600, text: "작전 개시", sub: "", hint: "가로 띠에 문구 한 줄 — 무엇이든" },
];

export function fxDef(kind: FxKind): FxDef {
  return FX_DEFS.find((d) => d.kind === kind)!;
}

export function triggerFx(cid: string, uid: string, ev: Omit<FxEvent, "at" | "uid">) {
  return set(ref(rtdb, `fx/${cid}/event`), { ...JSON.parse(JSON.stringify(ev)), uid, at: serverTimestamp() });
}

export function subscribeFx(cid: string, cb: (e: FxEvent | null) => void) {
  return onValue(ref(rtdb, `fx/${cid}/event`), (snap) => cb((snap.val() as FxEvent | null) ?? null));
}

// 내 화면에서만 (미리보기·자동 연출)
const LOCAL = "vtt:fx-local";
export function playLocalFx(ev: Omit<FxEvent, "at">) {
  window.dispatchEvent(new CustomEvent(LOCAL, { detail: { ...ev, at: Date.now() } }));
}
export function onLocalFx(cb: (e: FxEvent) => void) {
  const h = (e: Event) => cb((e as CustomEvent<FxEvent>).detail);
  window.addEventListener(LOCAL, h);
  return () => window.removeEventListener(LOCAL, h);
}
