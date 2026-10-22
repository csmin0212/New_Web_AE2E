import { describe, expect, it } from "vitest";
import { canPlace, coveredCells, DEFAULT_TERRAINS, terrainEffectAt } from "./terrain";

const defs = { ...DEFAULT_TERRAINS, river: { name: "레드 리버", color: "#c00", effect: "damage" as const, amount: 20 } };

describe("맵 기믹", () => {
  it("큰 토큰은 여러 칸을 덮는다", () => {
    expect(coveredCells({ x: 1, y: 2 }, 2)).toEqual(["1_2", "1_3", "2_2", "2_3"]);
  });
  it("벽이 하나라도 겹치면 놓을 수 없다", () => {
    const terrain = { "3_3": "wall" };
    expect(canPlace({ x: 3, y: 3 }, 1, terrain, defs)).toBe(false);
    expect(canPlace({ x: 2, y: 2 }, 2, terrain, defs)).toBe(false);
    expect(canPlace({ x: 0, y: 0 }, 2, terrain, defs)).toBe(true);
  });
  it("클린업 효과는 가장 센 피해, 없으면 회복", () => {
    const terrain = { "0_0": "danger", "1_0": "river", "5_5": "spring" };
    expect(terrainEffectAt({ x: 0, y: 0 }, 2, terrain, defs)).toEqual({ kind: "damage", amount: 20, name: "레드 리버" });
    expect(terrainEffectAt({ x: 5, y: 5 }, 1, terrain, defs)).toEqual({ kind: "heal", amount: 10, name: "회복의 샘" });
    expect(terrainEffectAt({ x: 9, y: 9 }, 1, terrain, defs)).toBeNull();
  });
});
