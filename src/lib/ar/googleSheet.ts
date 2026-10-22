import { derive } from "./derive";
import { AR_STATS, emptyStats, newId, type ArCheck, type ArEquip, type ArItem, type ArSheet, type ArSkill, type ArStatKey } from "./types";

// 아리안로드 2E 구글 시트 양식("이걸 복사!" 탭을 복사해 쓰는 양식) → 툴 안 시트(ArSheet)
// 칸 번호를 박지 않고 "【능력 기본치】", "명중 판정", "스킬 이름" 같은 글자 칸을 찾아 그 주변을 읽는다.
// 그래서 탭마다 줄이 조금 밀려 있어도 읽힌다.

type Grid = string[][];

const cell = (g: Grid, r: number, c: number) => (g[r]?.[c] ?? "").trim();
const blank = (v: string) => !v || v === "-" || v === "#N/A" || v === "FALSE";
const num = (v: string) => {
  const m = v.replace(/,/g, "").match(/-?\d+/);
  return m ? parseInt(m[0], 10) : 0;
};
const dice = (v: string) => {
  const m = v.match(/(\d+)\s*D/i);
  return m ? parseInt(m[1], 10) : 0;
};

function find(g: Grid, text: string, from = 0): [number, number] | null {
  for (let r = from; r < g.length; r++) {
    const row = g[r] ?? [];
    for (let c = 0; c < row.length; c++) if ((row[c] ?? "").trim() === text) return [r, c];
  }
  return null;
}
function findAll(g: Grid, text: string): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r < g.length; r++) for (let c = 0; c < (g[r]?.length ?? 0); c++) if ((g[r][c] ?? "").trim() === text) out.push([r, c]);
  return out;
}
// 같은 줄에서 c 오른쪽으로 머리글 text 가 있는 칸
function colRight(g: Grid, r: number, c: number, text: string, span = 16): number | null {
  for (let x = c; x <= c + span; x++) if (cell(g, r, x) === text) return x;
  return null;
}
function below(g: Grid, text: string): string {
  const p = find(g, text);
  return p ? cell(g, p[0] + 1, p[1]) : "";
}

const STAT_BY_LABEL: Record<string, ArStatKey> = Object.fromEntries(
  [
    ["근력", "STR"],
    ["재주", "DEX"],
    ["민첩", "AGI"],
    ["지력", "INT"],
    ["감지", "PER"],
    ["정신", "SPI"],
    ["행운", "LUK"],
  ] as const,
);

export function isGoogleArSheet(g: Grid): boolean {
  return !!find(g, "【능력 기본치】") && !!find(g, "명중 판정");
}

export type GoogleSheetResult = {
  sheet: ArSheet;
  hp: number;
  mp: number;
  fate: number;
  bio?: string; // 「캐릭터 설정, 소개, 메모」 칸
};

export function fromGoogleSheetGrid(g: Grid, tabName: string): GoogleSheetResult {
  // ── 프로필 ──
  const lv = find(g, "Level.");
  const level = lv ? num(cell(g, lv[0], lv[1] + 1)) : undefined;
  const nameCell = lv ? cell(g, lv[0] + 1, lv[1]) : "";
  const name = !blank(nameCell) && nameCell !== "온라인 이름" ? nameCell : tabName;
  const opt = (v: string) => (blank(v) ? undefined : v);
  const goldPos = find(g, "소지금:");

  // ── 능력치: 【능력 기본치】 아래 7줄. 기본치 | 보너스 | 메인 | 서브 | 스킬 | 기타 | 【능력치】 | 판정 수정 | 다이스 | 고정치 ──
  const stats = emptyStats();
  const base = find(g, "【능력 기본치】");
  if (base) {
    const [hr, hc] = base;
    for (let i = 0; i < 7; i++) {
      const r = hr + 2 + i;
      const key = STAT_BY_LABEL[cell(g, r, hc)] ?? AR_STATS[i].key;
      const st = stats.find((s) => s.key === key)!;
      st.base = num(cell(g, r, hc + 1));
      st.main = num(cell(g, r, hc + 3));
      st.support = num(cell(g, r, hc + 4));
      st.extra = num(cell(g, r, hc + 5)) + num(cell(g, r, hc + 6)); // 스킬로 오른 능력치 + 기타
      st.skill = num(cell(g, r, hc + 8)); // 판정에만 붙는 수정
      st.dice = dice(cell(g, r, hc + 9)) || 2;
    }
  }

  // ── 장비 ──
  const equipment: ArEquip[] = [];
  const weapon = find(g, "종별");
  if (weapon) {
    const [hr, hc] = weapon;
    const cName = colRight(g, hr, hc, "이름") ?? hc + 1;
    const cW = colRight(g, hr, hc, "중량") ?? hc + 4;
    const cHit = colRight(g, hr, hc, "명중") ?? hc + 5;
    const cAtk = colRight(g, hr, hc, "공격력") ?? hc + 6;
    const cAct = colRight(g, hr, hc, "행동") ?? hc + 7;
    const cRange = colRight(g, hr, hc, "사거리");
    const cNote = colRight(g, hr, hc, "효과 · 해설");
    for (let r = hr + 1; r < hr + 8 && cell(g, r, hc) !== "합계"; r++) {
      const n = cell(g, r, cName);
      if (blank(n)) continue;
      equipment.push({
        slot: cell(g, r, hc) || "무기",
        name: n,
        weight: num(cell(g, r, cW)),
        hit: num(cell(g, r, cHit)),
        atk: num(cell(g, r, cAtk)),
        action: num(cell(g, r, cAct)),
        move: 0,
        pdef: 0,
        mdef: 0,
        note: [cRange != null && !blank(cell(g, r, cRange)) ? `사거리 ${cell(g, r, cRange)}` : "", cNote != null ? cell(g, r, cNote) : ""].filter(Boolean).join(" · "),
      });
    }
  }
  const armor = find(g, "방어구");
  if (armor) {
    // 방어구 머리글 줄 (부위·이름·중량·회피·물방·마방·이동) — 다음 「부위」 머리글(장신구) 전까지
    const hr = armor[0] + 1;
    const hc = armor[1];
    const cName = colRight(g, hr, hc, "이름") ?? hc + 1;
    const cW = colRight(g, hr, hc, "중량") ?? hc + 4;
    const cP = colRight(g, hr, hc, "물방") ?? hc + 6;
    const cM = colRight(g, hr, hc, "마방") ?? hc + 7;
    const cMv = colRight(g, hr, hc, "이동") ?? hc + 8;
    const cNote = colRight(g, hr, hc, "효과 · 해설");
    let r = hr + 1;
    for (; r < hr + 8 && cell(g, r, hc) !== "부위" && cell(g, r, hc) !== "합계"; r++) {
      const n = cell(g, r, cName);
      if (blank(n)) continue;
      equipment.push({
        slot: cell(g, r, hc) || "방어구",
        name: n,
        weight: num(cell(g, r, cW)),
        hit: 0,
        atk: 0,
        action: 0,
        move: num(cell(g, r, cMv)),
        pdef: num(cell(g, r, cP)),
        mdef: num(cell(g, r, cM)),
        note: cNote != null ? cell(g, r, cNote) : "",
      });
    }
    // 장신구
    if (cell(g, r, hc) === "부위") {
      const ar2 = r;
      const cName2 = colRight(g, ar2, hc, "이름") ?? hc + 1;
      const cW2 = colRight(g, ar2, hc, "중량") ?? hc + 4;
      const cNote2 = colRight(g, ar2, hc, "효과 · 해설");
      for (let rr = ar2 + 1; rr < ar2 + 6 && cell(g, rr, hc) !== "합계"; rr++) {
        const n = cell(g, rr, cName2);
        if (blank(n)) continue;
        equipment.push({ slot: cell(g, rr, hc) || "장신구", name: n, weight: num(cell(g, rr, cW2)), hit: 0, atk: 0, action: 0, move: 0, pdef: 0, mdef: 0, note: cNote2 != null ? cell(g, rr, cNote2) : "" });
      }
    }
  }

  // ── 휴대품: 「휴대품」 머리글 중 같은 줄에 「수량」이 있는 것 ──
  const items: ArItem[] = [];
  for (const [hr, hc] of findAll(g, "휴대품")) {
    const cQty = colRight(g, hr, hc, "수량", 8);
    if (cQty == null) continue;
    const cNote = colRight(g, hr, hc, "효과 · 해설", 8);
    const cW = colRight(g, hr, hc, "중량", 8);
    for (let r = hr + 1; r < hr + 40; r++) {
      const n = cell(g, r, hc);
      if (n === "스킬" || n === "파워") break;
      if (blank(n) || /^\d+$/.test(n)) continue;
      items.push({ id: newId(), name: n, qty: num(cell(g, r, cQty)) || 1, weight: cW != null ? num(cell(g, r, cW)) : 0, desc: cNote != null ? cell(g, r, cNote) : "" });
    }
  }

  // ── 스킬·파워: 「스킬 이름」「파워 이름」 머리글마다 아래 줄들 ──
  const skills: ArSkill[] = [];
  const headers = [...findAll(g, "스킬 이름"), ...findAll(g, "파워 이름")].sort((a, b) => a[0] - b[0]);
  for (const [hr, hc] of headers) {
    const power = cell(g, hr, hc) === "파워 이름";
    const col = (t: string) => colRight(g, hr, hc, t, 40);
    const cKind = col("분류");
    const cSl = col(power ? "PL" : "SL");
    const cMax = col(power ? "PL상한" : "SL상한");
    const cTiming = col("타이밍");
    const cRange = col("사거리");
    const cJudge = col("판정");
    const cTarget = col("대상");
    const cCost = col("코스트");
    const cCond = col("사용 조건");
    const cEffect = col("효과");
    const cCrit = col("크리티컬");
    const next = headers.find(([r]) => r > hr)?.[0] ?? hr + 45;
    for (let r = hr + 1; r < Math.min(next, hr + 45); r++) {
      const n = cell(g, r, hc);
      if (blank(n) || n === "파워" || n === "일반 스킬" || n === "스킬") continue;
      const get = (c: number | null) => (c == null ? "" : cell(g, r, c));
      const judge = get(cJudge);
      const cond = get(cCond);
      const crit = get(cCrit);
      const kind = get(cKind);
      const head = [!blank(kind) && `분류: ${kind}`, !blank(judge) && `판정: ${judge}`, !blank(cond) && `사용 조건: ${cond}`].filter(Boolean).join(" · ");
      skills.push({
        id: newId(),
        name: power ? `[파워] ${n}` : n,
        sl: num(get(cSl)) || 1,
        slMax: get(cMax),
        timing: blank(get(cTiming)) ? "" : get(cTiming),
        target: blank(get(cTarget)) ? "" : get(cTarget),
        range: blank(get(cRange)) ? "" : get(cRange),
        cost: blank(get(cCost)) ? "" : get(cCost),
        effect: [head && `*${head}*`, get(cEffect), !blank(crit) && `\n크리티컬: ${crit}`].filter(Boolean).join("\n"),
      });
    }
  }

  // ── 특수 판정 ──
  const checks: ArCheck[] = [];
  const sp = find(g, "특수 판정");
  if (sp) {
    const [hr, hc] = sp;
    let stat: ArStatKey = "DEX";
    for (let r = hr + 2; r < hr + 14; r++) {
      const s = STAT_BY_LABEL[cell(g, r, hc)];
      if (s) stat = s;
      const label = cell(g, r, hc + 1);
      if (blank(label) || cell(g, r, hc) === "시나리오 기록") break;
      checks.push({ key: newId(), label: label.replace(/ 판정$/, ""), stat, dice: dice(cell(g, r, hc + 9)) || 2, mod: num(cell(g, r, hc + 10)) });
    }
  }

  const sheet: ArSheet = {
    version: 1,
    kind: "pc",
    profile: {
      name,
      player: opt(cell(g, find(g, "PL:")?.[0] ?? -1, (find(g, "PL:")?.[1] ?? -2) + 1).replace(/^\(닉네임\)$/, "")),
      race: opt(below(g, "종족")),
      mainClass: opt(below(g, "메인 클래스")),
      supportClass: opt(below(g, "서브 클래스")),
      level,
      element: opt(below(g, "속성")),
      category: opt(below(g, "분류")),
    },
    stats,
    combat: { hitDice: 2, hitMod: 0, dmgDice: 2, dmgMod: 0, evaDice: 2, evaMod: 0, actionMod: 0, moveMod: 0, pdefMod: 0, mdefMod: 0 },
    checks: [],
    equipment,
    items,
    skills,
    attacks: [],
    drops: [],
    money: goldPos ? num(cell(g, goldPos[0], goldPos[1] + 1)) : undefined,
    source: "manual",
  };

  // ── 전투 수치: 시트의 총합이 그대로 나오도록, 능력치·장비로 계산되는 몫과의 차이를 수정치로 넣는다 ──
  const d0 = derive(sheet);
  const hitPos = find(g, "명중 판정");
  if (hitPos) {
    const [r, c] = hitPos;
    const tot = (dr: number) => ({ dice: dice(cell(g, r + dr, c + 9)) || 2, mod: num(cell(g, r + dr, c + 10)) });
    const hit = tot(0);
    const dmg = tot(1);
    const eva = tot(2);
    sheet.combat = {
      hitDice: hit.dice,
      hitMod: hit.mod - d0.hit.mod,
      dmgDice: dmg.dice,
      dmgMod: dmg.mod - d0.damage.mod,
      evaDice: eva.dice,
      evaMod: eva.mod - d0.evasion.mod,
      pdefMod: tot(3).mod - d0.pdef,
      mdefMod: tot(4).mod - d0.mdef,
      actionMod: tot(5).mod - d0.action,
      moveMod: tot(6).mod - d0.move,
    };
  }
  // 특수 판정: 판정치 = 능력치 + mod 이므로 능력치 몫을 뺀다
  const d1 = derive(sheet);
  sheet.checks = checks.map((ck) => ({ ...ck, mod: ck.mod - d1.stat[ck.stat] }));

  const hpPos = find(g, "HP");
  const bio = below(g, "캐릭터 설정, 소개, 메모");
  return {
    sheet: JSON.parse(JSON.stringify(sheet)) as ArSheet,
    hp: hpPos ? num(cell(g, hpPos[0] + 1, hpPos[1])) : 0,
    mp: hpPos ? num(cell(g, hpPos[0] + 1, hpPos[1] + 1)) : 0,
    fate: hpPos ? num(cell(g, hpPos[0] + 1, hpPos[1] + 2)) : 0,
    bio: blank(bio) ? undefined : bio,
  };
}
