"use client";

import { faceOf, stageImageOf } from "@/lib/characterArt";
import { useEffect, useState, type MouseEvent } from "react";
import { removeCharacter, updateCharacter } from "@/lib/campaigns";
import { findCast, toggleCast } from "@/lib/scene";
import type { Character, Gauge } from "@/lib/types";
import { ArSheetView } from "../ArSheetView";
import { CharacterCard } from "../CharacterCard";
import { useContextMenu, type MenuItem } from "../ContextMenu";
import { CharacterEditDialog, KIND_LABEL } from "./EditDialogs";
import { ResizeHandle, useResizable } from "./Resizable";
import { useSession } from "./SessionContext";

// 어디서든 캐릭터 시트를 열 수 있게 (화자 칩·토큰 우클릭 등)
const OPEN_SHEET = "vtt:open-sheet";
export function openSheet(charId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_SHEET, { detail: charId }));
}

// 아래 왼쪽 파티 띠 — 얼굴 + HP/MP. 누르면 캐릭터 시트, 우클릭하면 고치기·빼기
export function PartyBar() {
  const { cid, characters, user, isGM, scene } = useSession();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const menu = useContextMenu();
  const pcs = characters.filter((c) => c.kind === "pc");
  const others = characters.filter((c) => c.kind !== "pc"); // 플레이어에게는 에너미가 아예 오지 않는다
  const open = characters.find((c) => c.id === openId);
  const editing = characters.find((c) => c.id === editId);

  useEffect(() => {
    const on = (e: Event) => setOpenId((e as CustomEvent<string>).detail);
    window.addEventListener(OPEN_SHEET, on);
    return () => window.removeEventListener(OPEN_SHEET, on);
  }, []);

  function charMenu(c: Character): MenuItem[] {
    const canEdit = isGM || c.ownerUid === user.uid;
    const items: MenuItem[] = [
      { title: `${c.sheet.name} · ${KIND_LABEL[c.kind]}` },
      { label: openId === c.id ? "시트 닫기" : "시트 열기", icon: "📜", onSelect: () => setOpenId(openId === c.id ? null : c.id) },
    ];
    if (canEdit) items.push({ label: "고치기", hint: "그림·색·이름", icon: "✎", onSelect: () => setEditId(c.id) });
    if (isGM) {
      const who = { charId: c.id, name: c.sheet.name, image: stageImageOf(c) };
      const on = !!findCast(scene, who);
      items.push({ label: on ? "무대에서 내리기" : "무대에 계속 세우기", icon: on ? "▼" : "▲", onSelect: () => toggleCast(cid, scene, who) });
      items.push("sep", { title: "종류 바꾸기" });
      for (const k of ["pc", "npc", "enemy"] as const) {
        if (k === c.kind) continue;
        items.push({
          label: k === "enemy" ? "에너미로 (GM만 보기)" : `${KIND_LABEL[k]}로`,
          icon: "⇄",
          onSelect: () => updateCharacter(cid, c.id, { kind: k, ...(k !== "pc" ? { ownerUid: null } : {}) }),
        });
      }
      items.push("sep", {
        label: "캠페인에서 빼기",
        icon: "✕",
        danger: true,
        onSelect: () => {
          if (!confirm(`${c.sheet.name}을(를) 캠페인에서 뺄까요? (보관함 원본은 그대로예요)`)) return;
          if (openId === c.id) setOpenId(null);
          return removeCharacter(cid, c.id);
        },
      });
    }
    return items;
  }

  function othersMenu(): MenuItem[] {
    const items: MenuItem[] = [];
    for (const kind of ["npc", "enemy"] as const) {
      const list = others.filter((c) => c.kind === kind);
      if (!list.length) continue;
      if (items.length) items.push("sep");
      items.push({ title: `${KIND_LABEL[kind]} ${list.length} — 눌러서 시트` });
      for (const c of list) items.push({ label: c.sheet.name, icon: "📜", hint: `HP ${c.hp.cur}/${c.hp.max}`, onSelect: () => setOpenId(c.id) });
    }
    return items;
  }

  return (
    <>
      <div className="chip-row shrink-0 items-end gap-1.5">
        {pcs.map((c) => (
          <PartyChip
            key={c.id}
            c={c}
            mine={c.ownerUid === user.uid}
            active={openId === c.id}
            onClick={() => setOpenId(openId === c.id ? null : c.id)}
            onMenu={(e) => menu.open(e, charMenu(c))}
          />
        ))}
        {others.length > 0 && (
          <button
            className="panel pop flex h-[46px] shrink-0 flex-col items-center justify-center px-2.5 text-[11px] leading-tight"
            title="NPC·에너미 시트 열기"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              menu.open({ clientX: r.left, clientY: r.top - 4 }, othersMenu());
            }}
          >
            <span className="font-bold whitespace-nowrap">{isGM && others.some((c) => c.kind === "enemy") ? "NPC·적" : "NPC"}</span>
            <span className="text-muted">{others.length} ▴</span>
          </button>
        )}
      </div>
      {menu.node}
      {open && <SheetDrawer character={open} onClose={() => setOpenId(null)} onMenu={(e) => menu.open(e, charMenu(open))} />}
      {editing && <CharacterEditDialog character={editing} onClose={() => setEditId(null)} />}
    </>
  );
}

function PartyChip({
  c,
  mine,
  active,
  onClick,
  onMenu,
}: {
  c: Character;
  mine: boolean;
  active: boolean;
  onClick: () => void;
  onMenu: (e: MouseEvent) => void;
}) {
  const face = faceOf(c);
  return (
    <button
      onClick={onClick}
      onContextMenu={onMenu}
      className={`panel pop flex w-40 shrink-0 items-center gap-2 px-2 py-1.5 text-left ${active ? "ring-1 ring-accent" : ""}`}
      title={`${c.sheet.name} 시트 열기 — 우클릭: 고치기·빼기`}
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

function SheetDrawer({ character, onClose, onMenu }: { character: Character; onClose: () => void; onMenu: (e: MouseEvent) => void }) {
  const { cid, user, isGM, members } = useSession();
  const width = useResizable("sheet", 380, 300, 760);
  return (
    <div className="fixed bottom-28 left-3 z-40 max-w-[calc(100vw-24px)] animate-rise-in" style={{ width: width.size }}>
      <ResizeHandle side="right" label="시트 창" {...width} />
      <div className="mb-1 flex justify-end gap-1">
        <button className="btn px-2 py-0.5 text-xs" onClick={onMenu} title="고치기·무대·종류·빼기">
          <span>⋯</span>
        </button>
        <button className="btn px-2 py-0.5 text-xs" onClick={onClose}>
          <span>닫기 ✕</span>
        </button>
      </div>
      <div className="max-h-[calc(100dvh-14rem)] overflow-y-auto rounded-lg shadow-2xl">
        {character.ar ? (
          <ArSheetView character={character} />
        ) : (
          <CharacterCard cid={cid} user={user} character={character} isGM={isGM} members={members} />
        )}
      </div>
    </div>
  );
}
