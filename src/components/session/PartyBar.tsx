"use client";

import { useState } from "react";
import type { Character, Gauge } from "@/lib/types";
import { CharacterCard } from "../CharacterCard";
import { useSession } from "./SessionContext";

// 아래 왼쪽 파티 띠 — 얼굴 + HP/MP. 누르면 캐릭터 시트가 열린다
export function PartyBar() {
  const { characters, user } = useSession();
  const [openId, setOpenId] = useState<string | null>(null);
  const pcs = characters.filter((c) => c.kind === "pc");
  const npcs = characters.filter((c) => c.kind === "npc");
  const open = characters.find((c) => c.id === openId);

  return (
    <>
      <div className="flex shrink-0 items-end gap-1.5 overflow-x-auto">
        {pcs.map((c) => (
          <PartyChip key={c.id} c={c} mine={c.ownerUid === user.uid} active={openId === c.id} onClick={() => setOpenId(openId === c.id ? null : c.id)} />
        ))}
        {npcs.length > 0 && (
          <select
            className="input h-9 w-auto py-0 text-xs"
            value=""
            onChange={(e) => setOpenId(e.target.value || null)}
            aria-label="NPC 시트 열기"
          >
            <option value="">NPC {npcs.length}</option>
            {npcs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.sheet.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {open && <SheetDrawer character={open} onClose={() => setOpenId(null)} />}
    </>
  );
}

function PartyChip({ c, mine, active, onClick }: { c: Character; mine: boolean; active: boolean; onClick: () => void }) {
  const face = c.portrait ?? c.standing;
  return (
    <button
      onClick={onClick}
      className={`panel flex w-40 shrink-0 items-center gap-2 px-2 py-1.5 text-left transition hover:-translate-y-0.5 ${active ? "ring-1 ring-accent" : ""}`}
      title={`${c.sheet.name} 시트 열기`}
    >
      <div className="relative">
        {face ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={face} alt="" className="h-9 w-9 rounded-full border border-line object-cover object-top" />
        ) : (
          <div className="font-display grid h-9 w-9 place-items-center rounded-full border border-line bg-panel-2 text-accent">{c.sheet.name.slice(0, 1)}</div>
        )}
        {mine && <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border border-bg bg-accent" title="내 캐릭터" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display truncate text-xs font-bold">{c.sheet.name}</div>
        <Bar g={c.hp} color="bg-hp" />
        <Bar g={c.mp} color="bg-mp" />
      </div>
    </button>
  );
}

function Bar({ g, color }: { g: Gauge; color: string }) {
  const pct = g.max > 0 ? Math.max(0, Math.min(100, (g.cur / g.max) * 100)) : 0;
  return (
    <div className="mt-0.5 flex items-center gap-1">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/60">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-11 text-right text-[10px] text-muted tabular-nums">
        {g.cur}/{g.max}
      </span>
    </div>
  );
}

function SheetDrawer({ character, onClose }: { character: Character; onClose: () => void }) {
  const { cid, user, isGM, members } = useSession();
  return (
    <div className="fixed bottom-24 left-3 z-40 w-[min(380px,calc(100vw-24px))] animate-rise-in">
      <div className="mb-1 flex justify-end">
        <button className="btn px-2 py-0.5 text-xs" onClick={onClose}>
          <span>닫기 ✕</span>
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto rounded-lg shadow-2xl">
        <CharacterCard cid={cid} user={user} character={character} isGM={isGM} members={members} />
      </div>
    </div>
  );
}
