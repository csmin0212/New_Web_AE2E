"use client";

import type { User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { addEntryToCampaign, type LibraryEntry } from "@/lib/library";
import type { Character } from "@/lib/types";

type MyCampaign = { id: string; name: string };

// 보관함 캐릭터를 내가 GM 인 캠페인에 넣는다 (사본이 들어가고, 보관함 원본은 그대로)
export function AddToCampaign({ user, entries, onClose }: { user: User; entries: LibraryEntry[]; onClose: () => void }) {
  const [campaigns, setCampaigns] = useState<MyCampaign[]>([]);
  const [cid, setCid] = useState("");
  const [kindMode, setKindMode] = useState<"auto" | Character["kind"]>("auto");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onSnapshot(query(collection(db, "users", user.uid, "campaigns"), where("role", "==", "gm")), (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, name: (d.data() as { name: string }).name }));
        setCampaigns(list);
        setCid((cur) => cur || list[0]?.id || "");
      }),
    [user.uid],
  );

  async function add() {
    setBusy(true);
    setError(null);
    try {
      let order = Date.now();
      for (const e of entries) {
        const kind: Character["kind"] = kindMode === "auto" ? e.kind : kindMode;
        await addEntryToCampaign(cid, e, { kind, ownerUid: null, order: order++ });
      }
      setResult(`${entries.length}명을 「${campaigns.find((c) => c.id === cid)?.name}」에 넣었어요.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "넣지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="캠페인에 넣기">
      <div className="panel w-full max-w-md space-y-3 p-5">
        <h2 className="font-display text-lg font-bold">캠페인에 넣기</h2>
        <p className="text-xs text-muted">
          {entries.map((e) => e.name).join(", ")} — 보관함 원본은 그대로 두고 사본이 들어가요. HP·MP는 최대치로 시작해요.
        </p>
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted">내가 GM인 캠페인이 없어요.</p>
        ) : (
          <>
            <label className="block text-xs text-muted">
              캠페인
              <select className="input mt-1" value={cid} onChange={(e) => setCid(e.target.value)}>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted">
              어디로
              <select className="input mt-1" value={kindMode} onChange={(e) => setKindMode(e.target.value as typeof kindMode)}>
                <option value="auto">자동 (보관함 종류 그대로)</option>
                <option value="pc">모두 파티(PC)</option>
                <option value="npc">모두 NPC (모두 볼 수 있음)</option>
                <option value="enemy">모두 에너미 (GM만 볼 수 있음)</option>
              </select>
            </label>
            <p className="text-[11px] text-muted">PC 담당 플레이어는 캠페인 안에서 캐릭터 메뉴로 정해요.</p>
          </>
        )}
        {error && <p className="text-xs text-hp">{error}</p>}
        {result && (
          <p className="text-xs text-accent">
            {result}{" "}
            <Link className="underline" href={`/c/${cid}`}>
              캠페인으로 가기
            </Link>
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>
            <span>{result ? "닫기" : "취소"}</span>
          </button>
          {!result && (
            <button className="btn-primary" disabled={busy || !cid} onClick={add}>
              <span>{busy ? "넣는 중…" : `${entries.length}명 넣기`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
