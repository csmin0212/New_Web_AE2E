// 전투 진행 규칙 (순수 함수 — 테스트하기 쉽게 Firebase 와 떨어뜨려 둔다)
//   행동 순서: 행동치 높은 순, 같으면 PC 먼저, 그다음 이름 순 (아리안로드 2E)
//   라운드: 셋업 → (이니셔티브 → 메인) × 유닛 수 → 클린업 → 다음 라운드 셋업
//   차례 끝내기: 이번 라운드에 행동한 유닛을 기억하고, 남은 유닛 중 가장 빠른 쪽으로.
//               다 행동했으면 클린업으로.
//   대미지: 물리 = 물리 방어, 마법 = 마법 방어로 줄이고, 관통은 그대로. HP 는 0 밑으로 내려가지 않는다.

// idle = 전투 전 · setup = 셋업 프로세스 · main = 이니셔티브·메인 프로세스 · cleanup = 클린업 프로세스
export type BattlePhase = "idle" | "setup" | "main" | "cleanup";
export type TurnState = { actor: string | null; round: number; acted: Record<string, true>; phase?: BattlePhase };

export const PHASE_LABEL: Record<BattlePhase, string> = { idle: "전투 전", setup: "셋업", main: "메인", cleanup: "클린업" };

// 예전 기록에는 phase 가 없다 → 차례가 있으면 메인, 없으면 전투 전
export function phaseOf(t: TurnState): BattlePhase {
  return t.phase ?? (t.actor ? "main" : "idle");
}

export type OrderUnit = { id: string; init: number; side: "pc" | "ally" | "enemy"; name: string };

export function initiativeOrder<T extends OrderUnit>(units: T[]): T[] {
  const sideRank = { pc: 0, ally: 1, enemy: 2 } as const;
  // 칸이 빠진 토큰(이름·행동치 없음)이 섞여도 화면이 멈추지 않게
  return [...units].sort(
    (a, b) => (b.init || 0) - (a.init || 0) || (sideRank[a.side] ?? 3) - (sideRank[b.side] ?? 3) || String(a.name ?? "").localeCompare(String(b.name ?? ""), "ko"),
  );
}

// 전투 개시 → 1라운드 셋업 프로세스
export function startBattle(): TurnState {
  return { actor: null, round: 1, acted: {}, phase: "setup" };
}

// 셋업 끝 → 이니셔티브: 아직 행동 안 한 유닛 중 가장 빠른 쪽
export function beginMain(order: { id: string }[], t: TurnState): TurnState {
  const next = order.find((u) => !t.acted[u.id]);
  return next ? { actor: next.id, round: t.round, acted: t.acted, phase: "main" } : { actor: null, round: t.round, acted: t.acted, phase: "cleanup" };
}

export function endTurn(order: { id: string }[], t: TurnState): TurnState {
  const acted = { ...t.acted };
  if (t.actor) acted[t.actor] = true;
  return beginMain(order, { ...t, acted });
}

// 클린업 끝 → 다음 라운드 셋업
export function nextRound(t: TurnState): TurnState {
  return { actor: null, round: t.round + 1, acted: {}, phase: "setup" };
}

export function stopBattle(): TurnState {
  return { actor: null, round: 1, acted: {}, phase: "idle" };
}

// 순서를 건너뛰어 특정 유닛에게 차례를 준다 (GM). 이미 행동한 표시는 지운다
export function giveTurn(t: TurnState, id: string): TurnState {
  const acted = { ...t.acted };
  delete acted[id];
  return { ...t, actor: id, acted, phase: "main" };
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

// ── 배드 스테이터스 (아리안로드 2E, roll20/RULES.md 6장) ──
//   strength: 강도가 있는 BS. clear: 저절로 풀리는 때
export type BsId = "daze" | "awe" | "rage" | "stun" | "slip" | "poison" | "knockback" | "berserk" | "fear" | "weak" | "bind";
// id 는 기본 BS(BsId) 이거나 GM 이 만든 상태의 id
//   clear: 저절로 풀리는 때. 없으면 직접 푼다 (마이너·무브 액션, 회복 스킬 …)
export type BsClear = "setup-end" | "own-turn" | "turn-end" | "cleanup" | "battle-end";
export type BsDef = { id: string; label: string; color: string; strength?: boolean; clear?: BsClear; hint: string; custom?: boolean };

export const CLEAR_LABEL: Record<BsClear, string> = {
  "setup-end": "셋업 프로세스가 끝나면",
  "own-turn": "자기 차례(이니셔티브)가 오면",
  "turn-end": "자기 메인 프로세스가 끝나면",
  cleanup: "클린업에",
  "battle-end": "전투가 끝나면",
};

export const BAD_STATUS: BsDef[] = [
  { id: "daze", label: "멍함", color: "#9aa4b5", clear: "cleanup", hint: "메이저 액션 판정 −1D · 클린업에 해제" },
  { id: "awe", label: "위압", color: "#7b5cc4", hint: "메이저 액션 불가 · 마이너 액션으로 해제" },
  { id: "rage", label: "격앙", color: "#e0573a", clear: "cleanup", hint: "건 캐릭터 이외 대상 메이저 판정 −2D · 클린업에 해제" },
  { id: "stun", label: "스턴", color: "#e8c34a", clear: "own-turn", hint: "리액션 판정 −1D · 자기 차례가 오면 해제" },
  { id: "slip", label: "슬립", color: "#4fa3c9", hint: "전투 이동·전력 이동·이탈 불가 · 무브 액션으로 해제" },
  { id: "poison", label: "독", color: "#4fae5c", strength: true, hint: "클린업마다 강도×5 HP 로스 · 회복 스킬·아이템으로 해제" },
  { id: "knockback", label: "넉백", color: "#c98a4f", strength: true, clear: "cleanup", hint: "강도×5 행동치 감소 · 클린업에 해제" },
  { id: "berserk", label: "광전사화", color: "#c4243a", strength: true, clear: "battle-end", hint: "공격 대미지 +강도D, 리액션 자동 실패 · 마이너 액션 또는 씬 종료" },
  { id: "fear", label: "공포", color: "#5a5a8c", clear: "turn-end", hint: "건 캐릭터 대상 메인 프로세스 −2D · 메인 프로세스 끝에 해제" },
  { id: "weak", label: "쇠약", color: "#8c7a5a", strength: true, hint: "메이저 액션 후 강도×5 HP 로스 · 회복 스킬·아이템으로 해제" },
  { id: "bind", label: "속박", color: "#6b6b6b", clear: "setup-end", hint: "셋업 타이밍 사용 불가 · 셋업 끝에 해제" },
];

export type StatusMap = Record<string, number>; // 값 = 강도 (강도 없는 BS 는 1)
// 걸 BS 하나 — stack: 강도가 있는 BS (겹치면 높은 쪽)
export type StatusPick = { id: string; label: string; strength: number; stack: boolean };

// 기본 BS + GM 이 만든 상태
export function statusDefs(custom: Record<string, Omit<BsDef, "id">> = {}): BsDef[] {
  return [...BAD_STATUS, ...Object.entries(custom).map(([id, d]) => ({ ...d, id, custom: true }))];
}

// 정해진 때가 오면 풀리는 BS 를 지운다
export function clearAt(status: StatusMap, when: BsClear, defs: BsDef[] = BAD_STATUS): { next: StatusMap; cleared: string[] } {
  const next: StatusMap = {};
  const cleared: string[] = [];
  for (const [id, v] of Object.entries(status)) {
    if (defs.find((b) => b.id === id)?.clear === when) cleared.push(id);
    else next[id] = v;
  }
  return { next, cleared };
}

// 클린업: 저절로 풀리는 BS 를 지우고, 독 피해를 계산한다
export function cleanup(status: StatusMap, defs: BsDef[] = BAD_STATUS): { next: StatusMap; poison: number } {
  return { next: clearAt(status, "cleanup", defs).next, poison: (status.poison ?? 0) * 5 };
}

// 같은 BS 를 또 걸면: 강도가 있는 것은 높은 쪽, 없는 것은 먼저 걸린 것 (공식 Q&A)
export function stackStatus(cur: number | undefined, next: number, hasStrength: boolean): number {
  const n = Math.max(1, Math.min(20, Math.floor(next) || 1));
  if (!hasStrength) return 1;
  return Math.max(cur ?? 0, n);
}

// 넉백이 깎은 행동치까지 반영한 행동치
export function effectiveInit(init: number, status?: StatusMap): number {
  return init - (status?.knockback ?? 0) * 5;
}
