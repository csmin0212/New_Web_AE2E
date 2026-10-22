import { describe, expect, it } from "vitest";
import { damageTotal, resolveDamage, type DamageWindow } from "./damageRules";

const w: DamageWindow = {
  phase: "after",
  attacker: { name: "고블린", uid: "gm" },
  source: "강타",
  dmgType: "physical",
  base: { expr: "2D+10" },
  targets: [
    { charId: "a", name: "엘린" },
    { charId: "b", name: "렉스" },
  ],
  rolled: { base: 17, total: 25 }, // 직전 증가 +8 포함
  plus: { p1: { by: "고블린", expr: "5", total: 5, uid: "gm", phase: "after" } },
  minus: {
    m1: { by: "엘린", expr: "10", total: 10, uid: "u1", phase: "after", target: "a" },
    m2: { by: "사제", expr: "3", total: 3, uid: "u2", phase: "after", target: "all" },
  },
  covers: { c1: { target: "b", by: { charId: "k", name: "기사" }, uid: "u3" } },
  at: 0,
};

describe("대미지 타이밍", () => {
  it("직후 증가까지 더한 합계", () => {
    expect(damageTotal(w)).toBe(30);
  });
  it("대상별 경감·전원 경감, 커버링이면 받는 사람이 바뀐다", () => {
    const r = resolveDamage(w);
    expect(r[0]).toMatchObject({ recipient: { name: "엘린" }, amount: 17, reduced: 13, covered: false });
    expect(r[1]).toMatchObject({ recipient: { name: "기사" }, amount: 27, reduced: 3, covered: true });
  });
  it("경감이 커도 0 아래로는 안 간다", () => {
    const r = resolveDamage({ ...w, minus: { m: { by: "x", expr: "99", total: 99, uid: "u", phase: "after", target: "all" } } });
    expect(r.every((x) => x.amount === 0)).toBe(true);
  });
});
