// Roll20 식 인라인 굴림 [[...]] 계산기.
// 스킬 효과에 "[[5D6+17+2+20]]", "[[4D6+3*22+20]]", "[[22*5]]" 같은 식이 그대로 들어 있어서
// 곱셈·괄호까지 되는 작은 계산기가 필요하다. 주사위는 NdM / ND(=d6).

export type InlineDice = { sides: number; results: number[] };
export type InlineResult = { expr: string; total: number; dice: InlineDice[] };
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

// 글 안의 [[식]] 을 굴린 결과로 바꾼다. 못 읽는 식(@{속성} 등)은 글자 그대로 둔다.
export function rollInline(text: string, rng: Rng = defaultRng): Segment[] {
  const out: Segment[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    try {
      out.push(evalExpr(m[1], rng));
    } catch {
      out.push(m[0]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function hasInline(text: string): boolean {
  return /\[\[[^\]]+\]\]/.test(text);
}
