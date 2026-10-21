// 주사위 식 파서 + 굴림.
// 아리안로드 표기 "2D"(= 2d6)와 일반 표기 "2d6", "1d100"을 모두 받는다.
// 판정(check) 굴림이면 d6 눈을 보고 크리티컬(6이 2개 이상) / 펌블(전부 1)을 붙인다.

export type DiceTerm = { kind: "dice"; sign: 1 | -1; count: number; sides: number };
export type FlatTerm = { kind: "flat"; sign: 1 | -1; value: number };
export type Term = DiceTerm | FlatTerm;

export type DiceGroup = { sides: number; sign: 1 | -1; results: number[] };

export type RollResult = {
  expr: string; // 정규화된 식 (예: "3D+5")
  label?: string;
  groups: DiceGroup[];
  flat: number;
  total: number;
  check?: { critical: boolean; fumble: boolean; sixes: number };
  fateUsed?: number;
};

const MAX_DICE = 100;
const MAX_SIDES = 1000;

export function parseExpr(input: string): Term[] {
  const src = input.replace(/\s+/g, "");
  if (!src) throw new Error("주사위 식이 비어 있어요.");
  const re = /([+-]?)(?:(\d*)[dD](\d*)|(\d+))/gy;
  const terms: Term[] = [];
  let pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m || m[0] === "" || (terms.length > 0 && !m[1])) {
      throw new Error(`주사위 식을 읽지 못했어요: "${input}"`);
    }
    const sign: 1 | -1 = m[1] === "-" ? -1 : 1;
    if (m[4] !== undefined) {
      terms.push({ kind: "flat", sign, value: parseInt(m[4], 10) });
    } else {
      const count = m[2] ? parseInt(m[2], 10) : 1;
      const sides = m[3] ? parseInt(m[3], 10) : 6;
      if (count < 1 || count > MAX_DICE) throw new Error(`주사위는 1~${MAX_DICE}개까지 굴릴 수 있어요.`);
      if (sides < 2 || sides > MAX_SIDES) throw new Error(`주사위 면 수는 2~${MAX_SIDES}이어야 해요.`);
      terms.push({ kind: "dice", sign, count, sides });
    }
    pos = re.lastIndex;
  }
  return terms;
}

export function formatTerms(terms: Term[]): string {
  return terms
    .map((t, i) => {
      const sign = t.sign < 0 ? "-" : i === 0 ? "" : "+";
      if (t.kind === "flat") return `${sign}${t.value}`;
      return `${sign}${t.count}${t.sides === 6 ? "D" : `d${t.sides}`}`;
    })
    .join("");
}

export type Rng = () => number; // [0, 1)

function die(sides: number, rng: Rng): number {
  return Math.floor(rng() * sides) + 1;
}

export type RollOptions = {
  label?: string;
  check?: boolean; // 판정 굴림이면 크리티컬/펌블 판정
  fate?: number; // 페이트 사용 수 → 그만큼 +1D
  rng?: Rng;
};

export function roll(input: string, opts: RollOptions = {}): RollResult {
  const rng = opts.rng ?? cryptoRng;
  const terms = parseExpr(input);
  const fate = Math.max(0, Math.floor(opts.fate ?? 0));
  if (fate > 0) {
    // 페이트는 판정 주사위(첫 d6 묶음)에 더한다. d6이 없으면 새로 붙인다.
    const d6 = terms.find((t): t is DiceTerm => t.kind === "dice" && t.sides === 6 && t.sign > 0);
    if (d6) d6.count += fate;
    else terms.unshift({ kind: "dice", sign: 1, count: fate, sides: 6 });
  }

  const groups: DiceGroup[] = [];
  let flat = 0;
  let total = 0;
  for (const t of terms) {
    if (t.kind === "flat") {
      flat += t.sign * t.value;
      total += t.sign * t.value;
      continue;
    }
    const results = Array.from({ length: t.count }, () => die(t.sides, rng));
    groups.push({ sides: t.sides, sign: t.sign, results });
    total += t.sign * results.reduce((a, b) => a + b, 0);
  }

  const result: RollResult = { expr: formatTerms(terms), groups, flat, total };
  if (opts.label) result.label = opts.label;
  if (fate > 0) result.fateUsed = fate;
  if (opts.check) result.check = judgeCheck(groups);
  return result;
}

// 아리안로드 2E: 판정에 쓴 d6 중 6이 2개 이상이면 크리티컬, 전부 1이면 펌블.
export function judgeCheck(groups: DiceGroup[]): { critical: boolean; fumble: boolean; sixes: number } {
  const d6 = groups.filter((g) => g.sides === 6 && g.sign > 0).flatMap((g) => g.results);
  const sixes = d6.filter((v) => v === 6).length;
  const fumble = d6.length > 0 && d6.every((v) => v === 1);
  return { critical: !fumble && sixes >= 2, fumble, sixes };
}

function cryptoRng(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}
