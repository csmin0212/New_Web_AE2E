import { fromAron, isAronMonster } from "./ar/aron";
import { fromRoll20, isRoll20Export } from "./ar/roll20";
import type { ArSheet } from "./ar/types";
import type { Gauge } from "./types";

// 보관함 데이터 형식과 붙여넣기 해석 (Firebase 없이 도는 순수 함수 — 테스트 대상)

export type LibraryKind = "pc" | "npc" | "enemy";

export type LibraryEntry = {
  id: string;
  name: string;
  kind: LibraryKind;
  ar: ArSheet;
  hp: Gauge;
  mp: Gauge;
  fate: Gauge;
  portrait?: string; // 얼굴
  standing?: string; // 스탠딩
  token?: string; // 전투 토큰
  color?: string;
  tags: string[];
  roll20Id?: string; // 다시 가져올 때 같은 캐릭터를 알아보는 데 쓴다
  sheetRef?: { id: string; gid?: string; tab: string }; // 구글 시트에서 가져왔으면 그 탭 (다시 불러오기)
  bio?: string; // 시트의 「캐릭터 설정, 소개, 메모」
  createdAt: number;
  updatedAt: number;
};

// ── 일괄 가져오기 ──────────────────────────────────────────

export type ImportCandidate = {
  key: string;
  data: Omit<LibraryEntry, "id">;
  avatar?: string; // 원래 그림 주소 (복사 전)
  tokenImage?: string;
  existingId?: string; // 같은 Roll20 캐릭터가 이미 보관함에 있으면
};

// 붙여넣은 JSON (하나, 배열, Roll20 핸드아웃 여러 개를 이어 붙인 것) → 후보 목록
export function parseImport(text: string, existing: LibraryEntry[]): ImportCandidate[] {
  const chunks = splitJson(text);
  const items = chunks.flatMap((c) => (Array.isArray(c) ? c : [c]));
  const now = Date.now();
  return items.map((item, i) => {
    if (isRoll20Export(item)) {
      const r = fromRoll20(item);
      const roll20Id = (item as { id?: string }).id;
      const kind: LibraryKind = r.sheet.kind === "enemy" ? "enemy" : "pc";
      return {
        key: roll20Id ?? `r${i}`,
        avatar: r.avatar,
        tokenImage: (item as { token?: string }).token || undefined,
        existingId: roll20Id ? existing.find((e) => e.roll20Id === roll20Id)?.id : undefined,
        data: { name: r.sheet.profile.name, kind, ar: r.sheet, hp: r.hp, mp: r.mp, fate: r.fate, tags: [], roll20Id, createdAt: now, updatedAt: now },
      };
    }
    if (isAronMonster(item)) {
      const r = fromAron(item);
      return {
        key: `a${i}`,
        avatar: r.avatar,
        data: {
          name: r.sheet.profile.name,
          kind: "enemy",
          ar: r.sheet,
          hp: { cur: r.hp, max: r.hp },
          mp: { cur: r.mp, max: r.mp },
          fate: { cur: 0, max: 0 },
          tags: r.sheet.profile.category ? [r.sheet.profile.category] : [],
          createdAt: now,
          updatedAt: now,
        },
      };
    }
    throw new Error(`${i + 1}번째 항목을 알아보지 못했어요. Roll20 내보내기나 ARON 몬스터 JSON 이어야 해요.`);
  });
}

// "{..}{..}" 나 "[..]\n[..]" 처럼 핸드아웃 여러 개를 이어 붙여도 읽는다
export function splitJson(text: string): unknown[] {
  const t = text.trim();
  if (!t) return [];
  try {
    return [JSON.parse(t)];
  } catch {
    /* 여러 덩어리 */
  }
  const out: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0 && start >= 0) {
        out.push(JSON.parse(t.slice(start, i + 1)));
        start = -1;
      }
    }
  }
  if (!out.length) throw new Error("JSON 형식이 아니에요.");
  return out;
}

