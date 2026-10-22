"use client";

import { onValue, ref, remove, serverTimestamp, set } from "firebase/database";
import { rtdb } from "./firebase";

// 그리드 위에서 모두에게 보이는 손짓 — 자(거리 재기)와 핑(여기 봐!)
//   fx/{cid}/pointer/{uid} = { kind, name, color, from?, to, at }   (자기 것만 쓴다)

export type Cell = { x: number; y: number };
// 자: path = 시작점과 꺾인 점들, to = 지금 끝
export type Pointer = { kind: "ruler" | "ping"; name: string; color?: string; from?: Cell; path?: Cell[]; to: Cell; at: number };

export function setPointer(cid: string, uid: string, p: Omit<Pointer, "at">) {
  return set(ref(rtdb, `fx/${cid}/pointer/${uid}`), { ...JSON.parse(JSON.stringify(p)), at: serverTimestamp() });
}

export function clearPointer(cid: string, uid: string) {
  return remove(ref(rtdb, `fx/${cid}/pointer/${uid}`));
}

export function subscribePointers(cid: string, cb: (all: Record<string, Pointer>) => void) {
  return onValue(ref(rtdb, `fx/${cid}/pointer`), (snap) => cb((snap.val() as Record<string, Pointer> | null) ?? {}));
}

// 칸 거리 (아리안로드 그리드: 대각선도 1칸) → 미터
export const METERS_PER_CELL = 5;
export function cellDistance(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
