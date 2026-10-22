"use client";

import { useState } from "react";
import { CLEAR_LABEL, statusDefs, type BsDef } from "@/lib/battleRules";
import type { StatusPick } from "@/lib/battle";
import { Modal } from "./EditDialogs";
import { useSession } from "./SessionContext";

export type BsPickAction = { label: string; primary?: boolean; onPick: (list: StatusPick[]) => void | Promise<void> };

// BS 고르기 — 여러 개를 한 번에, 강도는 숫자로. 버튼(지금 걸기 / 대미지와 함께 …)은 부르는 쪽이 정한다
export function BsPickDialog({
  title,
  note,
  initial = [],
  actions,
  onClose,
}: {
  title: string;
  note?: string;
  initial?: StatusPick[];
  actions: BsPickAction[];
  onClose: () => void;
}) {
  const { battle } = useSession();
  const defs = statusDefs(battle.statusDefs);
  const [picked, setPicked] = useState<Record<string, number>>(() => Object.fromEntries(initial.map((p) => [p.id, p.strength])));
  const [busy, setBusy] = useState(false);

  const toggle = (b: BsDef) =>
    setPicked((p) => {
      const next = { ...p };
      if (b.id in next) delete next[b.id];
      else next[b.id] = 1;
      return next;
    });
  const setStrength = (id: string, n: number) => setPicked((p) => ({ ...p, [id]: Math.max(1, Math.min(20, n || 1)) }));

  const list: StatusPick[] = defs.filter((b) => b.id in picked).map((b) => ({ id: b.id, label: b.label, strength: b.strength ? picked[b.id] : 1, stack: !!b.strength }));

  async function go(a: BsPickAction) {
    setBusy(true);
    try {
      await a.onPick(list);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose} width={560}>
      {note && <p className="mb-2 text-xs text-muted">{note}</p>}
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {defs.map((b) => {
          const on = b.id in picked;
          return (
            <li key={b.id}>
              <div
                className={`flex h-full cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                  on ? "border-accent bg-accent/15" : "border-line bg-panel-2/60 hover:border-accent/50"
                }`}
                onClick={() => toggle(b)}
                role="checkbox"
                aria-checked={on}
              >
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: b.color }}>
                  {on ? "✓" : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <b className="text-[13px]">{b.label}</b>
                    {b.custom && <span className="rounded bg-panel px-1 text-[9px] text-muted">직접 만든 것</span>}
                    {b.strength && on && (
                      <span className="ml-auto flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button className="btn px-1.5 py-0 text-[11px]" onClick={() => setStrength(b.id, picked[b.id] - 1)} aria-label="강도 내리기">
                          <span>−</span>
                        </button>
                        <input
                          className="input w-10 py-0 text-center text-[12px] tabular-nums"
                          inputMode="numeric"
                          value={picked[b.id]}
                          onChange={(e) => setStrength(b.id, parseInt(e.target.value.replace(/[^\d]/g, ""), 10))}
                          aria-label={`${b.label} 강도`}
                        />
                        <button className="btn px-1.5 py-0 text-[11px]" onClick={() => setStrength(b.id, picked[b.id] + 1)} aria-label="강도 올리기">
                          <span>+</span>
                        </button>
                      </span>
                    )}
                    {b.strength && !on && <span className="ml-auto text-[10px] text-muted">강도</span>}
                  </div>
                  <div className="text-[11px] leading-snug text-muted">{b.hint.split(" · ")[0]}</div>
                  <div className="text-[10px] text-accent/90">{b.clear ? `${CLEAR_LABEL[b.clear]} 저절로 풀림` : "직접 풀기 (액션·회복 스킬)"}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
        <span className="min-w-0 flex-1 truncate text-xs text-muted">
          {list.length ? list.map((p) => (p.stack ? `${p.label} ${p.strength}` : p.label)).join(" · ") : "걸 상태를 눌러 고르세요 (여러 개 가능)"}
        </span>
        <button className="btn px-3 py-1 text-xs" onClick={onClose}>
          <span>취소</span>
        </button>
        {actions.map((a) => (
          <button key={a.label} className={`${a.primary ? "btn-primary" : "btn"} px-3 py-1 text-xs`} disabled={busy || (!list.length && !initial.length)} onClick={() => go(a)}>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
