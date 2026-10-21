// 전투 진행 규칙 (순수 함수 — 테스트하기 쉽게 Firebase 와 떨어뜨려 둔다)
//   행동 순서: 행동치 높은 순, 같으면 PC 먼저, 그다음 이름 순 (아리안로드 2E)
//   차례 끝내기: 이번 라운드에 행동한 유닛을 기억하고, 남은 유닛 중 가장 빠른 쪽으로.
//               다 행동했으면 다음 라운드 첫 유닛으로.
//   대미지: 물리 = 물리 방어, 마법 = 마법 방어로 줄이고, 관통은 그대로. HP 는 0 밑으로 내려가지 않는다.

export type TurnState = { actor: string | null; round: number; acted: Record<string, true> };

export type OrderUnit = { id: string; init: number; side: "pc" | "ally" | "enemy"; name: string };

export function initiativeOrder<T extends OrderUnit>(units: T[]): T[] {
  const sideRank = { pc: 0, ally: 1, enemy: 2 } as const;
  return [...units].sort((a, b) => b.init - a.init || sideRank[a.side] - sideRank[b.side] || a.name.localeCompare(b.name, "ko"));
}

export function startBattle(order: { id: string }[]): TurnState {
  return { actor: order[0]?.id ?? null, round: 1, acted: {} };
}

export function endTurn(order: { id: string }[], t: TurnState): TurnState {
  const acted = { ...t.acted };
  if (t.actor) acted[t.actor] = true;
  const next = order.find((u) => !acted[u.id]);
  if (next) return { actor: next.id, round: t.round, acted };
  return { actor: order[0]?.id ?? null, round: t.round + 1, acted: {} };
}

// 순서를 건너뛰어 특정 유닛에게 차례를 준다 (GM). 이미 행동한 표시는 지운다
export function giveTurn(t: TurnState, id: string): TurnState {
  const acted = { ...t.acted };
  delete acted[id];
  return { ...t, actor: id, acted };
}

export type EffectKind = "damage" | "heal" | "mp-heal" | "mp-loss";
export type DamageType = "physical" | "magic" | "pierce";

export const EFFECT_LABEL: Record<EffectKind, string> = {
  damage: "대미지",
  heal: "HP 회복",
  "mp-heal": "MP 회복",
  "mp-loss": "MP 감소",
};
export const DAMAGE_LABEL: Record<DamageType, string> = { physical: "물리", magic: "마법", pierce: "관통" };

export type Gauge = { cur: number; max: number };

export type EffectResult = {
  key: "hp" | "mp";
  before: number;
  after: number;
  max: number;
  reduced: number; // 방어로 줄어든 양
  dealt: number; // 실제로 바뀐 양 (대미지면 깎인 HP)
};

export function computeEffect(
  g: { hp: Gauge; mp: Gauge },
  def: { pdef: number; mdef: number },
  e: { kind: EffectKind; amount: number; dmgType?: DamageType },
): EffectResult {
  const amount = Math.max(0, Math.floor(e.amount));
  switch (e.kind) {
    case "damage": {
      const reduced = e.dmgType === "pierce" ? 0 : Math.min(amount, Math.max(0, e.dmgType === "magic" ? def.mdef : def.pdef));
      const after = Math.max(0, g.hp.cur - (amount - reduced));
      return { key: "hp", before: g.hp.cur, after, max: g.hp.max, reduced, dealt: g.hp.cur - after };
    }
    case "heal": {
      const after = Math.min(g.hp.max, Math.max(g.hp.cur, 0) + amount);
      return { key: "hp", before: g.hp.cur, after, max: g.hp.max, reduced: 0, dealt: after - g.hp.cur };
    }
    case "mp-heal": {
      const after = Math.min(g.mp.max, g.mp.cur + amount);
      return { key: "mp", before: g.mp.cur, after, max: g.mp.max, reduced: 0, dealt: after - g.mp.cur };
    }
    case "mp-loss": {
      const after = Math.max(0, g.mp.cur - amount);
      return { key: "mp", before: g.mp.cur, after, max: g.mp.max, reduced: 0, dealt: g.mp.cur - after };
    }
  }
}

// 플레이어에게 보여 줄 에너미 상태 (숫자 없이)
export type Condition = "hurt" | "down";
export function conditionOf(hp: Gauge): Condition | null {
  if (hp.max <= 0) return null;
  if (hp.cur <= 0) return "down";
  if (hp.cur * 2 <= hp.max) return "hurt";
  return null;
}
export const CONDITION_LABEL: Record<Condition, string> = { hurt: "부상", down: "전투불능" };

// 스킬 코스트 칸 → 무엇을 얼마나 쓰는지 ("6", "MP6", "HP 5", "MP3+HP2")
export function parseCost(cost: string): { mp: number; hp: number } | null {
  const s = cost.trim().toUpperCase().replace(/\s+/g, "");
  if (!s || s === "-" || s === "—") return null;
  if (/^\d+$/.test(s)) return { mp: parseInt(s, 10), hp: 0 };
  let mp = 0;
  let hp = 0;
  let hit = false;
  for (const m of s.matchAll(/(MP|HP)(\d+)/g)) {
    hit = true;
    if (m[1] === "MP") mp += parseInt(m[2], 10);
    else hp += parseInt(m[2], 10);
  }
  return hit ? { mp, hp } : null;
}
