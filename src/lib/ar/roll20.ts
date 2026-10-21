import { AR_STATS, emptyStats, newId, type ArCheck, type ArEquip, type ArSheet, type ArSkill, type ArStatKey } from "./types";

// roll20/vtt-character-export.js 가 만든 JSON → ArSheet
// 기준: Roll20 한국어 아리안로드 시트 (strength_base, Mental_mainclass_mod, repeating_skill, repeating_item, equipmentN_*)

type AttrValue = string | number | { current: string | number; max: string | number };
export type Roll20Export = {
  format: "roll20-character-export";
  name: string;
  avatar?: string;
  attributes: Record<string, AttrValue>;
  repeating: Record<string, Record<string, AttrValue>[]>;
};

export function isRoll20Export(v: unknown): v is Roll20Export {
  return !!v && typeof v === "object" && (v as Roll20Export).format === "roll20-character-export";
}

function attrGetter(attrs: Record<string, AttrValue>) {
  const lower = new Map(Object.entries(attrs).map(([k, v]) => [k.toLowerCase(), v]));
  const raw = (name: string) => lower.get(name.toLowerCase());
  const str = (name: string) => {
    const v = raw(name);
    if (v == null) return "";
    return typeof v === "object" ? String(v.current ?? "") : String(v);
  };
  const num = (name: string) => {
    const n = parseInt(str(name).replace(/[^\d-]/g, ""), 10);
    return Number.isNaN(n) ? 0 : n;
  };
  const gauge = (name: string) => {
    const v = raw(name);
    if (v && typeof v === "object") return { cur: toInt(v.current), max: toInt(v.max) || toInt(v.current) };
    const n = toInt(v ?? 0);
    return { cur: n, max: n };
  };
  return { raw, str, num, gauge };
}

function toInt(v: unknown): number {
  const n = parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

// "[신록의 가호](#" style="...color:#e5fff5; text-shadow:0 0 2px #53eaa8, ...")" → 이름·색·빛
export function parseStyledName(raw: string): { name: string; color?: string; glow?: string } {
  const m = raw.match(/^\s*\[([\s\S]+?)\]\(#"\s*style="([^"]*)"\s*\)\s*$/);
  if (!m) return { name: raw.trim() };
  const style = m[2];
  const color = style.match(/(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)/)?.[1];
  const glow = style.match(/text-shadow\s*:[^;]*?(#[0-9a-fA-F]{3,8})/)?.[1];
  return { name: m[1].trim(), color, glow };
}

const EQUIP_SLOTS = ["오른손", "왼손", "머리", "몸", "보조 방어구", "장신구"];

const SPECIAL_CHECKS: { key: string; label: string; stat: ArStatKey }[] = [
  { key: "enemydistinguish", label: "에너미 식별", stat: "INT" },
  { key: "itemidentify", label: "아이템 감정", stat: "INT" },
  { key: "spellcasting", label: "마술", stat: "INT" },
  { key: "song", label: "주가", stat: "SPI" },
  { key: "trapdetect", label: "트랩 탐지", stat: "PER" },
  { key: "trapdisarm", label: "트랩 해제", stat: "DEX" },
  { key: "dangersense", label: "위험 감지", stat: "PER" },
  { key: "alchemy", label: "연금술", stat: "DEX" },
];

export function fromRoll20(data: Roll20Export): { sheet: ArSheet; avatar?: string; hp: { cur: number; max: number }; mp: { cur: number; max: number }; fate: { cur: number; max: number } } {
  const a = attrGetter(data.attributes);
  const enemy = a.str("enemy_sheet_toggle").toLowerCase().startsWith("enemy");

  const stats = emptyStats().map((s) => {
    const p = AR_STATS.find((x) => x.key === s.key)!.roll20;
    return {
      ...s,
      base: a.num(`${p}_base`),
      main: a.num(`${p}_mainclass_mod`),
      support: a.num(`${p}_supportclass_mod`),
      extra: a.num(`${p}_extra_mod`),
      skill: a.num(`${p}_skillbonus`),
      dice: a.num(`${p}_dice_total`) || 2,
    };
  });

  const equipment: ArEquip[] = [];
  for (let i = 1; i <= 6; i++) {
    const name = a.str(`equipment${i}_name`);
    if (!name) continue;
    equipment.push({
      slot: EQUIP_SLOTS[i - 1] ?? `장비 ${i}`,
      name,
      weight: a.num(`equipment${i}_weight`),
      hit: a.num(`equipment${i}_attackmod`),
      atk: a.num(`equipment${i}_damagemod`),
      action: a.num(`equipment${i}_behaviormod`),
      move: a.num(`equipment${i}_movementmod`),
      pdef: a.num(`equipment${i}_phydef`),
      mdef: a.num(`equipment${i}_magdef`),
      note: a.str(`equipment${i}_etc`),
    });
  }

  const checks: ArCheck[] = SPECIAL_CHECKS.filter(
    (c) => a.raw(`special_${c.key}_dice_bonus`) != null || a.raw(`special_${c.key}_etc`) != null,
  ).map((c) => ({
    key: c.key,
    label: c.label,
    stat: c.stat,
    dice: a.num(`special_${c.key}_dice_bonus`) || 2,
    mod: a.num(`special_${c.key}_etc`) + a.num(`special_${c.key}_skill`),
  }));

  // 스킬: 시트에 보이는 순서(_reporder)대로
  const order = a.str("_reporder_repeating_skill").split(",").filter(Boolean);
  const rows = [...(data.repeating.skill ?? [])].sort((x, y) => {
    const ix = order.indexOf(String(x._row));
    const iy = order.indexOf(String(y._row));
    return (ix < 0 ? 1e9 : ix) - (iy < 0 ? 1e9 : iy);
  });
  const skills: ArSkill[] = rows.map((r) => {
    const g = attrGetter(r);
    const styled = parseStyledName(g.str("skill_name"));
    const rollTotal = g.str("skill_extra_roll_total");
    return {
      id: String(r._row ?? newId()),
      name: styled.name || "(이름 없음)",
      color: styled.color,
      glow: styled.glow,
      sl: g.num("skill_level") || 1,
      slMax: g.str("skill_sl_limit"),
      timing: g.str("skill_timing"),
      target: g.str("skill_target"),
      range: g.str("skill_range"),
      cost: g.str("skill_cost"),
      effect: g.str("skill_effect"),
      roll: rollTotal && /\d/.test(rollTotal) ? rollTotal : undefined,
    };
  });

  const items = (data.repeating.item ?? []).map((r) => {
    const g = attrGetter(r);
    return {
      id: String(r._row ?? newId()),
      name: g.str("item_name") || "(이름 없음)",
      qty: g.num("item_quantity"),
      weight: g.num("item_weight"),
      desc: g.str("item_description"),
    };
  });

  const sheet: ArSheet = {
    version: 1,
    kind: enemy ? "enemy" : "pc",
    profile: {
      name: data.name,
      player: a.str("player_name") || undefined,
      race: a.str("Race") || undefined,
      mainClass: a.str("MainClass") || undefined,
      supportClass: a.str("SupportClass") || undefined,
      level: a.num("Level") || undefined,
      guild: a.str("guild_name") || undefined,
    },
    stats,
    combat: {
      hitDice: a.num("combat_attack_dice_bonus") || 2,
      hitMod: a.num("combat_attack_skill_mod") + a.num("combat_attack_etc_mod"),
      dmgDice: a.num("combat_damage_dice_bonus") || 2,
      dmgMod: a.num("combat_damage_skill_mod") + a.num("combat_damage_etc_mod"),
      evaDice: a.num("combat_evasion_dice_bonus") || 2,
      evaMod: a.num("combat_evasion_skill_mod") + a.num("combat_evasion_etc_mod"),
      actionMod: a.num("combat_behavior_skill_mod") + a.num("combat_behavior_etc_mod"),
      moveMod: a.num("combat_movement_skill_mod") + a.num("combat_movement_etc_mod"),
      pdefMod: a.num("combat_phydef_skill_mod") + a.num("combat_phydef_etc_mod"),
      mdefMod: a.num("combat_magdef_skill_mod") + a.num("combat_magdef_etc_mod"),
    },
    checks,
    equipment,
    items,
    skills,
    attacks: [],
    drops: [],
    money: a.num("items_money") || undefined,
    source: "roll20",
  };

  return { sheet, avatar: data.avatar || undefined, hp: a.gauge("HP"), mp: a.gauge("MP"), fate: a.gauge("FatePoint") };
}
