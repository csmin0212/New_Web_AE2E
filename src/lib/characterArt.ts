import type { Character } from "./types";

// 캐릭터 그림 세 칸의 쓰임 — 비어 있으면 서로 대신한다
//   standing: 대화 무대에 크게 서는 그림 (배경 없는 전신·반신 PNG 권장)
//   token:    전투 그리드의 말 (보통 동그란 그림)
//   portrait: 채팅·칩의 작은 얼굴
type Art = Pick<Character, "standing" | "token" | "portrait">;

export function stageImageOf(c: Art): string | undefined {
  return c.standing ?? c.token ?? c.portrait;
}

export function tokenImageOf(c: Art): string | undefined {
  return c.token ?? c.portrait ?? c.standing;
}

export function faceOf(c: Art): string | undefined {
  return c.portrait ?? c.token ?? c.standing;
}
