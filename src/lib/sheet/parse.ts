// 아리안로드 2E 구글 시트 양식 파서.
// ARON(arianrod-gallery) src/lib/charsheet.ts 의 parseSheetGrid 를 옮겨 왔다.
// 이상동몽·ARON 둘 다 같은 양식을 쓴다. 칸 위치가 바뀌면 여기만 고치면 된다.

export type StatEntry = { key: string; label: string; value: number | null; mod: number | null };
export type SheetSkill = { name: string; sl: number };

export type ParsedSheet = {
  sheetId: string;
  tab: string;
  name: string;
  charClass: string | null;
  race: string | null;
  attribute: string | null;
  level: number | null;
  hp: number | null; // 최대 HP
  mp: number | null; // 최대 MP
  fate: number | null; // 최대 페이트
  gold: string | null;
  stats: StatEntry[];
  skills: SheetSkill[];
};

export const ABILITY_LABELS = ["근력", "재주", "민첩", "지력", "감지", "정신", "행운"];
const ABILITY_KEYS = ["STR", "DEX", "AGI", "INT", "PER", "SPI", "LUK"];

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }

  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function at(g: string[][], r: number, c: number): string {
  return (g[r]?.[c] ?? "").trim();
}

function find(g: string[][], text: string): [number, number] | null {
  for (let r = 0; r < g.length; r++) {
    const row = g[r] || [];
    for (let c = 0; c < row.length; c++) {
      if ((row[c] ?? "").trim() === text) return [r, c];
    }
  }
  return null;
}

function clean(v: string): string | null {
  const t = v.trim();
  if (!t || t === "-" || t === "#N/A") return null;
  return t;
}

function toNum(v: string): number | null {
  const n = parseInt(v.replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

function toFirstNum(v: string): number | null {
  const m = v.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function below(g: string[][], label: string, dr = 1, dc = 0): string | null {
  const p = find(g, label);
  if (!p) return null;
  return clean(at(g, p[0] + dr, p[1] + dc));
}

function classNames(g: string[][]): string | null {
  const classes = [
    below(g, "메인 클래스", 1, 0) ?? clean(at(g, 35, 1)), // B36
    clean(at(g, 35, 5)), // F36
    clean(at(g, 36, 5)), // F37
  ].filter((v): v is string => Boolean(v));
  return classes.length > 0 ? Array.from(new Set(classes)).join(" / ") : null;
}

// 스킬란: 이름 B65:D104·B144:D181 (병합 셀, 값은 B열), SL G열. SL 1 이상만 배운 스킬.
function parseSkills(g: string[][]): SheetSkill[] {
  const blocks: [number, number][] = [
    [64, 103],
    [143, 180],
  ];
  const skills: SheetSkill[] = [];
  const seen = new Set<string>();
  for (const [from, to] of blocks) {
    for (let r = from; r <= to; r++) {
      const name = at(g, r, 1);
      if (!name || name === "-" || seen.has(name)) continue;
      const sl = toFirstNum(at(g, r, 6));
      if (sl == null || sl < 1) continue;
      seen.add(name);
      skills.push({ name, sl });
    }
  }
  return skills;
}

export function isCharacterSheetGrid(g: string[][]): boolean {
  return !!find(g, "HP");
}

export function parseSheetGrid(g: string[][], tab: string, sheetId: string): ParsedSheet {
  const stats: StatEntry[] = [];
  const base = find(g, "【능력 기본치】");
  if (base) {
    const [hr, hc] = base;
    for (let i = 0; i < 7; i++) {
      const r = hr + 2 + i;
      stats.push({
        key: ABILITY_KEYS[i],
        label: ABILITY_LABELS[i],
        value: toNum(at(g, r, hc + 1)), // 능력 기본치
        mod: toNum(at(g, r, hc + 10)), // 판정에 더하는 능력치 (2D+X 의 X)
      });
    }
  }

  const hp = find(g, "HP");
  const level = below(g, "Level.", 0, 1);
  return {
    sheetId,
    tab,
    name: tab,
    charClass: classNames(g),
    race: below(g, "종족"),
    attribute: below(g, "속성"),
    level: level ? toNum(level) : null,
    hp: hp ? toNum(at(g, hp[0] + 1, hp[1])) : null,
    mp: hp ? toNum(at(g, hp[0] + 1, hp[1] + 1)) : null,
    fate: hp ? toNum(at(g, hp[0] + 1, hp[1] + 2)) : null,
    gold: below(g, "소지금:", 0, 1),
    stats,
    skills: parseSkills(g),
  };
}

// 시트 URL을 붙여넣어도 ID만 뽑아 쓴다.
export function extractSheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return (m ? m[1] : input).trim();
}
