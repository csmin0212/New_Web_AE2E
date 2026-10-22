import { derive } from "./ar/derive";
import type { ArDrop, ArSkill } from "./ar/types";
import { conditionOf, type Condition } from "./battleRules";
import type { Character, Gauge } from "./types";

// 플레이어에게 보여 줄 정보 (공개 설정) — 순수 함수 · 테스트 대상
//
//   비공개 캐릭터(hidden)는 시트 문서 자체를 플레이어가 읽을 수 없다 (보안 규칙).
//   GM 이 고른 항목만 담은 「공개 본」을 GM 화면이 따로 만들어 campaigns/{cid}/reveals/{id} 에 쓴다.
//   설정(RevealConfig)은 캐릭터 문서 안 reveal 칸에 둔다 — GM 만 읽는다.

export type HpView = "hidden" | "cond" | "bar" | "exact";

export type RevealConfig = {
  listed: boolean; // 플레이어 NPC 목록에 보이기 (꺼 두면 존재도 모른다)
  name: boolean; // 꺼 두면 「???」
  image: boolean;
  profile: boolean; // 레벨·분류·속성·종족·클래스
  stats: boolean; // 능력치 7개
  combat: boolean; // 명중·회피·대미지·행동치·이동력·방어
  hp: HpView;
  mp: boolean;
  skills: "none" | "all" | string[]; // 스킬 id 목록
  drops: boolean;
  note?: string; // 플레이어에게 보여 줄 메모 (식별로 알게 된 것 등)
};

export const HP_VIEW_LABEL: Record<HpView, string> = { hidden: "숨김", cond: "상태만 (부상·전투불능)", bar: "막대 (비율만)", exact: "숫자까지" };

export const REVEAL_NOTHING: RevealConfig = {
  listed: false,
  name: false,
  image: false,
  profile: false,
  stats: false,
  combat: false,
  hp: "hidden",
  mp: false,
  skills: "none",
  drops: false,
};

// 처음 비공개로 돌릴 때 — 이름·그림·HP 상태만
export const REVEAL_DEFAULT: RevealConfig = { ...REVEAL_NOTHING, listed: true, name: true, image: true, hp: "cond" };

// 에너미 식별 성공 — 아리안로드에서 식별하면 데이터가 공개된다
export const REVEAL_IDENTIFIED: RevealConfig = {
  listed: true,
  name: true,
  image: true,
  profile: true,
  stats: true,
  combat: true,
  hp: "exact",
  mp: true,
  skills: "all",
  drops: true,
};

export type RevealDoc = {
  charId: string;
  kind: Character["kind"];
  listed: boolean;
  name: string;
  image?: string;
  color?: string;
  profile?: { level?: number; category?: string; element?: string; race?: string; mainClass?: string; supportClass?: string };
  stats?: { label: string; value: number }[];
  combat?: { hit: string; evasion: string; damage: string; action: number; move: number; pdef: number; mdef: number };
  hp?: Gauge;
  hpBar?: number; // 0~100 (막대만 보일 때)
  cond?: Condition | null;
  mp?: Gauge;
  skills?: ArSkill[];
  drops?: ArDrop[];
  note?: string;
};

const dm = (d: { dice: number; mod: number }) => `${d.dice}D${d.mod >= 0 ? "+" : ""}${d.mod}`;
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function isSkillRevealed(cfg: RevealConfig | undefined, skillId: string): boolean {
  if (!cfg) return false;
  return cfg.skills === "all" || (Array.isArray(cfg.skills) && cfg.skills.includes(skillId));
}

export function buildRevealDoc(c: Character, cfg: RevealConfig): RevealDoc {
  const ar = c.ar;
  const d = ar ? derive(ar) : null;
  const p = ar?.profile;
  const doc: RevealDoc = {
    charId: c.id,
    kind: c.kind,
    listed: cfg.listed,
    name: cfg.name ? c.sheet.name : "???",
    color: cfg.name ? c.color : undefined,
    image: cfg.image ? (c.portrait ?? c.token ?? c.standing) : undefined,
  };
  if (cfg.profile && p)
    doc.profile = { level: p.level, category: p.category, element: p.element, race: p.race, mainClass: p.mainClass, supportClass: p.supportClass };
  if (cfg.stats && d) doc.stats = d.stats.map((s) => ({ label: s.label, value: s.value }));
  if (cfg.combat && d) doc.combat = { hit: dm(d.hit), evasion: dm(d.evasion), damage: dm(d.damage), action: d.action, move: d.move, pdef: d.pdef, mdef: d.mdef };
  if (cfg.hp === "exact") doc.hp = c.hp;
  if (cfg.hp === "bar") doc.hpBar = c.hp.max > 0 ? Math.round((Math.max(0, c.hp.cur) / c.hp.max) * 100) : 0;
  if (cfg.hp === "cond" || cfg.hp === "bar") doc.cond = conditionOf(c.hp);
  if (cfg.mp) doc.mp = c.mp;
  if (ar && cfg.skills !== "none") doc.skills = ar.skills.filter((s) => isSkillRevealed(cfg, s.id));
  if (cfg.drops && ar?.drops.length) doc.drops = ar.drops;
  if (cfg.note?.trim()) doc.note = cfg.note.trim();
  return clean(doc);
}

// 칸 순서와 상관없이 같은지 (Firestore 는 돌려줄 때 칸 순서를 바꾼다 — 그대로 비교하면 끝없이 다시 쓴다)
export function sameDoc(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(norm) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])])) : v;
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

// 플레이어에게 보이는 이름·그림 (비공개인데 이름·그림을 안 열었으면 가린다)
export function publicName(c: Pick<Character, "hidden" | "reveal" | "sheet">): string {
  return c.hidden && !(c.reveal ?? REVEAL_DEFAULT).name ? "???" : c.sheet.name;
}
export function imageVisible(c: Pick<Character, "hidden" | "reveal">): boolean {
  return !c.hidden || (c.reveal ?? REVEAL_DEFAULT).image;
}
