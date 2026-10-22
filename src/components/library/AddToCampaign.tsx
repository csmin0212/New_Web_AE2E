"use client";

import type { User } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { addEntryToCampaign, type LibraryEntry } from "@/lib/library";
import type { Character } from "@/lib/types";

type MyCampaign = { id: string; name: string; role: "gm" | "player" };

// 보관함 캐릭터를 내 캠페인에 넣는다 (사본이 들어가고, 보관함 원본은 그대로)
//   GM: 아무 종류로나 / 플레이어: 내 PC 로만 (담당이 나로 정해진다)
export function AddToCampaign({ user, entries, onClose }: { user: User; entries: LibraryEntry[]; onClose: () => void }) {
  const [campaigns, setCampaigns] = useState<MyCampaign[]>([]);
  const [cid, setCid] = useState("");
  const [kindMode, setKindMode] = useState<"auto" | Character["kind"]>("auto");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onSnapshot(collection(db, "users", user.uid, "campaigns"), (snap) => {
        const list = snap.docs.map((d) => {
          const v = d.data() as { name: string; role?: "gm" | "player" };
          return { id: d.id, name: v.name, role: v.role ?? "player" };
        });
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
      const asPlayer = campaigns.find((c) => c.id === cid)?.role !== "gm";
      for (const e of entries) {
        if (asPlayer) {
          await addEntryToCampaign(cid, e, { kind: "pc", ownerUid: user.uid, order: order++ });
          continue;
        }
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
          <p className="text-sm text-muted">참가한 캠페인이 없어요. 홈에서 초대 코드로 먼저 참가하세요.</p>
        ) : (
          <>
            <label className="block text-xs text-muted">
              캠페인
              <select className="input mt-1" value={cid} onChange={(e) => setCid(e.target.value)}>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.role === "gm" ? "(GM)" : "(플레이어)"}
                  </option>
                ))}
              </select>
            </label>
            {campaigns.find((c) => c.id === cid)?.role !== "gm" ? (
              <p className="rounded border border-accent/40 bg-accent/10 px-2 py-1 text-[11px]">플레이어로 참가한 캠페인이라 <b>내 PC</b>로 들어가요. 들어간 뒤에는 세션에서 그림·색을 바꿀 수 있어요.</p>
            ) : (
            <>
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
