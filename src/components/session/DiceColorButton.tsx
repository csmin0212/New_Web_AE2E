"use client";

import { useEffect, useRef, useState } from "react";
import { DICE_PALETTE, onDiceColor, readDiceColor, writeDiceColor } from "@/lib/diceColor";
import { useContextMenu, type MenuItem } from "../ContextMenu";

// 채팅 입력 옆 — 내 주사위 색 고르기. 고른 색은 내가 굴린 주사위에 실려서 모두의 화면에 그 색으로
export function DiceColorButton() {
  const [color, setColor] = useState<string | undefined>(() => (typeof window === "undefined" ? undefined : readDiceColor()));
  const menu = useContextMenu();
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => onDiceColor(() => setColor(readDiceColor())), []);

  function items(): MenuItem[] {
    return [
      { title: "내 주사위 색 (모두에게 보임)" },
      { label: "테마 색 따르기", icon: color ? "" : "✓", onSelect: () => writeDiceColor(undefined) },
      "sep",
      ...DICE_PALETTE.map(
        (p): MenuItem => ({
          label: p.label,
          icon: <span style={{ color: p.color }}>{color === p.color ? "◉" : "●"}</span>,
          onSelect: () => writeDiceColor(p.color),
        }),
      ),
      "sep",
      { label: "직접 고르기…", icon: "🎨", onSelect: () => picker.current?.click() },
    ];
  }

  return (
    <>
      <button
        className="btn shrink-0 px-2"
        title="내 주사위 색"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          menu.open({ clientX: r.left, clientY: r.top - 4 }, items());
        }}
      >
        <span
          className="block h-4 w-4 rounded-full border border-black/30"
          style={{ background: color ?? "linear-gradient(135deg, var(--accent) 50%, var(--panel-2) 50%)" }}
        />
      </button>
      <input ref={picker} type="color" className="sr-only" value={color ?? "#2aa7ff"} onChange={(e) => writeDiceColor(e.target.value)} aria-label="주사위 색 직접 고르기" />
      {menu.node}
    </>
  );
}
