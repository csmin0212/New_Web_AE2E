"use client";

import type { User } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { emptyStats, type ArSheet } from "./ar/types";
import { addArCharacter } from "./campaigns";
import { db } from "./firebase";
import type { ImportCandidate, LibraryEntry, LibraryKind } from "./libraryImport";
import type { Character } from "./types";
import { copyImage, isOwnImage } from "./upload";

export { parseImport, splitJson } from "./libraryImport";
export type { ImportCandidate, LibraryEntry, LibraryKind } from "./libraryImport";

// 캐릭터 보관함 — 사람마다 하나. 캠페인과 상관없이 모아 두고, 필요할 때 캠페인에 넣는다.
//   users/{uid}/library/{id}

const col = (uid: string) => collection(db, "users", uid, "library");

function plain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function subscribeLibrary(uid: string, cb: (list: LibraryEntry[]) => void, onError?: (e: Error) => void) {
  return onSnapshot(
    query(col(uid), orderBy("updatedAt", "desc")),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Omit<LibraryEntry, "id">), id: d.id }))),
    onError,
  );
}

export function subscribeEntry(uid: string, id: string, cb: (e: LibraryEntry | null) => void) {
  return onSnapshot(doc(col(uid), id), (snap) =>
    cb(snap.exists() ? { ...(snap.data() as Omit<LibraryEntry, "id">), id: snap.id } : null),
  );
}

export async function saveEntry(uid: string, e: LibraryEntry) {
  const { id, ...rest } = e;
  await setDoc(doc(col(uid), id), plain({ ...rest, name: e.ar.profile.name || e.name, updatedAt: Date.now() }));
}

export async function patchEntry(uid: string, id: string, patch: Partial<Omit<LibraryEntry, "id">>) {
  await updateDoc(doc(col(uid), id), plain({ ...patch, updatedAt: Date.now() }));
}

export async function deleteEntry(uid: string, id: string) {
  await deleteDoc(doc(col(uid), id));
}

export function blankEntry(kind: LibraryKind, name: string): Omit<LibraryEntry, "id"> {
  const now = Date.now();
  const ar: ArSheet = {
    version: 1,
    kind: kind === "pc" ? "pc" : "enemy",
    profile: { name, level: 1 },
    stats: emptyStats(),
    combat: { hitDice: 2, hitMod: 0, dmgDice: 2, dmgMod: 0, evaDice: 2, evaMod: 0, actionMod: 0, moveMod: 0, pdefMod: 0, mdefMod: 0 },
    fixed: kind === "pc" ? undefined : { evasion: { dice: 2, mod: 0 }, action: 0, move: 5, pdef: 0, mdef: 0 },
    checks: [],
    equipment: [],
    items: [],
    skills: [],
    attacks: [],
    drops: [],
    source: "manual",
  };
  return {
    name,
    kind,
    ar,
    hp: { cur: 30, max: 30 },
    mp: { cur: 10, max: 10 },
    fate: { cur: kind === "pc" ? 5 : 0, max: kind === "pc" ? 5 : 0 },
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function createEntry(uid: string, data: Omit<LibraryEntry, "id">): Promise<string> {
  const ref = doc(col(uid));
  await setDoc(ref, plain(data));
  return ref.id;
}

// 후보를 보관함에 넣는다. 그림은 내 저장소로 복사 (실패하면 원래 주소를 그대로 쓴다)
export async function importCandidates(
  user: User,
  list: ImportCandidate[],
  opts: { copyImages: boolean; overwrite: boolean },
  onProgress?: (done: number, total: number, name: string) => void,
): Promise<{ added: number; updated: number; imageFailures: string[] }> {
  let added = 0;
  let updated = 0;
  const imageFailures: string[] = [];
  const copy = async (url: string | undefined, name: string) => {
    if (!url) return undefined;
    if (!opts.copyImages || isOwnImage(url)) return url;
    try {
      return await copyImage(user, url);
    } catch {
      imageFailures.push(name);
      return url;
    }
  };
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    onProgress?.(i, list.length, c.data.name);
    const portrait = await copy(c.avatar, c.data.name);
    const token = c.tokenImage && c.tokenImage !== c.avatar ? await copy(c.tokenImage, c.data.name) : portrait;
    const data = { ...c.data, portrait, standing: c.data.standing ?? portrait, token };
    if (c.existingId && opts.overwrite) {
      // 직접 고친 태그·그림은 살리고 시트 내용만 새로
      await patchEntry(user.uid, c.existingId, { ar: data.ar, hp: data.hp, mp: data.mp, fate: data.fate, name: data.name, kind: data.kind, portrait: data.portrait, token: data.token });
      updated++;
    } else {
      await createEntry(user.uid, data);
      added++;
    }
  }
  onProgress?.(list.length, list.length, "");
  return { added, updated, imageFailures };
}

export async function deleteEntries(uid: string, ids: string[]) {
  const batch = writeBatch(db);
  for (const id of ids) batch.delete(doc(col(uid), id));
  await batch.commit();
}

// ── 캠페인에 넣기 ──────────────────────────────────────────

export async function addEntryToCampaign(
  cid: string,
  e: LibraryEntry,
  opts: { kind: Character["kind"]; ownerUid: string | null; order: number },
) {
  return addArCharacter(cid, {
    ar: { ...e.ar, profile: { ...e.ar.profile, name: e.ar.profile.name || e.name } },
    hp: { cur: e.hp.max, max: e.hp.max },
    mp: { cur: e.mp.max, max: e.mp.max },
    fate: { cur: e.fate.max, max: e.fate.max },
    portrait: e.portrait,
    standing: e.standing,
    token: e.token,
    color: e.color,
    kind: opts.kind,
    ownerUid: opts.ownerUid,
    order: opts.order,
  });
}
