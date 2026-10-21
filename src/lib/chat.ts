"use client";

import {
  limitToLast,
  onChildAdded,
  onChildRemoved,
  push,
  query,
  ref,
  remove,
  serverTimestamp,
  update,
} from "firebase/database";
import { rtdb } from "./firebase";
import type { ChatMessage } from "./types";

// 채팅은 Realtime DB 에 둔다.
//   chat/{cid}/public/{id}        모두에게 보이는 메시지
//   chat/{cid}/inbox/{uid}/{id}   그 사람에게만 보이는 메시지 (귓속말, GM 비밀 굴림)
// 같은 id 로 보낸 사람과 받는 사람 inbox 에 함께 쓴다.

const HISTORY = 300; // 처음 들어올 때 불러오는 최근 메시지 수

export type OutgoingMessage = Omit<ChatMessage, "id" | "ts">;

// Realtime DB 는 undefined 값을 거부하므로 미리 걷어낸다
function stripUndefined<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export async function sendMessage(cid: string, msg: OutgoingMessage, privateTo?: string[]) {
  const data = { ...stripUndefined(msg), ts: serverTimestamp() };
  if (!privateTo || privateTo.length === 0) {
    await push(ref(rtdb, `chat/${cid}/public`), data);
    return;
  }
  const id = push(ref(rtdb, `chat/${cid}/public`)).key!; // 키만 만든다 (쓰지 않음)
  const recipients = Array.from(new Set([msg.uid, ...privateTo]));
  const updates: Record<string, unknown> = {};
  for (const uid of recipients) updates[`chat/${cid}/inbox/${uid}/${id}`] = data;
  await update(ref(rtdb), updates);
}

export async function deletePublicMessage(cid: string, id: string) {
  await remove(ref(rtdb, `chat/${cid}/public/${id}`));
}

// 공개 채널 + 내 inbox 를 합쳐 시간순으로 넘겨준다.
export function subscribeChat(cid: string, uid: string, onChange: (messages: ChatMessage[]) => void) {
  const byId = new Map<string, ChatMessage>();
  let scheduled = false;
  const emit = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      onChange(Array.from(byId.values()).sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id)));
    });
  };

  const sources = [
    query(ref(rtdb, `chat/${cid}/public`), limitToLast(HISTORY)),
    query(ref(rtdb, `chat/${cid}/inbox/${uid}`), limitToLast(HISTORY)),
  ];
  const unsubs = sources.flatMap((q) => [
    onChildAdded(q, (snap) => {
      const v = snap.val() as Omit<ChatMessage, "id">;
      byId.set(snap.key!, { ...v, id: snap.key!, ts: typeof v.ts === "number" ? v.ts : Date.now() });
      emit();
    }),
    onChildRemoved(q, (snap) => {
      byId.delete(snap.key!);
      emit();
    }),
  ]);
  return () => unsubs.forEach((u) => u());
}
