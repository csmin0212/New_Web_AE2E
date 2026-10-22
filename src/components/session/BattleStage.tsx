"use client";

import { tokenImageOf } from "@/lib/characterArt";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { setTurn } from "@/lib/battle";
import { derive } from "@/lib/ar/derive";
import { BAD_STATUS, CONDITION_LABEL, effectiveInit, endTurn, giveTurn, initiativeOrder, startBattle, type StatusMap } from "@/lib/battleRules";
import { cellDistance, clearPointer, METERS_PER_CELL, setPointer, subscribePointers, type Cell, type Pointer } from "@/lib/pointer";
import { moveToken, removeToken, setTokenSize, setTokenStatus, updateToken, type Token } from "@/lib/scene";
import { splitTitle } from "@/lib/stage";
import type { Character, Gauge } from "@/lib/types";
import { useContextMenu, type MenuItem } from "../ContextMenu";
import { paintCells, terrainDefsOf } from "@/lib/battleMaps";
import { canPlace, cellKey, TERRAIN_EFFECT_LABEL } from "@/lib/terrain";
import { ActionDock } from "./ActionDock";
import { TerrainPalette } from "./TerrainPalette";
import { openSheet } from "./PartyBar";
import { useSession } from "./SessionContext";

type Unit = Token & { id: string; x: number; y: number; baseInit: number; character?: Character };
type Tool = "move" | "ruler" | "ping" | "paint";

const SIDE_RING: Record<Token["side"], string> = {
  pc: "var(--accent)",
  ally: "#4fae7c",
  enemy: "#d0463a",
};

// 전투 모드 — 행동 순서 띠 + 그리드 + 유닛 카드 + (내 차례면) 행동 바
export function BattleStage() {
  const { battle, characters, isGM, user, cid } = useSession();
  const turn = battle.turn;
  const menu = useContextMenu();
  const [tool, setTool] = useState<Tool>("move");
  const [brush, setBrush] = useState<string | null>("wall");

  const units: Unit[] = useMemo(
    () =>
      Object.entries(battle.tokens).map(([id, t]) => ({
        ...t,
        id,
        init: effectiveInit(t.init, t.status), // 넉백만큼 늦게
        baseInit: t.init,
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
    if (canControl(u)) {
      const size = u.size ?? 1;
      items.push({ title: "토큰 크기" });
      for (const n of [1, 2, 3, 4]) {
        items.push({ label: `${n}×${n} 칸`, icon: size === n ? "✓" : "", onSelect: () => setTokenSize(cid, u.id, n) });
      }
      items.push("sep");
      const on = Object.keys(u.status ?? {}).length;
      items.push({ label: "상태 이상…", hint: on ? `${on}개` : undefined, icon: "☠", onSelect: () => menu.open(e, statusMenu(u)) });
    }
    if (isGM) {
      items.push("sep");
      if (turn.actor !== u.id) items.push({ label: "이 유닛 차례로", icon: "▶", onSelect: () => setTurn(cid, giveTurn(turn, u.id)) });
      items.push({
        label: "행동치 바꾸기",
        hint: String(u.init),
        icon: "⇅",
        onSelect: () => {
          const v = prompt(`${u.name} 행동치 (넉백 전)`, String(u.baseInit));
          if (v != null && v.trim() !== "" && Number.isFinite(Number(v))) return updateToken(cid, u.id, { init: Math.trunc(Number(v)) });
        },
      });
      items.push({ label: "토큰 빼기", icon: "✕", danger: true, onSelect: () => removeToken(cid, u.id) });
    }
    menu.open(e, items);
  }

  // 배드 스테이터스 켜고 끄기 — 강도가 있는 것은 켤 때 강도를 묻는다
  function statusMenu(u: Unit): MenuItem[] {
    const cur: StatusMap = u.status ?? {};
    const items: MenuItem[] = [{ title: `${splitTitle(u.name).name} · 배드 스테이터스` }];
    for (const b of BAD_STATUS) {
      const v = cur[b.id];
      items.push({
        label: b.label + (v && b.strength ? ` ${v}` : ""),
        hint: b.hint.split(" · ")[0],
        icon: v ? "✓" : <span style={{ color: b.color }}>●</span>,
        onSelect: () => {
          const next = { ...cur };
          if (v) delete next[b.id];
          else {
            const n = b.strength ? parseInt(prompt(`${b.label} 강도`, "1") ?? "", 10) : 1;
            if (!Number.isFinite(n) || n < 1) return;
            next[b.id] = Math.min(20, n);
          }
          return setTokenStatus(cid, u.id, next);
        },
      });
    }
    if (Object.keys(cur).length) items.push("sep", { label: "모두 풀기", icon: "✕", onSelect: () => setTokenStatus(cid, u.id, {}) });
    return items;
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
                      {u.init !== u.baseInit && <span className="text-hp"> ↓</span>}
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
          <div className="absolute top-2 left-2 z-20 flex overflow-hidden rounded-md border border-line bg-panel/90 text-xs shadow-lg" role="toolbar" aria-label="그리드 도구">
            {(
              [
                ["move", "✋", "이동 — 토큰 끌어 옮기기"],
                ["ruler", "📏", "자 — 누른 채 끌어서 거리 재기 · 끄는 중 우클릭으로 꺾기 (모두에게 보임)"],
                ["ping", "📍", "핑 — 눌러서 모두에게 위치 알리기 (Alt+클릭도 됨)"],
                ...(isGM ? ([["paint", "🖌", "지형 칠하기 — 벽·험지·피해 지형 (GM)"]] as const) : []),
              ] as const
            ).map(([t, icon, hint]) => (
              <button key={t} className={`px-2.5 py-1.5 ${tool === t ? "bg-accent text-accent-ink" : "hover:bg-panel-2"}`} title={hint} onClick={() => setTool(t)}>
                {icon}
              </button>
            ))}
          </div>
          {tool === "paint" && isGM && <TerrainPalette brush={brush} onBrush={setBrush} />}
          <Grid
            tool={tool}
            brush={brush}
            units={units}
            currentId={turn.actor ?? undefined}
            targetIds={targetIds}
            picking={!!dockUnit}
            canMove={(u) => tool === "move" && canControl(u)}
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
  tool,
  brush,
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
  tool: Tool;
  brush: string | null;
}) {
  const { battle, isGM, cid, user, members } = useSession();
  const myName = members.find((m) => m.uid === user.uid)?.name ?? user.displayName ?? "누군가";
  const { cols, rows, background } = battle.meta;
  const terrain = battle.terrain;
  const defs = terrainDefsOf(battle);
  const [painting, setPainting] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false); // 끌어서 옮긴 직후의 click 은 대상 지정으로 치지 않는다
  const [fitCell, setFitCell] = useState(40); // 화면에 꼭 맞는 칸 크기
  const [zoom, setZoom] = useState(1);
  const cell = Math.max(8, Math.round(fitCell * zoom));
  const anchor = useRef<{ fx: number; fy: number; cx: number; cy: number } | null>(null);
  const pan = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const [drag, setDrag] = useState<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);

  // 화면에 맞게 칸 크기를 정한다
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const pad = 48;
      setFitCell(Math.max(18, Math.floor(Math.min((e.contentRect.width - pad) / cols, (e.contentRect.height - pad) / rows))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols, rows]);

  // 휠: 마우스가 있는 칸을 붙잡고 확대·축소 (페이지가 대신 스크롤되지 않게 passive: false)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      const g = gridRef.current;
      if (!g) return;
      e.preventDefault();
      const r = g.getBoundingClientRect();
      anchor.current = { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, cx: e.clientX, cy: e.clientY };
      setZoom((z) => Math.min(4, Math.max(0.4, +(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)).toFixed(3))));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  // 확대한 뒤, 붙잡은 칸이 다시 마우스 밑에 오도록 스크롤을 맞춘다
  useLayoutEffect(() => {
    const a = anchor.current;
    const el = wrapRef.current;
    const g = gridRef.current;
    if (!a || !el || !g) return;
    anchor.current = null;
    const r = g.getBoundingClientRect();
    el.scrollLeft += r.left + a.fx * r.width - a.cx;
    el.scrollTop += r.top + a.fy * r.height - a.cy;
  }, [cell]);

  function cellAt(clientX: number, clientY: number) {
    const r = gridRef.current!.getBoundingClientRect();
    return {
      x: Math.min(cols - 1, Math.max(0, Math.floor((clientX - r.left) / cell))),
      y: Math.min(rows - 1, Math.max(0, Math.floor((clientY - r.top) / cell))),
    };
  }

  // HP 가 바뀌면 토큰 위로 숫자가 튄다 (시트를 읽을 수 있는 유닛만 — 플레이어에게 에너미는 안 보인다)
  const hpKey = units.map((u) => `${u.id}:${u.character?.hp.cur ?? ""}`).join("|");
  const [hpSnap, setHpSnap] = useState<{ key: string; n: number; map: Record<string, number> } | null>(null);
  const [pops, setPops] = useState<{ id: string; tid: string; v: number }[]>([]);
  if (hpSnap?.key !== hpKey) {
    const map: Record<string, number> = {};
    const fresh: { id: string; tid: string; v: number }[] = [];
    const n = (hpSnap?.n ?? 0) + 1;
    for (const u of units) {
      const cur = u.character?.hp.cur;
      if (cur == null) continue;
      map[u.id] = cur;
      const prev = hpSnap?.map[u.id];
      if (prev != null && prev !== cur) fresh.push({ id: `${n}-${u.id}`, tid: u.id, v: cur - prev });
    }
    setHpSnap({ key: hpKey, n, map });
    if (fresh.length) setPops((p) => [...p.slice(-8), ...fresh]);
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
      const size = d ? (units.find((u) => u.id === d.id)?.size ?? 1) : 1;
      const raw = d ? cellAt(e.clientX, e.clientY) : null;
      const to0 = raw ? { x: Math.min(raw.x, cols - size), y: Math.min(raw.y, rows - size) } : null;
      // 벽(진입 불가) 칸에는 놓지 않는다
      const to = to0 && canPlace(to0, size, battle.terrain, terrainDefsOf(battle)) ? to0 : null;
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

  const dist = drag ? cellDistance(drag.from, drag.to) : 0;
  // 끌고 있는 유닛의 이동력 (칸) — 시트를 읽을 수 있을 때만
  const dragUnit = drag ? units.find((u) => u.id === drag.id) : undefined;
  const moveCells = dragUnit?.character?.ar ? Math.floor(derive(dragUnit.character.ar).move / METERS_PER_CELL) : null;
  const over = moveCells != null && dist > moveCells;
  const dragSize = dragUnit?.size ?? 1;

  // ── 자·핑 (다른 사람 것은 Realtime DB 로 받는다) ──
  const [pointers, setPointers] = useState<Record<string, Pointer>>({});
  useEffect(() => subscribePointers(cid, setPointers), [cid]);
  const [ruler, setRuler] = useState<{ points: Cell[]; to: Cell } | null>(null);
  const sentAt = useRef(0);
  const clearTimer = useRef<number | null>(null);
  // 오래된 자·핑을 걸러 내는 시계 — 손짓이 있을 때만 돈다 (평소에 그리드를 다시 그리지 않게)
  const [now, setNow] = useState(() => Date.now());
  const anyPointer = Object.keys(pointers).length > 0;
  useEffect(() => {
    if (!anyPointer) return;
    const t = window.setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, [anyPointer]);

  function share(p: Omit<Pointer, "at" | "name">, force = false) {
    const t = Date.now();
    if (!force && t - sentAt.current < 90) return; // 끄는 동안은 조금씩만 보낸다
    sentAt.current = t;
    setPointer(cid, user.uid, { ...p, name: myName }).catch(() => {});
  }
  function clearLater(ms: number) {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => {
      setRuler(null);
      clearPointer(cid, user.uid).catch(() => {});
    }, ms);
  }
  function ping(at: Cell) {
    share({ kind: "ping", to: at }, true);
    clearLater(2600);
  }

  // 왼쪽 버튼을 누른 동안만 자가 산다. 끄는 중 우클릭 = 그 자리에서 꺾기 (Roll20 처럼)
  const rulerOn = !!ruler;
  useEffect(() => {
    if (!rulerOn) return;
    const move = (e: PointerEvent) => {
      const to = cellAt(e.clientX, e.clientY);
      setRuler((r) => (r && (r.to.x !== to.x || r.to.y !== to.y) ? { ...r, to } : r));
    };
    const bend = (e: Event) => {
      e.preventDefault();
      e.stopPropagation(); // 토큰 우클릭 메뉴가 같이 뜨지 않게
      setRuler((r) => {
        if (!r) return r;
        const last = r.points[r.points.length - 1];
        return last.x === r.to.x && last.y === r.to.y ? r : { ...r, points: [...r.points, r.to] };
      });
    };
    const up = (e: PointerEvent) => {
      if (e.button !== 0) return; // 오른쪽 버튼을 뗀 것은 꺾기라 무시
      if (clearTimer.current) clearTimeout(clearTimer.current);
      setRuler(null);
      clearPointer(cid, user.uid).catch(() => {});
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("contextmenu", bend, true);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("contextmenu", bend, true);
      window.removeEventListener("pointerup", up);
    };
    // 자를 잡은 동안만 듣는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rulerOn, cell]);
  useEffect(() => {
    if (ruler) share({ kind: "ruler", from: ruler.points[0], path: ruler.points, to: ruler.to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruler?.to.x, ruler?.to.y, ruler?.points.length]);

  const others = Object.entries(pointers).filter(([uid, p]) => uid !== user.uid && now - (p.at || 0) < 15000);
  const rulers: { key: string; points: Cell[]; name: string; mine: boolean }[] = [
    ...(ruler ? [{ key: "me", points: [...ruler.points, ruler.to], name: myName, mine: true }] : []),
    ...others
      .filter(([, p]) => p.kind === "ruler" && (p.path || p.from))
      .map(([uid, p]) => ({ key: uid, points: [...(p.path ?? [p.from!]), p.to], name: p.name, mine: false })),
  ];
  const mine = pointers[user.uid];
  const pings = [
    ...others.filter(([, p]) => p.kind === "ping").map(([uid, p]) => ({ key: `${uid}${p.at}`, at: p.to, name: p.name })),
    ...(mine?.kind === "ping" ? [{ key: `me${mine.at}`, at: mine.to, name: myName }] : []),
  ];

  return (
    <div
      ref={wrapRef}
      className="battle-scroll absolute inset-0 overflow-auto"
      onPointerDown={(e) => {
        // 이동 도구로 빈 곳을 끌거나, 가운데 버튼으로 끌면 화면을 옮긴다
        const onToken = (e.target as HTMLElement).closest("[data-token]");
        if (!(e.button === 1 || (e.button === 0 && tool === "move" && !onToken))) return;
        const el = wrapRef.current!;
        pan.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
        const move = (ev: PointerEvent) => {
          const p = pan.current;
          if (!p) return;
          el.scrollLeft = p.sl - (ev.clientX - p.x);
          el.scrollTop = p.st - (ev.clientY - p.y);
        };
        const up = () => {
          pan.current = null;
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        if (e.button === 1) e.preventDefault();
      }}
    >
      <div className="grid min-h-full min-w-full place-items-center p-6" style={{ width: "max-content", height: "max-content" }}>
      <div
        ref={gridRef}
        className={`relative overflow-hidden rounded-sm shadow-[0_20px_60px_rgba(0,0,0,.55)] ${tool !== "move" ? "cursor-crosshair" : ""}`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const at = cellAt(e.clientX, e.clientY);
          if (tool === "paint") {
            e.preventDefault();
            setPainting(true);
            paintCells(cid, [cellKey(at.x, at.y)], brush).catch(() => {});
            return;
          }
          if (e.altKey || tool === "ping") {
            e.preventDefault();
            ping(at);
          } else if (tool === "ruler") {
            e.preventDefault();
            if (clearTimer.current) clearTimeout(clearTimer.current);
            setRuler({ points: [at], to: at });
          }
        }}
        onPointerMove={(e) => {
          if (!painting || tool !== "paint") return;
          const at = cellAt(e.clientX, e.clientY);
          if ((terrain[cellKey(at.x, at.y)] ?? null) !== brush) paintCells(cid, [cellKey(at.x, at.y)], brush).catch(() => {});
        }}
        onPointerUp={() => setPainting(false)}
        onPointerLeave={() => setPainting(false)}
        style={{
          width: cols * cell,
          height: rows * cell,
          backgroundImage: background
            ? `url("${background}")`
            : "var(--art-battle, none), radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--accent) 10%, var(--panel-2)), var(--bg))",
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
        {/* 지형 (맵 기믹) */}
        {Object.entries(terrain).map(([k, id]) => {
          const d = defs[id];
          const m = k.match(/^(\d+)_(\d+)$/);
          if (!d || !m) return null;
          const x = +m[1];
          const y = +m[2];
          if (x >= cols || y >= rows) return null;
          return (
            <div
              key={k}
              className={`terrain-cell terrain-cell--${d.effect} ${tool === "paint" ? "pointer-events-none" : ""}`}
              style={{ left: x * cell, top: y * cell, width: cell, height: cell, "--tc": d.color } as CSSProperties}
              title={`${d.name} · ${TERRAIN_EFFECT_LABEL[d.effect]}${d.amount ? ` ${d.amount}` : ""}${d.note ? `\n${d.note}` : ""}`}
            />
          );
        })}
        {/* 이동할 수 있는 범위 */}
        {drag && moveCells != null && (
          <div
            className="pointer-events-none absolute border border-accent/50 bg-accent/10"
            style={{
              left: Math.max(0, drag.from.x - moveCells) * cell,
              top: Math.max(0, drag.from.y - moveCells) * cell,
              width: (Math.min(cols - 1, drag.from.x + moveCells) - Math.max(0, drag.from.x - moveCells) + 1) * cell,
              height: (Math.min(rows - 1, drag.from.y + moveCells) - Math.max(0, drag.from.y - moveCells) + 1) * cell,
            }}
          />
        )}
        {/* 자 */}
        {rulers.length > 0 && (
          <svg className="pointer-events-none absolute inset-0 z-30" width={cols * cell} height={rows * cell}>
            {rulers.map((r) => {
              const c = (v: number) => v * cell + cell / 2;
              const segs = r.points.slice(1).map((p, i) => cellDistance(r.points[i], p));
              const d = segs.reduce((a, b) => a + b, 0);
              const end = r.points[r.points.length - 1];
              const color = r.mine ? "#ffe14d" : "#7fe3e6";
              return (
                <g key={r.key}>
                  <polyline
                    points={r.points.map((p) => `${c(p.x)},${c(p.y)}`).join(" ")}
                    fill="none"
                    stroke={color}
                    strokeWidth={3}
                    strokeDasharray="8 5"
                    strokeLinejoin="round"
                  />
                  {r.points.slice(0, -1).map((p, i) => (
                    <circle key={i} cx={c(p.x)} cy={c(p.y)} r={i === 0 ? 5 : 4} fill={color} />
                  ))}
                  <circle cx={c(end.x)} cy={c(end.y)} r={7} fill="none" stroke={color} strokeWidth={3} />
                  <foreignObject x={c(end.x) + 10} y={c(end.y) - 28} width={220} height={40}>
                    <div className="inline-block rounded bg-black/85 px-1.5 py-0.5 text-[11px] leading-tight font-bold whitespace-nowrap text-white">
                      {d}칸 · {d * METERS_PER_CELL}m
                      {segs.length > 1 && <span className="font-normal opacity-70"> ({segs.join("+")})</span>}
                      {!r.mine && <span className="font-normal opacity-70"> {r.name}</span>}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        )}
        {/* 대미지·회복 숫자 */}
        {pops.map((p) => {
          const u = units.find((x) => x.id === p.tid);
          if (!u) return null;
          return (
            <span
              key={p.id}
              className={`dmg-pop pointer-events-none absolute z-30 ${p.v < 0 ? "dmg-pop--hurt" : "dmg-pop--heal"}`}
              style={{ left: u.x * cell + ((u.size ?? 1) * cell) / 2, top: u.y * cell }}
              onAnimationEnd={() => setPops((l) => l.filter((x) => x.id !== p.id))}
            >
              {p.v > 0 ? `+${p.v}` : p.v}
            </span>
          );
        })}
        {/* 핑 */}
        {pings.map((p) => (
          <div key={p.key} className="vtt-ping pointer-events-none absolute z-30" style={{ left: p.at.x * cell + cell / 2, top: p.at.y * cell + cell / 2 }}>
            <span />
            <span />
            <b>{p.name}</b>
          </div>
        ))}
        {/* 이동 경로 */}
        {drag && (
          <>
            <div
              className="pointer-events-none absolute border-2 border-dashed border-accent/70"
              style={{ left: drag.from.x * cell, top: drag.from.y * cell, width: dragSize * cell, height: dragSize * cell }}
            />
            <div
              className="pointer-events-none absolute grid place-items-center bg-accent/25 ring-2 ring-accent"
              style={{ left: drag.to.x * cell, top: drag.to.y * cell, width: dragSize * cell, height: dragSize * cell }}
            >
              <span className={`rounded px-1.5 text-[11px] font-bold whitespace-nowrap text-white ${over ? "bg-hp" : "bg-black/80"}`}>
                {dist}칸 · {dist * METERS_PER_CELL}m{moveCells != null && ` / 이동 ${moveCells}칸`}
                {(() => {
                  const d = defs[terrain[cellKey(drag.to.x, drag.to.y)]];
                  return d ? ` · ${d.name}${d.effect === "block" ? " (못 감)" : ""}` : "";
                })()}
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
          const enemy = u.side === "enemy" || u.character?.kind === "enemy";
          const size = u.size ?? 1;
          const box = size * cell;
          return (
            <div
              key={u.id}
              className={`absolute flex flex-col items-center transition-[left,top] duration-200 ${
                movable ? "cursor-grab active:cursor-grabbing" : picking ? "cursor-crosshair" : ""
              } ${drag?.id === u.id ? "z-20 opacity-90" : "z-10"} ${u.cond === "down" ? "grayscale" : ""}`}
              data-token
              style={{ left: at.x * cell, top: at.y * cell, width: box, height: box, touchAction: "none" }}
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
              <TokenFace unit={u} size={box - 6} active={currentId === u.id} />
              <StatusDots status={u.status} />
              {targeted && <span className="target-ring pointer-events-none absolute inset-[-3px] rounded-full" />}
              {u.cond && (
                <span
                  className={`pointer-events-none absolute -top-1.5 -right-2 rounded-sm px-1 text-[9px] leading-[13px] font-bold whitespace-nowrap ${
                    u.cond === "down" ? "bg-black text-hp" : "bg-hp text-white"
                  }`}
                >
                  {CONDITION_LABEL[u.cond]}
                </span>
              )}
              {/* 발밑: HP·MP 막대, 페이트 점, 이름 — 에너미는 HP 만 (그것도 GM 화면에만) */}
              <div className="pointer-events-none absolute top-full -mt-1 flex flex-col items-center gap-px" style={{ width: Math.max(cell - 6, box - 10) }}>
                <TokenBar g={hp} color="bg-hp" />
                {!enemy && <TokenBar g={u.character?.mp} color="bg-mp" />}
                {!enemy && <FatePips g={u.character?.fate} />}
                {cell >= 34 && (
                  <span className="mt-0.5 max-w-[150%] truncate rounded-sm bg-black/75 px-1 text-[10px] leading-4 text-white">{splitTitle(u.name).name}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
      {/* 확대·축소 단추 (휠로도 된다) */}
      <div className="sticky bottom-2 left-full z-30 mr-2 flex w-max items-center gap-1 rounded-md border border-line bg-panel/90 px-1 py-0.5 text-xs shadow-lg" style={{ marginLeft: "auto" }}>
        <button className="px-1.5 hover:text-accent" onClick={() => setZoom((z) => Math.max(0.4, +(z / 1.2).toFixed(3)))} aria-label="축소">
          −
        </button>
        <button className="min-w-11 tabular-nums hover:text-accent" onClick={() => setZoom(1)} title="화면에 맞추기">
          {Math.round(zoom * 100)}%
        </button>
        <button className="px-1.5 hover:text-accent" onClick={() => setZoom((z) => Math.min(4, +(z * 1.2).toFixed(3)))} aria-label="확대">
          +
        </button>
      </div>
    </div>
  );
}

function TokenFace({ unit, size, active }: { unit: Unit; size: number; active?: boolean }) {
  const img = unit.image ?? (unit.character ? tokenImageOf(unit.character) : undefined);
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

// 토큰 왼쪽 위에 배드 스테이터스 점
function StatusDots({ status }: { status?: StatusMap }) {
  const on = BAD_STATUS.filter((b) => status?.[b.id]);
  if (!on.length) return null;
  return (
    <div className="pointer-events-none absolute -top-1 -left-1 flex max-w-full flex-wrap gap-px">
      {on.slice(0, 4).map((b) => (
        <span
          key={b.id}
          className="grid h-3.5 min-w-3.5 place-items-center rounded-full px-0.5 text-[8px] leading-none font-bold text-white ring-1 ring-black/60"
          style={{ background: b.color }}
          title={b.label}
        >
          {b.label.slice(0, 1)}
        </span>
      ))}
      {on.length > 4 && <span className="text-[8px] font-bold text-white">+{on.length - 4}</span>}
    </div>
  );
}

function TokenBar({ g, color }: { g?: Gauge; color: string }) {
  if (!g || g.max <= 0) return null;
  const pct = Math.max(0, Math.min(100, (g.cur / g.max) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/70 ring-1 ring-black/40" title={`${g.cur}/${g.max}`}>
      <div className={`h-full ${color} transition-[width] duration-300`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// 페이트 남은 개수 — 작은 금색 점
function FatePips({ g }: { g?: Gauge }) {
  if (!g || g.max <= 0) return null;
  return (
    <div className="flex gap-px" title={`페이트 ${g.cur}/${g.max}`}>
      {Array.from({ length: Math.min(g.max, 10) }, (_, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ring-1 ring-black/50 ${i < g.cur ? "bg-fate" : "bg-black/50"}`} />
      ))}
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
              {u.character && u.character.kind !== "enemy" && u.character.fate.max > 0 && <MiniGauge label="FT" g={u.character.fate} color="bg-fate" />}
              {u.status && Object.keys(u.status).length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-0.5">
                  {BAD_STATUS.filter((b) => u.status![b.id]).map((b) => (
                    <span key={b.id} className="rounded-sm px-1 text-[9px] leading-[13px] font-bold text-white" style={{ background: b.color }} title={b.hint}>
                      {b.label}
                      {b.strength ? u.status![b.id] : ""}
                    </span>
                  ))}
                </div>
              )}
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
