// 채팅 입력 해석. 고요의 독무 로그에서 쓰던 관례를 따른다.
//   "@문장"        → 행동 묘사
//   "(문장"        → 잡담(OOC)
//   그 외          → 대사
//   /r 2D+5 명중    → 주사위 (라벨은 식 뒤에)
//   /c 2D+5 명중    → 판정 (크리티컬·펌블 표시)
//   /gr 2D+5       → GM에게만 보이는 굴림
//   /w 이름 내용    → 귓속말
//   /img URL       → 이미지
//   /me 문장        → 행동 묘사 (@와 같음)

export type ChatCommand =
  | { type: "say"; text: string }
  | { type: "action"; text: string }
  | { type: "ooc"; text: string }
  | { type: "roll"; expr: string; label: string; check: boolean; secret: boolean }
  | { type: "whisper"; target: string; text: string }
  | { type: "image"; url: string }
  | { type: "error"; message: string };

const DICE_HEAD = /^[+-]?(\d*[dD]\d*|\d+)([+-](\d*[dD]\d*|\d+))*/;

function splitRoll(rest: string): { expr: string; label: string } | null {
  // 식 안의 공백("2D + 5")은 붙이고, 첫 공백 뒤를 라벨로 본다
  const compact = rest.trim().replace(/\s*([+-])\s*/g, "$1");
  const [head, ...label] = compact.split(/\s+/);
  const m = head?.match(DICE_HEAD);
  if (!m || m[0] !== head) return null;
  return { expr: head, label: label.join(" ") };
}

export function parseChatInput(raw: string): ChatCommand | null {
  const text = raw.trim();
  if (!text) return null;

  if (text.startsWith("/")) {
    const [cmd, ...restParts] = text.slice(1).split(/\s+/);
    const rest = text.slice(1 + cmd.length).trim();
    switch (cmd.toLowerCase()) {
      case "r":
      case "roll":
      case "c":
      case "check":
      case "gr": {
        const parsed = splitRoll(rest);
        if (!parsed) return { type: "error", message: "주사위 식을 적어주세요. 예: /c 2D+5 명중" };
        const lower = cmd.toLowerCase();
        return {
          type: "roll",
          expr: parsed.expr,
          label: parsed.label,
          check: lower === "c" || lower === "check" || lower === "gr",
          secret: lower === "gr",
        };
      }
      case "w": {
        const [target, ...msg] = restParts;
        if (!target || msg.length === 0) return { type: "error", message: "사용법: /w 이름 내용" };
        return { type: "whisper", target, text: msg.join(" ") };
      }
      case "img": {
        if (!/^https?:\/\/\S+$/.test(rest)) return { type: "error", message: "사용법: /img https://..." };
        return { type: "image", url: rest };
      }
      case "me":
        return rest ? { type: "action", text: rest } : null;
      default:
        return { type: "error", message: `모르는 명령이에요: /${cmd}` };
    }
  }

  if (text.startsWith("@")) return { type: "action", text: text.slice(1).trim() };
  if (text.startsWith("(")) return { type: "ooc", text: text.replace(/^\(\s*/, "").replace(/\)\s*$/, "") };
  return { type: "say", text };
}
