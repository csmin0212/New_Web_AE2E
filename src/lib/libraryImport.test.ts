import { describe, expect, it } from "vitest";
import type { LibraryEntry } from "./libraryImport";
import { parseImport, splitJson } from "./libraryImport";

const r20 = (id: string, name: string, enemy = false) => ({
  format: "roll20-character-export",
  id,
  name,
  avatar: `https://files.d20.io/images/${id}/a/med.png`,
  token: `https://files.d20.io/images/${id}/t/thumb.png`,
  attributes: { enemy_sheet_toggle: enemy ? "enemy" : "char", HP: { current: "20", max: "30" } },
  repeating: {},
});

describe("splitJson", () => {
  it("하나·배열·이어 붙인 여러 덩어리", () => {
    expect(splitJson('{"a":1}')).toEqual([{ a: 1 }]);
    expect(splitJson("[1,2]")).toEqual([[1, 2]]);
    expect(splitJson('[{"a":"}"}]\n\n[{"b":2}]')).toEqual([[{ a: "}" }], [{ b: 2 }]]);
    expect(splitJson("  ")).toEqual([]);
    expect(() => splitJson("그냥 글")).toThrow();
  });
});

describe("parseImport", () => {
  it("Roll20 내보내기 여러 명 + 이미 있는 캐릭터 찾기", () => {
    const existing = [{ id: "L1", roll20Id: "C2" } as LibraryEntry];
    const text = JSON.stringify([r20("C1", "유즈"), r20("C2", "고블린", true)]) + "\n" + JSON.stringify(r20("C3", "넬리"));
    const list = parseImport(text, existing);
    expect(list.map((c) => [c.data.name, c.data.kind, c.existingId ?? null])).toEqual([
      ["유즈", "pc", null],
      ["고블린", "enemy", "L1"],
      ["넬리", "pc", null],
    ]);
    expect(list[0].tokenImage).toContain("/t/thumb.png");
    expect(list[0].data.hp).toEqual({ cur: 20, max: 30 });
  });
  it("ARON 몬스터는 에너미, 분류가 태그", () => {
    const [c] = parseImport(JSON.stringify({ name: "길맨", category: "동물", stats: {}, hp: 56 }), []);
    expect(c.data).toMatchObject({ kind: "enemy", tags: ["동물"], hp: { max: 56 } });
  });
  it("모르는 형식은 몇 번째인지 알려준다", () => {
    expect(() => parseImport('[{"x":1}]', [])).toThrow(/1번째/);
  });
});
