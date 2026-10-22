import { describe, expect, it } from "vitest";
import { borderTransparency, classify } from "./imageShape";

describe("그림 모양 가르기", () => {
  it("세로로 길고 가장자리가 투명하면 스탠딩", () => {
    expect(classify(0.45, 0.9, "a.png").kind).toBe("sprite");
  });
  it("배경이 꽉 찬 그림, 정사각 얼굴, 둥근 토큰은 액자", () => {
    expect(classify(0.45, 0, "a.png").kind).toBe("card"); // 배경 있는 세로 그림
    expect(classify(1, 0.6, "token.png").kind).toBe("token"); // 둥근 토큰 (모서리가 투명한 정사각) → 메달
    expect(classify(1.5, 0, "cg.jpg").kind).toBe("card");
  });
  it("픽셀을 못 읽으면 확장자로 짐작", () => {
    expect(classify(0.5, null, "https://x/a.png?v=1").kind).toBe("sprite");
    expect(classify(0.5, null, "https://x/a.jpg").kind).toBe("card");
  });
  it("테두리 투명 비율", () => {
    const size = 4;
    const data = new Uint8ClampedArray(size * size * 4).fill(255);
    expect(borderTransparency(data, size)).toBe(0);
    for (let i = 3; i < data.length; i += 4) data[i] = 0;
    expect(borderTransparency(data, size)).toBe(1);
  });
});
