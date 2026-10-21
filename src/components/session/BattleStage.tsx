"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { setTurn } from "@/lib/battle";
import { CONDITION_LABEL, endTurn, giveTurn, initiativeOrder, startBattle } from "@/lib/battleRules";
import { moveToken, removeToken, updateToken, type Token } from "@/lib/scene";
import { splitTitle } from "@/lib/stage";
import type { Character, Gauge } from "@/lib/types";
import { useContextMenu, type MenuItem } from "../ContextMenu";
import { ActionDock } from "./ActionDock";
import { openSheet } from "./PartyBar";
import { useSession } from "./SessionContext";

type Unit = Token & { id: string; x: number; y: number; character?: Character };

const SIDE_RING: Record<Token["side"], string> = {
  pc: "var(--accent)",
  ally: "#4fae7c",
  enemy: "#d0463a",
};
const METERS_PER_CELL = 5;

// 전투 모드 — 행동 순서 띠 + 그리드 + 유닛 카드 + (내 차례면) 행동 바
export function BattleStage() {
  const { battle, characters, isGM, user, cid } = useSession();
  const turn = battle.turn;
  const menu = useContextMenu();

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
  const order = useMemo(() => initiativeOrder(units), [units]);
  const current = units.find((u) => u.id === turn.actor);

  // 조작 권한: GM 은 전부, 플레이어는 자기 토큰
  const canControl = (u: Unit) => isGM || (!!u.ownerUid && u.ownerUid === user.uid);
  // 차례가 오면 행동 바가 저절로 열리는 유닛: 플레이어는 자기 것, GM 은 주인 없는 유닛(에너미 등)
  const autoDock = (u: Unit) => (u.ownerUid ? u.ownerUid === user.uid : isGM);
  const canEnd = !!current && (isGM || current.ownerUid === user.uid);

  const [dockPick, setDockPick] = useState<string | null>(null); // 직접 고른 유닛 (차례가 아니어도 — 리액션·인터럽트 스킬)
  const [dockClosedFor, setDockClosedFor] = useState<string | null>(null);
  const dockUnit =
    (dockPick ? units.find((u) => u.id === dockPick && canControl(u)) : undefined) ??
    (current && autoDock(current) && dockClosedFor !== current.id ? current : undefined);

  // 대상은 행동 바 주인이 바뀌면 비운다 (상태를 주인 id 와 묶어 둔다)
  const [targetState, setTargetState] = useState<{ owner: string | null; ids: string[] }>({ owner: null, ids: [] });
  const targetIds = targetState.owner === (dockUnit?.id ?? null) ? targetState.ids : [];
  function toggleTarget(id: string) {
    const ids = targetIds.includes(id) ? targetIds.filter((x) => x !== id) : [...targetIds, id];
    setTargetState({ owner: dockUnit?.id ?? null, ids });
  }
  const targets = targetIds.map((id) => units.find((u) => u.id === id)).filter((u): u is Unit => !!u);

  function finishTurn() {
    if (!order.length) return;
    setDockPick(null);
    setTurn(cid, turn.actor ? endTurn(order, turn) : startBattle(order));
  }

  function unitMenu(e: MouseEvent, u: Unit) {
    const items: MenuItem[] = [{ title: splitTitle(u.name).name + (turn.acted[u.id] ? " · 행동 끝" : "") }];
    if (u.character) items.push({ label: "시트 열기", icon: "📜", onSelect: () => openSheet(u.character!.id) });
    if (canControl(u))
      items.push({
        label: "행동하기",
        hint: "공격·스킬·아이템",
        icon: "⚔",
        onSelect: () => {
          setDockPick(u.id);
          setDockClosedFor(null);
        },
      });
    if (dockUnit && dockUnit.id !== u.id)
      items.push({ label: targetIds.includes(u.id) ? "대상에서 빼기" : "대상으로 지정", icon: "◎", onSelect: () => toggleTarget(u.id) });
    if (isGM) {
      items.push("sep");
      if (turn.actor !== u.id) items.push({ label: "이 유닛 차례로", icon: "▶", onSelect: () => setTurn(cid, giveTurn(turn, u.id)) });
      items.push({
        label: "행동치 바꾸기",
        hint: String(u.init),
        icon: "⇅",
        onSelect: () => {
          const v = prompt(`${u.name} 행동치`, String(u.init));
          if (v != null && v.trim() !== "" && Number.isFinite(Number(v))) return updateToken(cid, u.id, { init: Math.trunc(Number(v)) });
        },
      });
      items.push({ label: "토큰 빼기", icon: "✕", danger: true, onSelect: () => removeToken(cid, u.id) });
    }
    menu.open(e, items);
  }

  const gmPassing = isGM && current?.ownerUid && current.ownerUid !== user.uid;

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--pattern), var(--bg)" }}>
      {/* 행동 순서 띠 */}
      <div className="flex items-stretch gap-3 border-b border-line bg-black/40 px-3 py-2">
        <div className="panel flex w-24 shrink-0 flex-col items-center justify-center px-2 py-1">
          <span className="font-latin text-[10px] text-muted">ROUND</span>
          <span className="font-latin text-3xl leading-none text-accent">{String(turn.round).padStart(2, "0")}</span>
        </div>
        <ol className="chip-row min-w-0 flex-1 items-center gap-2">
          {order.length === 0 && <li className="text-sm text-muted">{isGM ? "‘연출’ 패널에서 토큰을 올리세요." : "전투 준비 중…"}</li>}
          {order.map((u) => {
            const now = turn.actor === u.id;
            const done = !!turn.acted[u.id];
            return (
              <li key={u.id} className="shrink-0">
                <button
                  className={`pop relative flex items-center gap-2 rounded-md border px-2 py-1 text-left ${
                    now ? "border-accent bg-accent/20" : done ? "border-line bg-panel/50 opacity-45" : "border-line bg-panel/80"
                  }`}
                  onClick={() => isGM && setTurn(cid, giveTurn(turn, u.id))}
                  onContextMenu={(e) => unitMenu(e, u)}
                  title={isGM ? "눌러서 이 유닛 차례로 · 우클릭 메뉴" : "우클릭 메뉴"}
                >
                  <TokenFace unit={u} size={30} active={now} />
                  <div className="leading-tight">
                    <div className="max-w-24 truncate text-xs font-bold">{splitTitle(u.name).name}</div>
                    <div className="font-latin text-[10px] text-muted">
                      INIT {u.init}
                      {done && " ✓"}
                    </div>
                  </div>
                  {now && <span className="font-latin absolute -top-2 left-1.5 rounded-sm bg-accent px-1 text-[9px] leading-3 text-accent-ink">NOW</span>}
                </button>
              </li>
            );
          })}
        </ol>
        {order.length > 0 && (
          <div className="flex shrink-0 flex-col items-end justify-center gap-0.5">
            {current && <span className="text-[11px] whitespace-nowrap text-muted">{splitTitle(current.name).name}의 차례</span>}
            {!turn.actor && isGM && (
              <button className="btn-primary pop" onClick={finishTurn}>
                <span>전투 개시 ▶</span>
              </button>
            )}
            {turn.actor && canEnd && (
              <button className={`${gmPassing ? "btn" : "btn-primary"} pop`} onClick={finishTurn} title={gmPassing ? "플레이어 대신 차례를 넘겨요" : undefined}>
                <span>{gmPassing ? "다음 차례 ▶" : "행동 종료 ▶"}</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <Grid
            units={units}
            currentId={turn.actor ?? undefined}
            targetIds={targetIds}
            picking={!!dockUnit}
            canMove={canControl}
            onMove={(id, at) => moveToken(cid, id, at)}
            onPick={(u) => {
              if (dockUnit && u.id !== dockUnit.id) toggleTarget(u.id);
            }}
            onMenu={unitMenu}
          />
          {dockUnit && (
            <ActionDock
              key={dockUnit.id}
              unit={dockUnit}
              targets={targets.map((t) => ({ id: t.id, name: t.name, charId: t.charId }))}
              onRemoveTarget={toggleTarget}
              onClose={() => {
                setDockPick(null);
                if (current) setDockClosedFor(current.id);
              }}
            />
          )}
        </div>
        <UnitCards units={order} currentId={turn.actor ?? undefined} onMenu={unitMenu} />
      </div>
      {menu.node}
    </div>
  );
}

function Grid({
  units,
  currentId,
  targetIds,
  picking,
  canMove,
  onMove,
  onPick,
  onMenu,
}: {
  units: Unit[];
  currentId?: string;
  targetIds: string[];
  picking: boolean;
  canMove: (u: Unit) => boolean;
  onMove: (id: string, at: { x: number; y: number }) => void;
  onPick: (u: Unit) => void;
  onMenu: (e: MouseEvent, u: Unit) => void;
}) {
  const { battle, isGM } = useSession();
  const { cols, rows, background } = battle.meta;
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false); // 끌어서 옮긴 직후의 click 은 대상 지정으로 치지 않는다
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
      const moved = !!(d && to && (to.x !== d.from.x || to.y !== d.from.y));
      movedRef.current = moved;
      if (moved) onMove(d!.id, to!);
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
          const targeted = targetIds.includes(u.id);
          // 플레이어에게는 에너미 시트가 오지 않으므로 HP 막대 대신 상태만
          const hp = u.character?.hp ?? (isGM ? u.hp : undefined);
          return (
            <div
              key={u.id}
              className={`absolute flex flex-col items-center transition-[left,top] duration-200 ${
                movable ? "cursor-grab active:cursor-grabbing" : picking ? "cursor-crosshair" : ""
              } ${drag?.id === u.id ? "z-20 opacity-90" : "z-10"} ${u.cond === "down" ? "grayscale" : ""}`}
              style={{ left: at.x * cell, top: at.y * cell, width: cell, height: cell, touchAction: "none" }}
              onPointerDown={(e) => {
                movedRef.current = false;
                if (!movable || e.button !== 0) return;
                e.preventDefault();
                setDrag({ id: u.id, from: { x: u.x, y: u.y }, to: { x: u.x, y: u.y } });
              }}
              onClick={() => {
                if (movedRef.current) return;
                onPick(u);
              }}
              onContextMenu={(e) => onMenu(e, u)}
              title={picking ? `${u.name} — 눌러서 대상 지정` : u.name}
            >
              <TokenFace unit={u} size={cell - 6} active={currentId === u.id} />
              {targeted && <span className="target-ring pointer-events-none absolute inset-[-3px] rounded-full" />}
              <HpBar gauge={hp} width={cell - 8} />
              {u.cond && (
                <span
                  className={`pointer-events-none absolute -top-1.5 -right-2 rounded-sm px-1 text-[9px] leading-[13px] font-bold whitespace-nowrap ${
                    u.cond === "down" ? "bg-black text-hp" : "bg-hp text-white"
                  }`}
                >
                  {CONDITION_LABEL[u.cond]}
                </span>
              )}
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
  const img = unit.image ?? unit.character?.token ?? unit.character?.portrait ?? unit.character?.standing;
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
function UnitCards({ units, currentId, onMenu }: { units: Unit[]; currentId?: string; onMenu: (e: MouseEvent, u: Unit) => void }) {
  const { isGM } = useSession();
  if (units.length === 0) return null;
  return (
    <div className="hidden w-52 shrink-0 flex-col gap-1.5 overflow-y-auto border-l border-line/60 bg-black/20 p-2 md:flex">
      <div className="font-latin px-1 text-[10px] text-muted">UNITS</div>
      {units.map((u) => {
        const hp = u.character?.hp ?? (isGM ? u.hp : undefined);
        const mp = u.character?.mp;
        return (
          <div
            key={u.id}
            className={`panel flex w-full items-center gap-2 px-2 py-1.5 animate-rise-in ${currentId === u.id ? "ring-1 ring-accent" : ""} ${u.cond === "down" ? "opacity-50" : ""}`}
            style={{ borderLeft: `3px solid ${SIDE_RING[u.side]}` }}
            onContextMenu={(e) => onMenu(e, u)}
          >
            <TokenFace unit={u} size={30} active={currentId === u.id} />
            <div className="min-w-0 flex-1 text-[11px]">
              <div className="truncate font-bold">{splitTitle(u.name).name}</div>
              {hp && <MiniGauge label="HP" g={hp} color="bg-hp" />}
              {mp && mp.max > 0 && <MiniGauge label="MP" g={mp} color="bg-mp" />}
              {!hp && <div className="text-muted">{u.cond ? CONDITION_LABEL[u.cond] : u.side === "enemy" ? "상태 ?" : ""}</div>}
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
