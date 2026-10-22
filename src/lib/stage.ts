import type { CastEntry } from "./scene";
import type { ChatMessage, Speaker } from "./types";

// 채팅 기록 → 대화 무대에 누가 서 있고 누가 말하는지 계산 (순수 함수, 테스트 대상)

export type Actor = { key: string; name: string; image?: string; left: number; pinned: boolean };

export type StageLine =
  | { kind: "bubble"; message: ChatMessage; actorKey: string | null } // 인물 말풍선
  | { kind: "narration"; message: ChatMessage } // 아래 띠 지문 (GM 서술, @행동)
  | null;

export type StageView = { actors: Actor[]; line: StageLine; speakingKey: string | null };

const AUTO_WINDOW = 30; // 최근 이만큼의 대사 안에서 말한 사람만 자동으로 무대에 남는다
const MAX_AUTO = 4;
const MAX_ACTORS = 5;

const SLOTS: Record<number, number[]> = {
  1: [50],
  2: [32, 68],
  3: [22, 50, 78],
  4: [16, 39, 61, 84],
  5: [12, 31, 50, 69, 88],
};

export function speakerKey(s: Speaker): string {
  return s.charId ? `char:${s.charId}` : `name:${s.name}`;
}

export function isStageMessage(m: ChatMessage): boolean {
  return !m.to && !m.secret && (m.kind === "say" || m.kind === "action");
}

// offstage: GM 이 무대에서 내린 인물 (말해도 자동으로 다시 오르지 않는다)
export function computeStage(messages: ChatMessage[], cast: Record<string, CastEntry>, autoCast: boolean, offstage: Record<string, true> = {}): StageView {
  const lines = messages.filter(isStageMessage);
  const last = lines[lines.length - 1] ?? null;

  // 1) GM이 고정한 출연진
  const pinned = Object.entries(cast)
    .sort((a, b) => a[1].slot - b[1].slot)
    .map(([, c]) => ({
      key: c.charId ? `char:${c.charId}` : `name:${c.name}`,
      name: c.name,
      image: c.image,
      pinned: true,
    }));

  // 2) 최근에 말한, 그림이 있는 사람 (처음 등장한 순서대로 자리 배치)
  const auto: Omit<Actor, "left">[] = [];
  if (autoCast) {
    const recent = lines.slice(-AUTO_WINDOW);
    const seen = new Set([...pinned.map((p) => p.key), ...Object.keys(offstage)]);
    const picked: Omit<Actor, "left">[] = [];
    for (let i = recent.length - 1; i >= 0 && picked.length < MAX_AUTO; i--) {
      const s = recent[i].speaker;
      const key = speakerKey(s);
      if (!s.image || seen.has(key)) continue;
      seen.add(key);
      picked.push({ key, name: s.name, image: s.image, pinned: false });
    }
    // 새로 말할 때마다 자리가 뒤섞이지 않게: 창 안에서 처음 말한 순서
    const firstIdx = (key: string) => recent.findIndex((m) => speakerKey(m.speaker) === key);
    auto.push(...picked.sort((a, b) => firstIdx(a.key) - firstIdx(b.key)));
  }

  // 같은 인물이 고정+자동이면 고정이 이기고, 최신 그림으로 갱신
  const all = [...pinned, ...auto].slice(0, MAX_ACTORS).map((a) => {
    if (a.pinned && !a.image) {
      const latest = [...lines].reverse().find((m) => speakerKey(m.speaker) === a.key && m.speaker.image);
      return latest ? { ...a, image: latest.speaker.image } : a;
    }
    return a;
  });
  const slots = SLOTS[all.length] ?? [];
  const actors: Actor[] = all.map((a, i) => ({ ...a, left: slots[i] }));

  if (!last) return { actors, line: null, speakingKey: null };

  const key = speakerKey(last.speaker);
  const onStage = actors.some((a) => a.key === key);
  // 행동 묘사, 혹은 그림도 캐릭터도 없는 화자(GM 서술)는 아래 띠 지문으로
  const isNarration = last.kind === "action" || (!onStage && !!last.speaker.narrator);
  return {
    actors,
    speakingKey: onStage ? key : null,
    line: isNarration ? { kind: "narration", message: last } : { kind: "bubble", message: last, actorKey: onStage ? key : null },
  };
}

// "[제 3왕녀] 앤드리아" → { title: "제 3왕녀", name: "앤드리아" }
export function splitTitle(full: string): { title: string | null; name: string } {
  const m = full.match(/^\s*\[([^\]]+)\]\s*(.+)$/);
  return m ? { title: m[1], name: m[2] } : { title: null, name: full };
}
