import { AR_STATS, type ArSheet, type ArStatKey, type DiceMod } from "./types";

// 시트 값 → 판정·전투 수치 (아리안로드 2E)
//   능력 보너스 = 기본치 ÷ 3 (버림)
//   능력치     = 보너스 + 메인·서포트 클래스 수정 + 기타 수정
//   판정       = (주사위)D + 능력치 + 스킬 보너스
//   명중       = 【재주】 + 장비 명중 + 스킬     회피 = 【민첩】 + 스킬
//   공격력     = 【근력】 + 장비 공격력 + 스킬·기타
//   행동치     = 【민첩】 + 【감지】 + 장비 + 스킬·기타     이동력 = 【근력】 + 5 + 장비 + 스킬·기타
//   물리 방어  = 장비 합                                   마법 방어 = 【정신】 + 장비 합

export type DerivedStat = { key: ArStatKey; label: string; bonus: number; value: number; check: DiceMod };

export type Derived = {
  stats: DerivedStat[];
  stat: Record<ArStatKey, number>;
  hit: DiceMod;
  evasion: DiceMod;
  damage: DiceMod;
  action: number;
  move: number;
  pdef: number;
  mdef: number;
  weight: number;
};

export function derive(s: ArSheet): Derived {
  const stat = {} as Record<ArStatKey, number>;
  const stats: DerivedStat[] = AR_STATS.map(({ key, label }) => {
    const st = s.stats.find((x) => x.key === key) ?? { base: 0, main: 0, support: 0, extra: 0, skill: 0, dice: 2 };
    const bonus = Math.floor(st.base / 3);
    const value = bonus + st.main + st.support + st.extra;
    stat[key] = value;
    return { key, label, bonus, value, check: { dice: st.dice || 2, mod: value + st.skill } };
  });

  const eq = s.equipment.reduce(
    (a, e) => ({
      hit: a.hit + e.hit,
      atk: a.atk + e.atk,
      action: a.action + e.action,
      move: a.move + e.move,
      pdef: a.pdef + e.pdef,
      mdef: a.mdef + e.mdef,
      weight: a.weight + e.weight,
    }),
    { hit: 0, atk: 0, action: 0, move: 0, pdef: 0, mdef: 0, weight: 0 },
  );
  const c = s.combat;
  const f = s.fixed ?? {};
  return {
    stats,
    stat,
    hit: { dice: c.hitDice || 2, mod: stat.DEX + eq.hit + c.hitMod },
    evasion: f.evasion ?? { dice: c.evaDice || 2, mod: stat.AGI + c.evaMod },
    damage: { dice: c.dmgDice || 2, mod: stat.STR + eq.atk + c.dmgMod },
    action: f.action ?? stat.AGI + stat.PER + eq.action + c.actionMod,
    move: f.move ?? Math.max(0, stat.STR + 5 + eq.move + c.moveMod),
    pdef: f.pdef ?? eq.pdef + c.pdefMod,
    mdef: f.mdef ?? stat.SPI + eq.mdef + c.mdefMod,
    weight: eq.weight + s.items.reduce((a, i) => a + i.weight * (i.qty || 0), 0),
  };
}

export function formatDiceMod(d: DiceMod): string {
  return `${d.dice}D${d.mod >= 0 ? "+" : ""}${d.mod}`;
}
