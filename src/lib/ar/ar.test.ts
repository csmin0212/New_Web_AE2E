import { describe, expect, it } from "vitest";
import { fromAron, parseDiceMod } from "./aron";
import { derive, formatDiceMod } from "./derive";
import { fromRoll20, parseStyledName, type Roll20Export } from "./roll20";

// 실제 내보내기(어콜라이트 Lv.22)와 같은 모양의 작은 예시
const sample: Roll20Export = {
  format: "roll20-character-export",
  name: "테스트 어콜라이트",
  avatar: "https://files.d20.io/images/1/a/med.png",
  attributes: {
    enemy_sheet_toggle: "char",
    player_name: "PL",
    MainClass: "어콜라이트",
    SupportClass: "세이지",
    Race: "어션",
    Level: "22",
    strength_base: "28",
    Dexterity_base: "14",
    Agility_base: "13",
    Intelligence_base: "39",
    Perception_base: "12",
    Mental_base: "43",
    Luck_base: "22",
    Mental_mainclass_mod: "3",
    Mental_extra_mod: "2",
    Mental_skillbonus: "1",
    Mental_dice_total: "4",
    Intelligence_mainclass_mod: "2",
    Intelligence_supportclass_mod: "1",
    Intelligence_extra_mod: "1",
    Intelligence_skillbonus: "1",
    Intelligence_dice_total: "3",
    Luck_supportclass_mod: "1",
    Luck_extra_mod: "1",
    Perception_supportclass_mod: "1",
    HP: { current: "185", max: "185" },
    MP: { current: "215", max: "222" },
    FatePoint: { current: "13", max: "14" },
    equipment1_name: "[호수의 성검] 아르카시아",
    equipment1_weight: "14",
    equipment1_attackmod: "-2",
    equipment1_damagemod: "20",
    equipment3_name: "디렉터 고글",
    equipment3_phydef: "6",
    equipment4_name: "하얀로브",
    equipment4_phydef: "4",
    combat_attack_dice_bonus: "4",
    combat_damage_skill_mod: "20",
    combat_damage_etc_mod: "2",
    combat_evasion_dice_bonus: "4",
    combat_behavior_skill_mod: "2",
    combat_behavior_etc_mod: "-1",
    combat_movement_etc_mod: "1",
    special_enemydistinguish_dice_bonus: "5",
    special_enemydistinguish_etc: "1",
    items_money: "3128",
    _reporder_repeating_skill: "-B000000000000000002,-A000000000000000001",
  },
  repeating: {
    skill: [
      {
        _row: "-A000000000000000001",
        skill_name: '[신록의 가호](#" style="text-decoration:none; color:#e5fff5; text-shadow:0 0 2px #53eaa8, 0 0 3px #53eaa8;" )',
        skill_level: "5",
        skill_sl_limit: "5",
        skill_timing: "대미지 굴림 직전",
        skill_target: "단일",
        skill_range: "20m",
        skill_cost: "3",
        skill_effect: "그 공격의 대미지에 +[[5D6+20]]한다.",
      },
      {
        _row: "-B000000000000000002",
        skill_name: "칭호 : 증폭자",
        skill_level: "3",
        skill_cost: "-",
        skill_extra_roll_total: "4d6+17",
        skill_effect: "그 효과에 +[SL×3]한다.",
      },
    ],
    item: [{ _row: "-C000000000000000003", item_name: "하이MP포션", item_quantity: "3", item_weight: "0", item_description: "MP를 [[4d6+20]]만큼 회복한다." }],
  },
};

describe("fromRoll20", () => {
  const { sheet, hp, mp, fate, avatar } = fromRoll20(sample);
  const d = derive(sheet);

  it("프로필·게이지", () => {
    expect(sheet.kind).toBe("pc");
    expect(sheet.profile).toMatchObject({ name: "테스트 어콜라이트", mainClass: "어콜라이트", supportClass: "세이지", level: 22 });
    expect([hp, mp, fate]).toEqual([
      { cur: 185, max: 185 },
      { cur: 215, max: 222 },
      { cur: 13, max: 14 },
    ]);
    expect(avatar).toContain("d20.io");
    expect(sheet.money).toBe(3128);
  });

  it("능력치 판정: 정신 43 → 보너스 14 + 클래스 3 + 기타 2 = 19, 스킬 +1, 4D", () => {
    const spi = d.stats.find((s) => s.key === "SPI")!;
    expect(spi).toMatchObject({ bonus: 14, value: 19, check: { dice: 4, mod: 20 } });
    expect(d.stats.find((s) => s.key === "INT")!.check).toEqual({ dice: 3, mod: 18 });
  });

  it("전투 수치", () => {
    expect(formatDiceMod(d.hit)).toBe("4D+2"); // 재주 4 + 무기 -2
    expect(formatDiceMod(d.damage)).toBe("2D+51"); // 근력 9 + 무기 20 + 스킬 20 + 기타 2
    expect(d.evasion).toEqual({ dice: 4, mod: 4 });
    expect(d.action).toBe(10); // 민첩 4 + 감지 5(보너스 4 + 서포트 1) + 스킬 2 + 기타 -1
    expect(d.pdef).toBe(10);
    expect(d.mdef).toBe(19);
  });

  it("스킬은 시트 순서대로, 꾸밈 이름·딸린 굴림까지", () => {
    expect(sheet.skills.map((s) => s.name)).toEqual(["칭호 : 증폭자", "신록의 가호"]);
    expect(sheet.skills[1]).toMatchObject({ color: "#e5fff5", glow: "#53eaa8", sl: 5, cost: "3", range: "20m" });
    expect(sheet.skills[0].roll).toBe("4d6+17");
  });

  it("특수 판정·아이템", () => {
    expect(sheet.checks).toEqual([{ key: "enemydistinguish", label: "에너미 식별", stat: "INT", dice: 5, mod: 1 }]);
    expect(sheet.items[0]).toMatchObject({ name: "하이MP포션", qty: 3 });
  });
});

describe("parseStyledName", () => {
  it("꾸밈 없는 이름은 그대로", () => {
    expect(parseStyledName("업적창")).toEqual({ name: "업적창" });
  });
});

describe("fromAron", () => {
  it("ARON 몬스터 형식", () => {
    const { sheet, hp } = fromAron({
      name: "길맨 매지션",
      level: 4,
      hp: 56,
      mp: 58,
      defense: { physical: 8, magical: 4 },
      combat: { evasion: "4(2D)", action: 9, move: 7 },
      stats: { strength: "8/2", intelligence: "15/5" },
      attacks: [{ name: "<마술 공격:물>", hit: "18(3D)", damage: "22(2D)", damageType: "마법(물)", range: "20m" }],
      skills: ["<배드 스테이터스 부여:방심> 1"],
    });
    const d = derive(sheet);
    expect(hp).toBe(56);
    expect(d.stat.INT).toBe(5);
    expect(d.evasion).toEqual({ dice: 2, mod: 4 });
    expect([d.action, d.move, d.pdef, d.mdef]).toEqual([9, 7, 8, 4]);
    expect(sheet.attacks[0]).toMatchObject({ hit: { dice: 3, mod: 18 }, damage: { dice: 2, mod: 22 } });
    expect(sheet.skills[0]).toMatchObject({ name: "배드 스테이터스 부여:방심", sl: 1 });
  });
  it("parseDiceMod", () => {
    expect(parseDiceMod("3D+18")).toEqual({ dice: 3, mod: 18 });
    expect(parseDiceMod("7")).toEqual({ dice: 2, mod: 7 });
  });
});
