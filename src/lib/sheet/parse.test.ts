import { describe, expect, it } from "vitest";
import { extractSheetId, parseCsv, parseSheetGrid } from "./parse";

// 실제 시트 양식의 라벨 위치를 흉내 낸 작은 격자
function grid(): string[][] {
  const g: string[][] = Array.from({ length: 182 }, () => Array(40).fill(""));
  g[2][1] = "Level.";
  g[2][2] = "7";
  g[4][1] = "종족";
  g[5][1] = "휴린";
  g[4][5] = "속성";
  g[5][5] = "빛";
  g[6][14] = "소지금:";
  g[6][15] = "1,250G";
  g[10][3] = "HP";
  g[11][3] = "58";
  g[11][4] = "34";
  g[11][5] = "6";
  g[34][1] = "메인 클래스";
  g[35][1] = "아콜라이트";
  g[35][5] = "프리스트";
  g[17][11] = "【능력 기본치】";
  const base = [9, 11, 12, 18, 10, 15, 9];
  base.forEach((v, i) => {
    g[19 + i][12] = String(v);
    g[19 + i][21] = String(Math.floor(v / 3) + 1);
  });
  g[64][1] = "힐";
  g[64][6] = "3";
  g[65][1] = "미배움";
  g[65][6] = "0";
  g[143][1] = "프로텍션";
  g[143][6] = "1";
  return g;
}

describe("parseSheetGrid", () => {
  const s = parseSheetGrid(grid(), "엘라", "sheet123");

  it("기본 정보를 읽는다", () => {
    expect(s.name).toBe("엘라");
    expect(s.level).toBe(7);
    expect(s.race).toBe("휴린");
    expect(s.attribute).toBe("빛");
    expect(s.charClass).toBe("아콜라이트 / 프리스트");
    expect(s.gold).toBe("1,250G");
  });

  it("HP·MP·페이트 최대치를 읽는다", () => {
    expect([s.hp, s.mp, s.fate]).toEqual([58, 34, 6]);
  });

  it("능력치 7종을 읽는다", () => {
    expect(s.stats.map((x) => x.label)).toEqual(["근력", "재주", "민첩", "지력", "감지", "정신", "행운"]);
    expect(s.stats[3]).toEqual({ key: "INT", label: "지력", value: 18, mod: 7 });
  });

  it("SL 1 이상 스킬만 가져온다", () => {
    expect(s.skills).toEqual([
      { name: "힐", sl: 3 },
      { name: "프로텍션", sl: 1 },
    ]);
  });
});

describe("helpers", () => {
  it("CSV 따옴표와 쉼표를 처리한다", () => {
    expect(parseCsv('a,"b,c","d""e"\n1,2,3')).toEqual([
      ["a", "b,c", 'd"e'],
      ["1", "2", "3"],
    ]);
  });
  it("시트 URL에서 ID를 뽑는다", () => {
    expect(extractSheetId("https://docs.google.com/spreadsheets/d/abc_DEF-123/edit#gid=0")).toBe("abc_DEF-123");
    expect(extractSheetId("  abc  ")).toBe("abc");
  });
});
