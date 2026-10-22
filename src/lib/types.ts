import type { ArSheet } from "./ar/types";
import type { RollResult } from "./dice";
import type { Segment } from "./inline";
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
  kind: "pc" | "npc" | "enemy"; // enemy 는 GM 만 읽을 수 있다 (HP·능력치 비공개)
  ownerUid: string | null; // 조작 권한이 있는 플레이어 (GM은 항상 가능)
  sheet: ParsedSheet; // 요약 (구글 시트 사본, 또는 ar 에서 만든 요약) — 이름·능력치 표시에 쓴다
  ar?: ArSheet; // 툴 안 시트 (Roll20·ARON 가져오기, 직접 만든 에너미). 있으면 이걸로 굴린다
  hp: Gauge;
  mp: Gauge;
  fate: Gauge;
  portrait?: string; // 얼굴 아이콘 (정사각형)
  standing?: string; // 스탠딩 일러스트 (배경 투명 PNG 권장)
  token?: string; // 전투 토큰 그림 (없으면 얼굴 아이콘)
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

export type MessageKind = "say" | "action" | "ooc" | "roll" | "system" | "image" | "card";

// 스킬·아이템 사용 카드 (Roll20 스킬 템플릿처럼)
export type ChatCard = {
  title: string;
  color?: string;
  glow?: string;
  tag: "skill" | "item" | "attack";
  meta: string[]; // 【타이밍】, SL, 대상, 사거리, 코스트
  body: Segment[]; // [[식]] 은 굴린 결과
  extra?: { label: string; result: Segment }; // 스킬에 딸린 굴림
  note?: string; // "MP 6 소모", "HP +34 회복" 같은 처리 결과
};

// Realtime DB chat/{cid}/public/{id}, chat/{cid}/inbox/{uid}/{id}
export type ChatMessage = {
  id: string;
  ts: number;
  uid: string;
  speaker: Speaker;
  kind: MessageKind;
  text: string;
  roll?: RollResult;
  card?: ChatCard;
  to?: { uid: string; name: string }[]; // 귓속말 대상 (있으면 비공개)
  secret?: boolean; // GM에게만 보이는 굴림
  diceColor?: string; // 굴린 사람이 고른 주사위 색 (없으면 테마 색)
};
