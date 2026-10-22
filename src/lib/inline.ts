// Roll20 식 인라인 굴림 [[...]] 계산기.
// 스킬 효과에 "[[5D6+17+2+20]]", "[[4D6+3*22+20]]", "[[22*5]]" 같은 식이 그대로 들어 있어서
// 곱셈·괄호까지 되는 작은 계산기가 필요하다. 주사위는 NdM / ND(=d6).

export type InlineDice = { sides: number; results: number[] };
// check: 판정 굴림이면 크리티컬(6 이 두 개 이상)·펌블(전부 1)
export type InlineResult = { expr: string; total: number; dice: InlineDice[]; check?: { critical: boolean; fumble: boolean } };
export type Segment = string | InlineResult;

type Rng = () => number;
const defaultRng: Rng = () => {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0] / 2 ** 32;
};

const MAX_DICE = 200;

class Parser {
  private i = 0;
  readonly dice: InlineDice[] = [];
  constructor(
    private s: string,
    private rng: Rng,
  ) {}

  parse(): number {
    const v = this.sum();
    this.ws();
    if (this.i < this.s.length) throw new Error(`읽지 못한 부분: "${this.s.slice(this.i)}"`);
    return v;
  }
  private ws() {
    while (this.s[this.i] === " ") this.i++;
  }
  private sum(): number {
    let v = this.product();
    for (;;) {
      this.ws();
      const c = this.s[this.i];
      if (c !== "+" && c !== "-") return v;
      this.i++;
      const r = this.product();
      v = c === "+" ? v + r : v - r;
    }
  }
  private product(): number {
    let v = this.unary();
    for (;;) {
      this.ws();
      const c = this.s[this.i];
      if (c !== "*" && c !== "/" && c !== "×") return v;
      this.i++;
      const r = this.unary();
      v = c === "/" ? Math.floor(v / r) : v * r;
    }
  }
  private unary(): number {
    this.ws();
    if (this.s[this.i] === "-") {
      this.i++;
      return -this.unary();
    }
    if (this.s[this.i] === "+") {
      this.i++;
      return this.unary();
    }
    return this.atom();
  }
  private atom(): number {
    this.ws();
    if (this.s[this.i] === "(") {
      this.i++;
      const v = this.sum();
      this.ws();
      if (this.s[this.i] !== ")") throw new Error("괄호가 닫히지 않았어요.");
      this.i++;
      return v;
    }
    const m = /^(\d*)\s*[dD]\s*(\d*)|^(\d+)/.exec(this.s.slice(this.i));
    if (!m) throw new Error(`숫자가 필요해요: "${this.s.slice(this.i, this.i + 8)}"`);
    this.i += m[0].length;
    if (m[3] !== undefined) return parseInt(m[3], 10);
    const count = m[1] ? parseInt(m[1], 10) : 1;
    const sides = m[2] ? parseInt(m[2], 10) : 6;
    if (count > MAX_DICE || sides < 2 || sides > 1000) throw new Error("주사위 수가 너무 많아요.");
    const results = Array.from({ length: count }, () => Math.floor(this.rng() * sides) + 1);
    this.dice.push({ sides, results });
    return results.reduce((a, b) => a + b, 0);
  }
}

export function evalExpr(expr: string, rng: Rng = defaultRng): InlineResult {
  const p = new Parser(expr.trim(), rng);
  const total = p.parse();
  return { expr: expr.trim(), total, dice: p.dice };
}

function judge(r: InlineResult): InlineResult {
  const d6 = r.dice.filter((d) => d.sides === 6).flatMap((d) => d.results);
  if (!d6.length) return r;
  return { ...r, check: { critical: d6.filter((v) => v === 6).length >= 2, fumble: d6.every((v) => v === 1) } };
}

// 글 안의 [[식]] 을 굴린 결과로 바꾼다. 못 읽는 식(@{속성} 등)은 글자 그대로 둔다.
//   「명중 판정은 [6D+25]」처럼 판정 뒤에 오는 [식] 은 판정 굴림으로 굴린다 (크리티컬·펌블)
//   [[식]] 앞에 「판정」이 붙어 있어도 판정 굴림
export function rollInline(text: string, rng: Rng = defaultRng): Segment[] {
  const out: Segment[] = [];
  const re = /\[\[([^\]]+)\]\]|(판정[은는:]?\s*)\[(\d+\s*[dD](?:\s*[+-]\s*\d+)*)\]/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const isCheck = /판정[은는:]?\s*$/.test(text.slice(Math.max(0, m.index - 12), m.index));
      try {
        const r = evalExpr(m[1], rng);
        out.push(isCheck ? judge(r) : r);
      } catch {
        out.push(m[0]);
      }
    } else {
      out.push(m[2]);
      try {
        out.push(judge(evalExpr(m[3], rng)));
      } catch {
        out.push(`[${m[3]}]`);
      }
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// 카드 속 판정 굴림 중 크리티컬·펌블이 있으면
export function checkOutcome(segments: Segment[]): "critical" | "fumble" | null {
  for (const s of segments) if (typeof s !== "string" && s.check?.critical) return "critical";
  for (const s of segments) if (typeof s !== "string" && s.check?.fumble) return "fumble";
  return null;
}

export function hasInline(text: string): boolean {
  return /\[\[[^\]]+\]\]/.test(text);
}

// 같은 주사위 식인지 ("6D+25" = "6d6 + 25") — 스킬 카드에서 같은 굴림을 두 번 하지 않게
export function sameExpr(a: string, b: string): boolean {
  const norm = (e: string) => e.toLowerCase().replace(/\s+/g, "").replace(/^\+/, "").replace(/(\d+)d(?!\d)/g, "$1d6");
  return norm(a) === norm(b);
}

// 효과 문장 안에서 이미 굴린 식이면 따로 굴리지 않는다
export function alreadyRolled(segments: Segment[], expr: string): boolean {
  return segments.some((seg) => typeof seg !== "string" && sameExpr(seg.expr, expr));
}
