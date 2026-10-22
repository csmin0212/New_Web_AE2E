// 대미지 타이밍 (아리안로드 2E 대미지 처리) — 순수 함수 · 테스트 대상
//   ① 대미지 굴림 직전: 대미지 증가 선언 (+2D, +10 …)
//   ② 대미지 굴림: 기본 대미지 + 증가분을 함께 굴린다
//   ③ 대미지 굴림 직후: 경감(대상별·전원), 커버링(다른 캐릭터가 대신 받음), 추가 증가
//   ④ 확정: 대상마다 합계 − 경감 → 커버링이면 받는 사람이 바뀐다 → 방어력은 적용 단계에서 뺀다

import type { DamageType } from "./battleRules";

export type DamagePhase = "before" | "after";
export type DmgTarget = { tid?: string; charId: string; name: string };
export type DmgMod = {
  by: string; // 선언한 캐릭터 이름
  byCharId?: string;
  skill?: string;
  expr: string; // "2D", "10", "1D+5"
  total: number; // 굴린 값 (직전 증가는 대미지 굴림 때 함께 굴린다 → 그때 채운다)
  uid: string;
  phase: DamagePhase;
};
export type DmgReduce = DmgMod & { target: string }; // charId 또는 "all"
export type DmgCover = { target: string; by: DmgTarget; skill?: string; uid: string };

export type DamageWindow = {
  phase: DamagePhase;
  attacker: { name: string; charId?: string; uid: string };
  source: string;
  dmgType: DamageType;
  base: { expr?: string; fixed?: number }; // 식을 굴리거나, 이미 굴린 값
  targets: DmgTarget[];
  plus?: Record<string, DmgMod>;
  minus?: Record<string, DmgReduce>;
  covers?: Record<string, DmgCover>;
  rolled?: { base: number; total: number }; // 대미지 굴림 결과 (직전 증가 포함)
  at: number;
};

export type DamageResult = {
  target: DmgTarget; // 원래 대상
  recipient: DmgTarget; // 실제로 받는 사람 (커버링이면 바뀜)
  covered: boolean;
  amount: number; // 방어력 빼기 전
  reduced: number; // 경감 합
};

// 대미지 굴림 직후 기준 합계: 굴린 값 + 직후에 붙은 증가
export function damageTotal(w: DamageWindow): number {
  const after = Object.values(w.plus ?? {})
    .filter((m) => m.phase === "after")
    .reduce((a, m) => a + m.total, 0);
  return (w.rolled?.total ?? 0) + after;
}

export function resolveDamage(w: DamageWindow): DamageResult[] {
  const total = damageTotal(w);
  const reductions = Object.values(w.minus ?? {});
  const covers = Object.values(w.covers ?? {});
  return w.targets.map((t) => {
    const reduced = reductions.filter((r) => r.target === "all" || r.target === t.charId).reduce((a, r) => a + r.total, 0);
    const cover = covers.find((c) => c.target === t.charId);
    return { target: t, recipient: cover ? cover.by : t, covered: !!cover, amount: Math.max(0, total - reduced), reduced };
  });
}
