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
  portrait?: string; // 얼굴 아이콘 (정사각형)
  standing?: string; // 스탠딩 일러스트 (배경 투명 PNG 권장)
  color?: string; // 이름표 강조색
  syncedAt: number;
  order: number;
};

// 보낼 때의 화자 정보를 메시지에 같이 담는다 (나중에 이미지를 바꿔도 지난 로그는 그대로)
export type Speaker = {
  name: string;
  uid: string;
  charId?: string;
  image?: string; // 스탠딩
  avatar?: string; // 얼굴 아이콘
  color?: string;
  narrator?: boolean; // GM 서술 (무대 아래 띠에 지문으로)
};

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
