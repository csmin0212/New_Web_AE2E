import { emptyStats, newId, type ArSheet, type DiceMod } from "./types";

// ARON (arianrod-gallery/roll20/monster-data-example.json) 몬스터 형식 → ArSheet
export type AronMonster = {
  id?: string;
  name: string;
  imgsrc?: string;
  category?: string;
  element?: string;
  level?: number;
  identify?: number;
  hp?: number;
  mp?: number;
  defense?: { physical?: number; magical?: number };
  combat?: { evasion?: string; action?: number; move?: number };
  stats?: Partial<Record<"strength" | "dexterity" | "agility" | "intelligence" | "perception" | "mind" | "luck", string>>;
  attacks?: { label?: string; name: string; kind?: string; hit?: string; damage?: string; damageType?: string; range?: string }[];
  skills?: string[];
  drops?: { range: string; name: string; price?: number; count?: number }[];
};

export function isAronMonster(v: unknown): v is AronMonster {
  return !!v && typeof v === "object" && typeof (v as AronMonster).name === "string" && ("stats" in (v as object) || "attacks" in (v as object));
}

// "18(3D)" · "3D+18" · "18" → { dice, mod }
export function parseDiceMod(s: string | undefined, defaultDice = 2): DiceMod {
  const t = (s ?? "").replace(/\s/g, "");
  let m = t.match(/^(-?\d+)\((\d+)D\)$/i);
  if (m) return { mod: +m[1], dice: +m[2] };
  m = t.match(/^(\d+)D([+-]\d+)?$/i);
  if (m) return { dice: +m[1], mod: m[2] ? +m[2] : 0 };
  m = t.match(/^-?\d+$/);
  if (m) return { dice: defaultDice, mod: +t };
  return { dice: defaultDice, mod: 0 };
}

const STAT_FIELD: Record<string, string> = {
  STR: "strength",
  DEX: "dexterity",
  AGI: "agility",
  INT: "intelligence",
  PER: "perception",
  SPI: "mind",
  LUK: "luck",
};

export function fromAron(m: AronMonster): { sheet: ArSheet; avatar?: string; hp: number; mp: number } {
  const stats = emptyStats().map((s) => {
    // "8/2" = 기본치/보너스. 에너미는 클래스 수정이 없으므로 보너스가 그대로 판정치
    const raw = m.stats?.[STAT_FIELD[s.key] as keyof NonNullable<AronMonster["stats"]>] ?? "";
    const [base, bonus] = String(raw).split("/").map((x) => parseInt(x, 10));
    const b = Number.isNaN(base) ? 0 : base;
    const extra = Number.isNaN(bonus) ? 0 : bonus - Math.floor(b / 3);
    return { ...s, base: b, extra };
  });

  const sheet: ArSheet = {
    version: 1,
    kind: "enemy",
    profile: { name: m.name, category: m.category, element: m.element, level: m.level, identify: m.identify },
    stats,
    combat: { hitDice: 2, hitMod: 0, dmgDice: 2, dmgMod: 0, evaDice: 2, evaMod: 0, actionMod: 0, moveMod: 0, pdefMod: 0, mdefMod: 0 },
    fixed: {
      evasion: parseDiceMod(m.combat?.evasion),
      action: m.combat?.action,
      move: m.combat?.move,
      pdef: m.defense?.physical,
      mdef: m.defense?.magical,
    },
    checks: [],
    equipment: [],
    items: [],
    skills: (m.skills ?? []).map((line) => {
      const sm = line.match(/^(.*?)\s*(\d+)?\s*$/);
      return {
        id: newId(),
        name: (sm?.[1] ?? line).replace(/^<|>$/g, "").trim(),
        sl: sm?.[2] ? +sm[2] : 1,
        slMax: "",
        timing: "",
        target: "",
        range: "",
        cost: "",
        effect: "",
      };
    }),
    attacks: (m.attacks ?? []).map((x) => ({
      id: newId(),
      name: x.name,
      kind: x.kind ?? "",
      hit: parseDiceMod(x.hit),
      damage: parseDiceMod(x.damage),
      damageType: x.damageType ?? "",
      range: x.range ?? "",
    })),
    drops: (m.drops ?? []).map((d) => ({ range: d.range, name: d.name, price: d.price ?? 0, count: d.count ?? 1 })),
    source: "aron",
  };
  return { sheet, avatar: m.imgsrc || undefined, hp: m.hp ?? 0, mp: m.mp ?? 0 };
}
