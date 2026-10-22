"use client";

import { onValue, push, ref, remove, set, update } from "firebase/database";
import { rtdb } from "./firebase";
import type { Battle, Token } from "./scene";
import { DEFAULT_TERRAINS, type TerrainDef } from "./terrain";

// 지형 칠하기와 전투 맵 미리 세팅
//   battle/{cid}/terrain          { "x_y": 지형 id }          — 모두 보임, GM 만 칠한다
//   battle/{cid}/terrainDefs      { 지형 id: TerrainDef }      — 모두 보임, GM 만 고친다
//   gmdata/{cid}/maps/{key}       저장해 둔 전투 맵 (GM 만 읽고 쓴다 — 적 배치가 미리 새지 않게)

export function paintCells(cid: string, cells: string[], terrainId: string | null) {
  const patch: Record<string, string | null> = {};
  for (const k of cells) patch[`battle/${cid}/terrain/${k}`] = terrainId;
  return update(ref(rtdb), patch);
}

export function clearTerrain(cid: string) {
  return remove(ref(rtdb, `battle/${cid}/terrain`));
}

export function saveTerrainDef(cid: string, id: string, def: TerrainDef) {
  return set(ref(rtdb, `battle/${cid}/terrainDefs/${id}`), JSON.parse(JSON.stringify(def)));
}

export function deleteTerrainDef(cid: string, id: string) {
  return remove(ref(rtdb, `battle/${cid}/terrainDefs/${id}`));
}

export function newTerrainId() {
  return `t${Date.now().toString(36)}`;
}

// 지형 정의가 하나도 없으면 기본값을 쓴다
export function terrainDefsOf(b: Battle): Record<string, TerrainDef> {
  return Object.keys(b.terrainDefs).length ? b.terrainDefs : DEFAULT_TERRAINS;
}

// ── 전투 맵 ──────────────────────────────────────────────

export type MapToken = { token: Token; pos: { x: number; y: number } };
export type BattleMap = {
  name: string;
  cols: number;
  rows: number;
  background: string | null;
  terrain?: Record<string, string>;
  terrainDefs?: Record<string, TerrainDef>;
  tokens?: Record<string, MapToken>; // PC 를 뺀 유닛 (에너미·아군 NPC)
  pcStart?: { x: number; y: number }[]; // PC 가 설 자리
  createdAt: number;
};

export function subscribeMaps(cid: string, cb: (maps: Record<string, BattleMap>) => void) {
  return onValue(ref(rtdb, `gmdata/${cid}/maps`), (snap) => cb((snap.val() as Record<string, BattleMap> | null) ?? {}));
}

// 지금 전장을 맵으로 저장 — PC 토큰은 자리만 기억한다
export function snapshotMap(b: Battle, name: string): BattleMap {
  const tokens: Record<string, MapToken> = {};
  const pcStart: { x: number; y: number }[] = [];
  for (const [id, t] of Object.entries(b.tokens)) {
    const pos = b.pos[id] ?? { x: 0, y: 0 };
    if (t.side === "pc") pcStart.push(pos);
    else {
      const rest = { ...t };
      delete rest.cond; // 상태 표시는 불러올 때 다시 계산
      tokens[id] = { token: rest, pos };
    }
  }
  return {
    name,
    cols: b.meta.cols,
    rows: b.meta.rows,
    background: b.meta.background,
    terrain: b.terrain,
    terrainDefs: Object.keys(b.terrainDefs).length ? b.terrainDefs : undefined,
    tokens,
    pcStart,
    createdAt: Date.now(),
  };
}

export function saveMap(cid: string, map: BattleMap, key?: string) {
  const data = JSON.parse(JSON.stringify(map));
  if (key) return set(ref(rtdb, `gmdata/${cid}/maps/${key}`), data);
  return push(ref(rtdb, `gmdata/${cid}/maps`), data);
}

export function deleteMap(cid: string, key: string) {
  return remove(ref(rtdb, `gmdata/${cid}/maps/${key}`));
}

// 맵 불러오기 — 전장 크기·배경·지형을 바꾸고, PC 가 아닌 토큰은 맵의 것으로 갈아 끼운다.
// PC 토큰은 남겨서 시작 자리로 옮긴다 (자리가 모자라면 왼쪽 줄부터 빈칸에)
export async function loadMap(cid: string, b: Battle, map: BattleMap) {
  const patch: Record<string, unknown> = {
    [`battle/${cid}/meta/cols`]: map.cols,
    [`battle/${cid}/meta/rows`]: map.rows,
    [`battle/${cid}/meta/background`]: map.background ?? null,
    [`battle/${cid}/terrain`]: map.terrain ?? null,
    [`battle/${cid}/terrainDefs`]: map.terrainDefs ?? null,
    [`battle/${cid}/turn`]: { actor: null, round: 1, acted: null },
  };
  // 지금 있는 PC 아닌 토큰은 치운다
  for (const [id, t] of Object.entries(b.tokens)) {
    if (t.side !== "pc") {
      patch[`battle/${cid}/tokens/${id}`] = null;
      patch[`battle/${cid}/pos/${id}`] = null;
    }
  }
  // 맵의 유닛을 새 키로 올린다
  const used = new Set<string>();
  for (const mt of Object.values(map.tokens ?? {})) {
    const key = push(ref(rtdb, `battle/${cid}/tokens`)).key!;
    patch[`battle/${cid}/tokens/${key}`] = JSON.parse(JSON.stringify(mt.token));
    patch[`battle/${cid}/pos/${key}`] = mt.pos;
    used.add(`${mt.pos.x},${mt.pos.y}`);
  }
  // PC 를 시작 자리로
  const starts = [...(map.pcStart ?? [])];
  const pcs = Object.entries(b.tokens).filter(([, t]) => t.side === "pc");
  for (const [id] of pcs) {
    let at = starts.shift();
    if (!at) {
      outer: for (let x = 0; x < map.cols; x++)
        for (let y = 0; y < map.rows; y++)
          if (!used.has(`${x},${y}`) && (map.terrain ?? {})[`${x}_${y}`] !== "wall") {
            at = { x, y };
            break outer;
          }
    }
    at ??= { x: 0, y: 0 };
    used.add(`${at.x},${at.y}`);
    patch[`battle/${cid}/pos/${id}`] = at;
  }
  await update(ref(rtdb), patch);
}
