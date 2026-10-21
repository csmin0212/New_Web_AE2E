// 툴 안의 아리안로드 2E 캐릭터 시트 (PC·NPC·에너미 공통).
// Roll20 의 한국어 아리안로드 시트(enemy_sheet_toggle 로 PC/에너미 전환)를 기준으로 필드를 잡았다.

export type ArStatKey = "STR" | "DEX" | "AGI" | "INT" | "PER" | "SPI" | "LUK";

export const AR_STATS: { key: ArStatKey; label: string; roll20: string }[] = [
  { key: "STR", label: "근력", roll20: "strength" },
  { key: "DEX", label: "재주", roll20: "dexterity" },
  { key: "AGI", label: "민첩", roll20: "agility" },
  { key: "INT", label: "지력", roll20: "intelligence" },
  { key: "PER", label: "감지", roll20: "perception" },
  { key: "SPI", label: "정신", roll20: "mental" },
  { key: "LUK", label: "행운", roll20: "luck" },
];

export type ArStat = {
  key: ArStatKey;
  base: number; // 능력 기본치
  main: number; // 메인 클래스 수정
  support: number; // 서포트 클래스 수정
  extra: number; // 기타 수정
  skill: number; // 판정에만 붙는 스킬 보너스
  dice: number; // 판정 주사위 수
};

export type DiceMod = { dice: number; mod: number };

export type ArEquip = {
  slot: string;
  name: string;
  weight: number;
  hit: number; // 명중 수정
  atk: number; // 공격력
  action: number; // 행동치 수정
  move: number; // 이동력 수정
  pdef: number;
  mdef: number;
  note: string;
};

export type ArItem = { id: string; name: string; qty: number; weight: number; desc: string };

export type ArSkill = {
  id: string;
  name: string;
  color?: string; // 이름 글자색 (Roll20 시트의 꾸밈 그대로)
  glow?: string; // 이름 빛 번짐 색
  sl: number;
  slMax: string;
  timing: string;
  target: string;
  range: string;
  cost: string; // 숫자면 MP 로 차감
  effect: string; // [[식]] 은 쓸 때 굴린다
  roll?: string; // 스킬에 딸린 굴림 (예: 4d6+17)
};

// 에너미 공격 (명중 18(3D) / 대미지 22(2D))
export type ArAttack = { id: string; name: string; kind: string; hit: DiceMod; damage: DiceMod; damageType: string; range: string };

export type ArCheck = { key: string; label: string; stat: ArStatKey; dice: number; mod: number };

export type ArDrop = { range: string; name: string; price: number; count: number };

export type ArSheet = {
  version: 1;
  kind: "pc" | "enemy";
  profile: {
    name: string;
    player?: string;
    race?: string;
    mainClass?: string;
    supportClass?: string;
    level?: number;
    element?: string;
    category?: string;
    identify?: number; // 에너미 식별치
    guild?: string;
  };
  stats: ArStat[];
  // 전투 수치에 더하는 스킬·기타 수정 (장비 수정은 equipment 에서 합산)
  combat: { hitDice: number; hitMod: number; dmgDice: number; dmgMod: number; evaDice: number; evaMod: number; actionMod: number; moveMod: number; pdefMod: number; mdefMod: number };
  // 에너미처럼 수치가 정해져 있으면 계산 대신 이 값을 쓴다
  fixed?: { evasion?: DiceMod; action?: number; move?: number; pdef?: number; mdef?: number };
  checks: ArCheck[];
  equipment: ArEquip[];
  items: ArItem[];
  skills: ArSkill[];
  attacks: ArAttack[];
  drops: ArDrop[];
  money?: number;
  source: "roll20" | "aron" | "manual";
};

export function emptyStats(): ArStat[] {
  return AR_STATS.map((s) => ({ key: s.key, base: 0, main: 0, support: 0, extra: 0, skill: 0, dice: 2 }));
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
