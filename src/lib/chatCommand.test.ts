import { describe, expect, it } from "vitest";
import { parseChatInput } from "./chatCommand";

describe("parseChatInput", () => {
  it("대사·행동·잡담을 구분한다", () => {
    expect(parseChatInput('" 오셨군요. "')).toEqual({ type: "say", text: '" 오셨군요. "' });
    expect(parseChatInput("@해골정에 가서 고기 파이 폭식")).toEqual({ type: "action", text: "해골정에 가서 고기 파이 폭식" });
    expect(parseChatInput("(여친 2명이랑 놀기")).toEqual({ type: "ooc", text: "여친 2명이랑 놀기" });
    expect(parseChatInput("   ")).toBeNull();
  });

  it("주사위 명령과 라벨을 나눈다", () => {
    expect(parseChatInput("/c 2D+5 명중 판정")).toEqual({
      type: "roll", expr: "2D+5", label: "명중 판정", check: true, secret: false,
    });
    expect(parseChatInput("/r 6d6+13")).toMatchObject({ type: "roll", expr: "6d6+13", label: "", check: false });
    expect(parseChatInput("/r 2D + 5 회피")).toMatchObject({ expr: "2D+5", label: "회피" });
    expect(parseChatInput("/gr 3D")).toMatchObject({ type: "roll", secret: true, check: true });
    expect(parseChatInput("/r 명중")).toMatchObject({ type: "error" });
  });

  it("귓속말과 이미지", () => {
    expect(parseChatInput("/w 넬리 몰래 할 말")).toEqual({ type: "whisper", target: "넬리", text: "몰래 할 말" });
    expect(parseChatInput("/img https://i.imgur.com/h9y70rH.png")).toEqual({
      type: "image", url: "https://i.imgur.com/h9y70rH.png",
    });
    expect(parseChatInput("/img 없음")).toMatchObject({ type: "error" });
    expect(parseChatInput("/xyz")).toMatchObject({ type: "error" });
  });

  it("컷인 명령", () => {
    expect(parseChatInput("/cutin 총공격")).toEqual({ type: "cutin", name: "총공격" });
    expect(parseChatInput("/컷인 홀드 업")).toEqual({ type: "cutin", name: "홀드 업" });
    expect(parseChatInput("/cutin")).toMatchObject({ type: "error" });
  });
});
