"use client";

import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { onValue, ref, serverTimestamp, set } from "firebase/database";
import { db, rtdb } from "./firebase";

// 핸드아웃·저널 (Firestore campaigns/{cid}/journal/{id})
//   GM 은 전부 읽고 쓴다. 플레이어는 공개(shared)·자기에게 보낸(viewers)·자기가 쓴(ownerUid) 것만 읽는다.
//   플레이어도 자기 메모를 쓸 수 있다 (비공개 또는 공개).
// 보여주기: fx/{cid}/show = { id, at } — GM 이 누르면 모두의 화면에 핸드아웃이 뜬다.

export type JournalType = "handout" | "journal" | "note";

export const JOURNAL_TYPES: { id: JournalType; label: string; hint: string }[] = [
  { id: "handout", label: "핸드아웃", hint: "PC 사명·연고, 받은 단서" },
  { id: "journal", label: "저널", hint: "세계관·장소·인물 정리" },
  { id: "note", label: "메모", hint: "진행 기록·개인 메모" },
];

export type JournalEntry = {
  id: string;
  type: JournalType;
  title: string;
  body: string; // 간단한 마크다운 (# 제목, - 목록, **굵게**)
  image?: string;
  shared: boolean; // 모두에게 공개
  viewers: string[]; // 공개하지 않을 때 볼 수 있는 플레이어
  ownerUid: string;
  order: number;
  updatedAt: number;
};

const col = (cid: string) => collection(db, "campaigns", cid, "journal");

function toEntry(id: string, d: Record<string, unknown>): JournalEntry {
  return {
    id,
    type: (d.type as JournalType) ?? "journal",
    title: (d.title as string) ?? "",
    body: (d.body as string) ?? "",
    image: (d.image as string) || undefined,
    shared: !!d.shared,
    viewers: (d.viewers as string[]) ?? [],
    ownerUid: (d.ownerUid as string) ?? "",
    order: (d.order as number) ?? 0,
    updatedAt: (d.updatedAt as number) ?? 0,
  };
}

// GM 은 한 번에, 플레이어는 규칙이 허락하는 세 갈래를 합쳐서 받는다
export function subscribeJournal(cid: string, uid: string, isGM: boolean, cb: (list: JournalEntry[]) => void, onError?: (e: Error) => void) {
  const sort = (list: JournalEntry[]) => list.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ko"));
  if (isGM) return onSnapshot(col(cid), (snap) => cb(sort(snap.docs.map((d) => toEntry(d.id, d.data())))), onError);
  const parts: Record<string, Map<string, JournalEntry>> = { shared: new Map(), mine: new Map(), owned: new Map() };
  const emit = () => {
    const all = new Map<string, JournalEntry>();
    for (const m of Object.values(parts)) for (const [k, v] of m) all.set(k, v);
    cb(sort([...all.values()]));
  };
  const listen = (key: string, q: ReturnType<typeof query>) =>
    onSnapshot(
      q,
      (snap) => {
        parts[key] = new Map(snap.docs.map((d) => [d.id, toEntry(d.id, d.data() as Record<string, unknown>)]));
        emit();
      },
      onError,
    );
  const unsubs = [
    listen("shared", query(col(cid), where("shared", "==", true))),
    listen("mine", query(col(cid), where("viewers", "array-contains", uid))),
    listen("owned", query(col(cid), where("ownerUid", "==", uid))),
  ];
  return () => unsubs.forEach((u) => u());
}

export async function createJournal(cid: string, uid: string, type: JournalType): Promise<string> {
  const label = JOURNAL_TYPES.find((t) => t.id === type)?.label ?? "저널";
  const r = await addDoc(col(cid), {
    type,
    title: `새 ${label}`,
    body: "",
    shared: false,
    viewers: [],
    ownerUid: uid,
    order: Date.now(),
    updatedAt: Date.now(),
  });
  return r.id;
}

export async function saveJournal(cid: string, e: JournalEntry) {
  const { id, ...rest } = e;
  await updateDoc(doc(db, "campaigns", cid, "journal", id), { ...JSON.parse(JSON.stringify(rest)), image: rest.image ?? null, updatedAt: Date.now() });
}

export async function deleteJournal(cid: string, id: string) {
  await deleteDoc(doc(db, "campaigns", cid, "journal", id));
}

export async function fetchJournal(cid: string, id: string): Promise<JournalEntry | null> {
  const s = await getDoc(doc(db, "campaigns", cid, "journal", id));
  return s.exists() ? toEntry(s.id, s.data()) : null;
}

// ── 보여주기 ──────────────────────────────────────────

export type ShowState = { id: string; at: number };

export async function showJournal(cid: string, e: JournalEntry) {
  // 보여주는 순간 모두에게 공개한다 (안 그러면 플레이어가 읽을 수 없다)
  if (!e.shared) await updateDoc(doc(db, "campaigns", cid, "journal", e.id), { shared: true, updatedAt: Date.now() });
  await set(ref(rtdb, `fx/${cid}/show`), { id: e.id, at: serverTimestamp() });
}

export function subscribeShow(cid: string, cb: (s: ShowState | null) => void) {
  return onValue(ref(rtdb, `fx/${cid}/show`), (snap) => cb((snap.val() as ShowState | null) ?? null));
}

// ── 본문 꾸밈 (아주 작은 마크다운) ──────────────────────

export type Block = { kind: "h1" | "h2" | "p" | "li" | "quote" | "hr"; text: string };

export function parseBody(body: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "p", text: para.join("\n") });
    para = [];
  };
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const rules: [RegExp, Block["kind"]][] = [
      [/^##\s+(.*)$/, "h2"],
      [/^#\s+(.*)$/, "h1"],
      [/^\s*[-*・]\s+(.*)$/, "li"],
      [/^>\s?(.*)$/, "quote"],
    ];
    if (/^-{3,}$/.test(line.trim())) {
      flush();
      out.push({ kind: "hr", text: "" });
      continue;
    }
    const hit = rules.map(([re, kind]) => [line.match(re), kind] as const).find(([m]) => m);
    if (hit) {
      flush();
      out.push({ kind: hit[1], text: hit[0]![1] });
    } else para.push(line);
  }
  flush();
  return out;
}

// **굵게** 를 조각으로
export function splitBold(text: string): { text: string; bold: boolean }[] {
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((t) => (t.startsWith("**") && t.endsWith("**") ? { text: t.slice(2, -2), bold: true } : { text: t, bold: false }));
}
