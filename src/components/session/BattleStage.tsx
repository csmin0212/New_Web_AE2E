"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { moveToken, updateBattleMeta, type Token } from "@/lib/scene";
import { splitTitle } from "@/lib/stage";
import type { Character, Gauge } from "@/lib/types";
import { useSession } from "./SessionContext";

type Unit = Token & { id: string; x: number; y: number; character?: Character };

const SIDE_RING: Record<Token["side"], string> = {
  pc: "var(--accent)",
  ally: "#4fae7c",
  enemy: "#d0463a",
};
const METERS_PER_CELL = 5;

// 전투 모드 — 이니셔티브 띠 + 그리드 + 유닛 HP
export function BattleStage() {
  const { battle, characters, isGM, user, cid } = useSession();
  const { meta } = battle;

  const units: Unit[] = useMemo(
    () =>
      Object.entries(battle.tokens).map(([id, t]) => ({
        ...t,
        id,
        x: battle.pos[id]?.x ?? 0,
        y: battle.pos[id]?.y ?? 0,
        character: t.charId ? characters.find((c) => c.id === t.charId) : undefined,
      })),
    [battle.tokens, battle.pos, characters],
  );
  const order = useMemo(() => [...units].sort((a, b) => b.init - a.init || a.name.localeCompare(b.name)), [units]);
  const current = order.length ? order[((meta.turn % order.length) + order.length) % order.length] : undefined;

  function step(dir: 1 | -1) {
    if (!order.length) return;
    let turn = meta.turn + dir;
    let round = meta.round;
    if (turn >= order.length) {
      turn = 0;
      round += 1;
    } else if (turn < 0) {
      turn = order.length - 1;
      round = Math.max(1, round - 1);
    }
    updateBattleMeta(cid, { turn, round });
  }

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--pattern), var(--bg)" }}>
      {/* 이니셔티브 띠 */}
      <div className="flex items-stretch gap-3 border-b border-line bg-black/40 px-3 py-2">
        <div className="panel flex w-24 shrink-0 flex-col items-center justify-center px-2 py-1">
          <span className="font-latin text-[10px] text-muted">ROUND</span>
          <span className="font-latin text-3xl leading-none text-accent">{String(meta.round).padStart(2, "0")}</span>
        </div>
        <ol className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {order.length === 0 && <li className="text-sm text-muted">{isGM ? "‘연출’ 패널에서 토큰을 올리세요." : "전투 준비 중…"}</li>}
          {order.map((u) => (
            <li
              key={u.id}
              className={`relative flex shrink-0 items-center gap-2 rounded-md border px-2 py-1 transition ${
                current?.id === u.id ? "scale-105 border-accent bg-accent/15" : "border-line bg-panel/80 opacity-80"
              }`}
            >
              <TokenFace unit={u} size={30} />
              <div className="leading-tight">
                <div className="max-w-24 truncate text-xs font-bold">{splitTitle(u.name).name}</div>
                <div className="font-latin text-[10px] text-muted">INIT {u.init}</div>
              </div>
            </li>
          ))}
        </ol>
        {isGM && order.length > 0 && (
          <div className="flex shrink-0 items-center gap-1">
            <button className="btn px-2" onClick={() => step(-1)} aria-label="이전 차례">
              <span>◀</span>
            </button>
            <button className="btn-primary" onClick={() => step(1)}>
              <span>다음 차례 ▶</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <Grid units={units} currentId={current?.id} canMove={(u) => isGM || u.ownerUid === user.uid} onMove={(id, at) => moveToken(cid, id, at)} />
        </div>
        <UnitCards units={order} currentId={current?.id} />
      </div>
    </div>
  );
}

function Grid({
  units,
  currentId,
  canMove,
  onMove,
}: {
  units: Unit[];
  currentId?: string;
  canMove: (u: Unit) => boolean;
  onMove: (id: string, at: { x: number; y: number }) => void;
}) {
  const { battle } = useSession();
  const { cols, rows, background } = battle.meta;
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(40);
  const [drag, setDrag] = useState<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);

  // 화면에 맞게 칸 크기를 정한다
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const pad = 24;
      setCell(Math.max(18, Math.floor(Math.min((e.contentRect.width - pad) / cols, (e.contentRect.height - pad) / rows))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols, rows]);

  function cellAt(clientX: number, clientY: number) {
    const r = gridRef.current!.getBoundingClientRect();
    return {
      x: Math.min(cols - 1, Math.max(0, Math.floor((clientX - r.left) / cell))),
      y: Math.min(rows - 1, Math.max(0, Math.floor((clientY - r.top) / cell))),
    };
  }

  const dragRef = useRef(drag);
  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => setDrag((d) => (d ? { ...d, to: cellAt(e.clientX, e.clientY) } : d));
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      const to = d ? cellAt(e.clientX, e.clientY) : null;
      if (d && to && (to.x !== d.from.x || to.y !== d.from.y)) onMove(d.id, to);
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // cellAt 은 cell·cols·rows 에만 의존
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id, cell, cols, rows, onMove]);

  const dist = drag ? Math.max(Math.abs(drag.to.x - drag.from.x), Math.abs(drag.to.y - drag.from.y)) : 0;

  return (
    <div ref={wrapRef} className="absolute inset-0 grid place-items-center">
      <div
        ref={gridRef}
        className="relative overflow-hidden rounded-sm shadow-[0_20px_60px_rgba(0,0,0,.55)]"
        style={{
          width: cols * cell,
          height: rows * cell,
          backgroundImage: background
            ? `url("${background}")`
            : "radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--accent) 10%, var(--panel-2)), var(--bg))",
          backgroundSize: "cover",
          backgroundPosition: "center",
          outline: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
          outlineOffset: 4,
        }}
      >
        {/* 격자선 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.22) 1px, transparent 1px), linear-gradient(to right, rgba(0,0,0,.35) 2px, transparent 2px), linear-gradient(to bottom, rgba(0,0,0,.35) 2px, transparent 2px)",
            backgroundSize: `${cell}px ${cell}px`,
            backgroundPosition: "0 0, 0 0, -1px 0, 0 -1px",
          }}
        />
        {/* 이동 경로 */}
        {drag && (
          <>
            <div
              className="pointer-events-none absolute border-2 border-dashed border-accent/70"
              style={{ left: drag.from.x * cell, top: drag.from.y * cell, width: cell, height: cell }}
            />
            <div
              className="pointer-events-none absolute grid place-items-center bg-accent/25 ring-2 ring-accent"
              style={{ left: drag.to.x * cell, top: drag.to.y * cell, width: cell, height: cell }}
            >
              <span className="rounded bg-black/80 px-1.5 text-[11px] font-bold whitespace-nowrap text-white">
                {dist}칸 · {dist * METERS_PER_CELL}m
              </span>
            </div>
          </>
        )}
        {units.map((u) => {
          const at = drag?.id === u.id ? drag.to : u;
          const movable = canMove(u);
          return (
            <div
              key={u.id}
              className={`absolute flex flex-col items-center transition-[left,top] duration-200 ${movable ? "cursor-grab active:cursor-grabbing" : ""} ${
                drag?.id === u.id ? "z-20 opacity-90" : "z-10"
              }`}
              style={{ left: at.x * cell, top: at.y * cell, width: cell, height: cell, touchAction: "none" }}
              onPointerDown={(e) => {
                if (!movable) return;
                e.preventDefault();
                setDrag({ id: u.id, from: { x: u.x, y: u.y }, to: { x: u.x, y: u.y } });
              }}
              title={u.name}
            >
              <TokenFace unit={u} size={cell - 6} active={currentId === u.id} />
              <HpBar gauge={u.character?.hp ?? u.hp} width={cell - 8} />
              {cell >= 34 && (
                <span className="pointer-events-none absolute top-full mt-1 max-w-[140%] truncate rounded-sm bg-black/75 px-1 text-[10px] leading-4 text-white">
                  {splitTitle(u.name).name}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TokenFace({ unit, size, active }: { unit: Unit; size: number; active?: boolean }) {
  const img = unit.image ?? unit.character?.portrait ?? unit.character?.standing;
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full bg-panel-2"
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 0 2px ${SIDE_RING[unit.side]}, 0 3px 8px rgba(0,0,0,.6)${active ? ", 0 0 0 5px rgba(255,255,255,.35), 0 0 18px var(--accent)" : ""}`,
      }}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="h-full w-full object-cover object-top" draggable={false} />
      ) : (
        <span className="font-display grid h-full w-full place-items-center text-sm font-bold" style={{ color: SIDE_RING[unit.side] }}>
          {splitTitle(unit.name).name.slice(0, 1)}
        </span>
      )}
    </div>
  );
}

function HpBar({ gauge, width }: { gauge?: Gauge; width: number }) {
  if (!gauge || gauge.max <= 0) return null;
  const pct = Math.max(0, Math.min(100, (gauge.cur / gauge.max) * 100));
  return (
    <div className="pointer-events-none absolute -bottom-0.5 h-1.5 overflow-hidden rounded-full bg-black/70" style={{ width }}>
      <div className="h-full bg-hp" style={{ width: `${pct}%` }} />
    </div>
  );
}

// 그리드 오른쪽 유닛 카드 열 (레퍼런스의 HP 카드 묶음). 그리드를 가리지 않게 따로 세운다
function UnitCards({ units, currentId }: { units: Unit[]; currentId?: string }) {
  if (units.length === 0) return null;
  return (
    <div className="hidden w-52 shrink-0 flex-col gap-1.5 overflow-y-auto border-l border-line/60 bg-black/20 p-2 md:flex">
      <div className="font-latin px-1 text-[10px] text-muted">UNITS</div>
      {units.map((u) => {
          const hp = u.character?.hp ?? u.hp;
          const mp = u.character?.mp;
          return (
            <div
              key={u.id}
              className={`panel flex w-full items-center gap-2 px-2 py-1.5 animate-rise-in ${currentId === u.id ? "ring-1 ring-accent" : ""}`}
              style={{ borderLeft: `3px solid ${SIDE_RING[u.side]}` }}
            >
              <TokenFace unit={u} size={30} active={currentId === u.id} />
              <div className="min-w-0 flex-1 text-[11px]">
                <div className="truncate font-bold">{splitTitle(u.name).name}</div>
                {hp && <MiniGauge label="HP" g={hp} color="bg-hp" />}
                {mp && <MiniGauge label="MP" g={mp} color="bg-mp" />}
              </div>
            </div>
          );
        })}
    </div>
  );
}

function MiniGauge({ label, g, color }: { label: string; g: Gauge; color: string }) {
  const pct = g.max > 0 ? Math.max(0, Math.min(100, (g.cur / g.max) * 100)) : 0;
  return (
    <div className="flex items-center gap-1">
      <span className="font-latin w-5 text-[9px] text-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/60">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right tabular-nums">
        {g.cur}/{g.max}
      </span>
    </div>
  );
}
