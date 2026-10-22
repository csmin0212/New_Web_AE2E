"use client";

import type { User } from "firebase/auth";
import { ref, set } from "firebase/database";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db, rtdb } from "./firebase";
import { derive } from "./ar/derive";
import type { ArSheet } from "./ar/types";
import type { ParsedSheet } from "./sheet/parse";
import type { Campaign, Character, Gauge, Member } from "./types";

// 헷갈리는 글자(0/O, 1/I/L)를 뺀 6자리 초대 코드
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function makeInviteCode(): string {
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => CODE_CHARS[n % CODE_CHARS.length]).join("");
}

function displayName(user: User): string {
  return user.displayName || user.email?.split("@")[0] || "이름 없음";
}

export async function createCampaign(user: User, name: string): Promise<string> {
  const campaignRef = doc(collection(db, "campaigns"));
  const cid = campaignRef.id;
  const inviteCode = makeInviteCode();
  const now = Date.now();

  // Realtime DB 쪽 권한(GM·초대 코드)을 먼저 만든다. 채팅 규칙이 이걸 본다.
  await set(ref(rtdb, `gm/${cid}`), user.uid);
  await set(ref(rtdb, `codes/${cid}`), inviteCode);
  await set(ref(rtdb, `members/${cid}/${user.uid}`), { role: "gm", name: displayName(user) });

  const batch = writeBatch(db);
  const campaign: Omit<Campaign, "id"> = { name, gmUid: user.uid, inviteCode, createdAt: now };
  batch.set(campaignRef, campaign);
  const member: Member = { uid: user.uid, name: displayName(user), role: "gm", joinedAt: now };
  batch.set(doc(db, "campaigns", cid, "members", user.uid), member);
  batch.set(doc(db, "inviteCodes", inviteCode), { cid });
  batch.set(doc(db, "users", user.uid, "campaigns", cid), { name, role: "gm", joinedAt: now });
  await batch.commit();
  return cid;
}

export async function joinCampaign(user: User, rawCode: string): Promise<string> {
  const code = rawCode.trim().toUpperCase();
  const snap = await getDoc(doc(db, "inviteCodes", code));
  if (!snap.exists()) throw new Error("초대 코드를 찾지 못했어요.");
  const cid = (snap.data() as { cid: string }).cid;
  const now = Date.now();
  const name = displayName(user);

  const memberRef = doc(db, "campaigns", cid, "members", user.uid);
  const existing = await getDoc(memberRef).catch(() => null);
  if (!existing?.exists()) {
    const member: Member = { uid: user.uid, name, role: "player", inviteCode: code, joinedAt: now };
    await setDoc(memberRef, member);
    await set(ref(rtdb, `members/${cid}/${user.uid}`), { role: "player", code, name });
  }
  const campaign = await getDoc(doc(db, "campaigns", cid));
  await setDoc(doc(db, "users", user.uid, "campaigns", cid), {
    name: (campaign.data() as Campaign | undefined)?.name ?? "캠페인",
    role: existing?.exists() ? (existing.data() as Member).role : "player",
    joinedAt: now,
  });
  return cid;
}

// ── 캐릭터 ───────────────────────────────────────────────────

function gauge(max: number | null, prev?: Gauge): Gauge {
  const m = Math.max(0, max ?? prev?.max ?? 0);
  // 다시 불러올 때 현재값은 유지하되 새 최대치를 넘지 않게
  return { cur: prev ? Math.min(prev.cur, m) : m, max: m };
}

export async function fetchSheet(user: User, sheetId: string, tab: string): Promise<ParsedSheet> {
  const token = await user.getIdToken();
  const res = await fetch("/api/sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sheetId, tab }),
  });
  const data = (await res.json().catch(() => ({}))) as { sheet?: ParsedSheet; error?: string };
  if (!res.ok || !data.sheet) throw new Error(data.error ?? "시트를 불러오지 못했어요.");
  return data.sheet;
}

// 구글 시트 → 툴 안 시트용 (탭 목록 / 탭 원본 칸)
async function sheetApi<T>(user: User, body: Record<string, string | undefined>): Promise<T> {
  const token = await user.getIdToken();
  const res = await fetch("/api/sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "시트를 불러오지 못했어요.");
  return data;
}
export async function fetchSheetTabs(user: User, sheetId: string) {
  return (await sheetApi<{ tabs: { title: string; gid: string }[] }>(user, { sheetId, mode: "tabs" })).tabs;
}
export async function fetchSheetGridClient(user: User, sheetId: string, tab: { title?: string; gid?: string }) {
  return (await sheetApi<{ grid: string[][] }>(user, { sheetId, tab: tab.title, gid: tab.gid, mode: "grid" })).grid;
}

export async function addCharacter(
  cid: string,
  sheet: ParsedSheet,
  opts: { kind: Character["kind"]; ownerUid: string | null; order: number },
): Promise<void> {
  const ref_ = doc(collection(db, "campaigns", cid, "characters"));
  const character: Omit<Character, "id"> = {
    kind: opts.kind,
    ownerUid: opts.ownerUid,
    sheet,
    hp: gauge(sheet.hp),
    mp: gauge(sheet.mp),
    fate: gauge(sheet.fate),
    syncedAt: Date.now(),
    order: opts.order,
  };
  await setDoc(ref_, character);
}

export async function resyncCharacter(cid: string, c: Character, sheet: ParsedSheet): Promise<void> {
  await updateDoc(doc(db, "campaigns", cid, "characters", c.id), {
    sheet,
    hp: gauge(sheet.hp, c.hp),
    mp: gauge(sheet.mp, c.mp),
    fate: gauge(sheet.fate, c.fate),
    syncedAt: Date.now(),
  });
}

// ── 툴 안 시트 (Roll20·ARON·직접 입력) ─────────────────────────

// ar 시트에서 기존 화면(파티 칩·토큰 등)이 쓰는 요약을 만든다
export function summarize(ar: ArSheet, gauges: { hp: Gauge; mp: Gauge; fate: Gauge }): ParsedSheet {
  const d = derive(ar);
  const p = ar.profile;
  return {
    sheetId: "",
    tab: "",
    name: p.name,
    charClass: [p.mainClass, p.supportClass].filter(Boolean).join(" / ") || p.category || null,
    race: p.race ?? null,
    attribute: p.element ?? null,
    level: p.level ?? null,
    hp: gauges.hp.max,
    mp: gauges.mp.max,
    fate: gauges.fate.max,
    gold: ar.money != null ? `${ar.money}G` : null,
    stats: d.stats.map((s) => ({ key: s.key, label: s.label, value: ar.stats.find((x) => x.key === s.key)?.base ?? null, mod: s.check.mod })),
    skills: ar.skills.map((s) => ({ name: s.name, sl: s.sl })),
  };
}

// Firestore 는 undefined 를 받지 않는다
function plain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export async function addArCharacter(
  cid: string,
  opts: {
    ar: ArSheet;
    hp: Gauge;
    mp: Gauge;
    fate: Gauge;
    portrait?: string;
    standing?: string;
    token?: string;
    color?: string;
    kind: Character["kind"];
    ownerUid: string | null;
    order: number;
  },
): Promise<string> {
  const ref_ = doc(collection(db, "campaigns", cid, "characters"));
  const character: Omit<Character, "id"> = {
    kind: opts.kind,
    ownerUid: opts.ownerUid,
    sheet: summarize(opts.ar, opts),
    ar: opts.ar,
    hp: opts.hp,
    mp: opts.mp,
    fate: opts.fate,
    portrait: opts.portrait,
    standing: opts.standing,
    token: opts.token,
    color: opts.color,
    syncedAt: Date.now(),
    order: opts.order,
  };
  await setDoc(ref_, plain(character));
  return ref_.id;
}

export async function updateAr(cid: string, c: Character, ar: ArSheet) {
  // 요약(sheet)은 GM 만 바꿀 수 있어서, 주인은 ar 만 저장한다
  await updateDoc(doc(db, "campaigns", cid, "characters", c.id), { ar: plain(ar) });
}

export async function updateArWithSummary(cid: string, c: Character, ar: ArSheet) {
  await updateDoc(doc(db, "campaigns", cid, "characters", c.id), {
    ar: plain(ar),
    sheet: plain(summarize(ar, c)),
  });
}

export async function setGauge(cid: string, charId: string, key: "hp" | "mp" | "fate", value: Gauge) {
  await updateDoc(doc(db, "campaigns", cid, "characters", charId), { [key]: value });
}

export async function updateCharacter(
  cid: string,
  charId: string,
  patch: Partial<Pick<Character, "ownerUid" | "kind" | "portrait" | "standing" | "token" | "color">>,
) {
  // 비운 칸(undefined)은 필드를 지운다 — Firestore 는 undefined 값을 받지 않는다
  const data = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? deleteField() : v]));
  await updateDoc(doc(db, "campaigns", cid, "characters", charId), data);
}

// 이름 바꾸기 — 툴 안 시트가 있으면 시트 이름과 요약을 같이 바꾼다 (GM)
export async function renameCharacter(cid: string, c: Character, name: string) {
  if (c.ar) return updateArWithSummary(cid, c, { ...c.ar, profile: { ...c.ar.profile, name } });
  await updateDoc(doc(db, "campaigns", cid, "characters", c.id), { "sheet.name": name });
}

export async function removeCharacter(cid: string, charId: string) {
  await deleteDoc(doc(db, "campaigns", cid, "characters", charId));
}
