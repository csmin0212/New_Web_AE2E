// 맵 기믹 — 칸마다 지형을 칠한다 (순수 함수 · 테스트 대상)
//   block:  들어갈 수 없음 (벽·절벽)
//   slow:   험지 (이동이 느려짐 — 표시만)
//   damage: 클린업마다 HP 로스 (레드 리버·용암·독 늪)
//   heal:   클린업마다 HP 회복 (회복의 샘)
//   none:   표시만 (어둠·안개·높은 곳 등 GM 이 설명으로 처리)

export type TerrainEffect = "none" | "block" | "slow" | "damage" | "heal";

export type TerrainDef = { name: string; color: string; effect: TerrainEffect; amount?: number; note?: string };

export const TERRAIN_EFFECT_LABEL: Record<TerrainEffect, string> = {
  none: "표시만",
  block: "진입 불가",
  slow: "험지 (이동 느림)",
  damage: "클린업 피해",
  heal: "클린업 회복",
};

// 처음 쓸 때 깔아 두는 기본 지형 (GM 이 고치거나 더 만들 수 있다)
export const DEFAULT_TERRAINS: Record<string, TerrainDef> = {
  wall: { name: "벽", color: "#3b3f47", effect: "block", note: "들어갈 수 없다" },
  rough: { name: "험지", color: "#8a6a3a", effect: "slow", note: "늪·잔해 — 이동이 느려진다" },
  danger: { name: "위험 지대", color: "#d0463a", effect: "damage", amount: 10, note: "클린업에 HP 로스 10" },
  spring: { name: "회복의 샘", color: "#3fb27f", effect: "heal", amount: 10, note: "클린업에 HP 10 회복" },
};

// 칸 좌표 ↔ 키 (Realtime DB 키에 쓸 수 있게)
export const cellKey = (x: number, y: number) => `${x}_${y}`;
export function parseCellKey(k: string): { x: number; y: number } | null {
  const m = k.match(/^(\d+)_(\d+)$/);
  return m ? { x: +m[1], y: +m[2] } : null;
}

// 토큰이 덮는 칸들 (큰 토큰은 여러 칸)
export function coveredCells(pos: { x: number; y: number }, size = 1): string[] {
  const out: string[] = [];
  for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) out.push(cellKey(pos.x + dx, pos.y + dy));
  return out;
}

// 그 자리에 놓을 수 있는지 (벽 칸이 하나라도 겹치면 안 됨)
export function canPlace(pos: { x: number; y: number }, size: number, terrain: Record<string, string>, defs: Record<string, TerrainDef>): boolean {
  return coveredCells(pos, size).every((k) => defs[terrain[k]]?.effect !== "block");
}

// 클린업 때 한 유닛이 받는 지형 효과 — 덮은 칸 중 가장 센 피해 하나, 없으면 가장 큰 회복 하나
export function terrainEffectAt(
  pos: { x: number; y: number },
  size: number,
  terrain: Record<string, string>,
  defs: Record<string, TerrainDef>,
): { kind: "damage" | "heal"; amount: number; name: string } | null {
  let dmg: { amount: number; name: string } | null = null;
  let heal: { amount: number; name: string } | null = null;
  for (const k of coveredCells(pos, size)) {
    const d = defs[terrain[k]];
    if (!d || !d.amount) continue;
    if (d.effect === "damage" && (!dmg || d.amount > dmg.amount)) dmg = { amount: d.amount, name: d.name };
    if (d.effect === "heal" && (!heal || d.amount > heal.amount)) heal = { amount: d.amount, name: d.name };
  }
  if (dmg) return { kind: "damage", ...dmg };
  if (heal) return { kind: "heal", ...heal };
  return null;
}
