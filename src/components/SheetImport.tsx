"use client";

import type { User } from "firebase/auth";
import { useState } from "react";
import { addCharacter, fetchSheet } from "@/lib/campaigns";
import { extractSheetId } from "@/lib/sheet/parse";
import type { Character, Member } from "@/lib/types";

const LAST_SHEET_KEY = "trpg-vtt:last-sheet";

export function SheetImport({
  cid,
  user,
  members,
  nextOrder,
  onDone,
}: {
  cid: string;
  user: User;
  members: Member[];
  nextOrder: number;
  onDone: () => void;
}) {
  const [sheetId, setSheetId] = useState(() => {
    try {
      return localStorage.getItem(`${LAST_SHEET_KEY}:${cid}`) ?? "";
    } catch {
      return "";
    }
  });
  const [tab, setTab] = useState("");
  const [kind, setKind] = useState<Character["kind"]>("pc");
  const [ownerUid, setOwnerUid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = extractSheetId(sheetId);
      const sheet = await fetchSheet(user, id, tab.trim());
      await addCharacter(cid, sheet, { kind, ownerUid: kind === "pc" ? ownerUid || null : null, order: nextOrder });
      try {
        localStorage.setItem(`${LAST_SHEET_KEY}:${cid}`, id);
      } catch {}
      setTab("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "시트를 불러오지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-accent/40 bg-panel p-3">
      <h2 className="text-sm font-semibold">구글 시트에서 캐릭터 불러오기</h2>
      <input className="input" placeholder="시트 URL 또는 ID" value={sheetId} onChange={(e) => setSheetId(e.target.value)} />
      <input className="input" placeholder="탭 이름 (= 캐릭터 이름)" value={tab} onChange={(e) => setTab(e.target.value)} />
      <div className="flex gap-2">
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Character["kind"])}>
          <option value="pc">PC</option>
          <option value="npc">NPC · 에너미</option>
        </select>
        {kind === "pc" && (
          <select className="input" value={ownerUid} onChange={(e) => setOwnerUid(e.target.value)}>
            <option value="">담당 플레이어 (나중에)</option>
            {members
              .filter((m) => m.role === "player")
              .map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.name}
                </option>
              ))}
          </select>
        )}
      </div>
      {error && <p className="text-xs text-hp">{error}</p>}
      <button className="btn-primary w-full" disabled={busy || !sheetId.trim() || !tab.trim()}>
        {busy ? "불러오는 중…" : "불러오기"}
      </button>
    </form>
  );
}
