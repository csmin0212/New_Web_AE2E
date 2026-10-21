import type { RollResult } from "./dice";
import type { ParsedSheet } from "./sheet/parse";

export type Role = "gm" | "player";

// Firestore campaigns/{cid}
export type Campaign = {
  id: string;
  name: string;
  gmUid: string;
  inviteCode: string;
  createdAt: number;
};

// Firestore campaigns/{cid}/members/{uid}
export type Member = {
  uid: string;
  name: string;
  role: Role;
  inviteCode?: string; // 참가할 때 규칙 검사용
  joinedAt: number;
};

export type Gauge = { cur: number; max: number };

// Firestore campaigns/{cid}/characters/{chid}
export type Character = {
  id: string;
  kind: "pc" | "npc";
  ownerUid: string | null; // 조작 권한이 있는 플레이어 (GM은 항상 가능)
  sheet: ParsedSheet; // 구글 시트 사본 — "다시 불러오기"로만 바뀜
  hp: Gauge;
  mp: Gauge;
  fate: Gauge;
  portrait?: string;
  syncedAt: number;
  order: number;
};

export type Speaker = { name: string; uid: string; charId?: string };

export type MessageKind = "say" | "action" | "ooc" | "roll" | "system" | "image";

// Realtime DB chat/{cid}/public/{id}, chat/{cid}/inbox/{uid}/{id}
export type ChatMessage = {
  id: string;
  ts: number;
  uid: string;
  speaker: Speaker;
  kind: MessageKind;
  text: string;
  roll?: RollResult;
  to?: { uid: string; name: string }[]; // 귓속말 대상 (있으면 비공개)
  secret?: boolean; // GM에게만 보이는 굴림
};
