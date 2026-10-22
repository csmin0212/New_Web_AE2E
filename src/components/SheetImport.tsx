"use client";

import type { User } from "firebase/auth";
import { useState } from "react";
import { fromAron, isAronMonster } from "@/lib/ar/aron";
import { fromRoll20, isRoll20Export } from "@/lib/ar/roll20";
import { emptyStats, type ArSheet } from "@/lib/ar/types";
import { fromGoogleSheetGrid, isGoogleArSheet } from "@/lib/ar/googleSheet";
import { addArCharacter, addCharacter, fetchSheet, fetchSheetGridClient } from "@/lib/campaigns";
import { extractSheetId } from "@/lib/sheet/parse";
import type { Character, Member } from "@/lib/types";

const LAST_SHEET_KEY = "trpg-vtt:last-sheet";

type Mode = "google" | "json" | "blank";

// 캐릭터 추가 — 구글 시트 / JSON(Roll20 내보내기·ARON 에너미) / 빈 에너미
export function SheetImport({
  cid,
  user,
  members,
  nextOrder,
  onDone,
}: {
  cid: string;
  user: User;
  members: Member[];
  nextOrder: number;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<Mode>("json");
  const [sheetId, setSheetId] = useState(() => {
    try {
      return localStorage.getItem(`${LAST_SHEET_KEY}:${cid}`) ?? "";
    } catch {
      return "";
    }
  });
  const [tab, setTab] = useState("");
  const [json, setJson] = useState("");
  const [blankName, setBlankName] = useState("");
  const [kind, setKind] = useState<Character["kind"]>("pc");
  const [ownerUid, setOwnerUid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const owner = kind === "pc" ? ownerUid || null : null;

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      setDone(await fn());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "불러오지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function importJson(): Promise<string> {
    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch {
      throw new Error("JSON 형식이 아니에요. Roll20 핸드아웃의 내용을 통째로 붙여넣어 주세요.");
    }
    const list = Array.isArray(data) ? data : [data];
    const names: string[] = [];
    let order = nextOrder;
    for (const item of list) {
      if (isRoll20Export(item)) {
        const r = fromRoll20(item);
        const k: Character["kind"] = r.sheet.kind === "enemy" ? "enemy" : kind;
        await addArCharacter(cid, { ar: r.sheet, hp: r.hp, mp: r.mp, fate: r.fate, portrait: r.avatar, kind: k, ownerUid: k === "pc" ? owner : null, order: order++ });
        names.push(r.sheet.profile.name);
      } else if (isAronMonster(item)) {
        const r = fromAron(item);
        await addArCharacter(cid, {
          ar: r.sheet,
          hp: { cur: r.hp, max: r.hp },
          mp: { cur: r.mp, max: r.mp },
          fate: { cur: 0, max: 0 },
          portrait: r.avatar,
          kind: "enemy",
          ownerUid: null,
          order: order++,
        });
        names.push(r.sheet.profile.name);
      } else {
        throw new Error("알 수 없는 형식이에요. Roll20 내보내기(roll20-character-export) 또는 ARON 몬스터 JSON 이어야 해요.");
      }
    }
    setJson("");
    return `${names.join(", ")} 추가됨`;
  }

  async function importBlank(): Promise<string> {
    const name = blankName.trim();
    const ar: ArSheet = {
      version: 1,
      kind: "enemy",
      profile: { name, level: 1 },
      stats: emptyStats(),
      combat: { hitDice: 2, hitMod: 0, dmgDice: 2, dmgMod: 0, evaDice: 2, evaMod: 0, actionMod: 0, moveMod: 0, pdefMod: 0, mdefMod: 0 },
      fixed: { evasion: { dice: 2, mod: 0 }, action: 0, move: 5, pdef: 0, mdef: 0 },
      checks: [],
      equipment: [],
      items: [],
      skills: [],
      attacks: [],
      drops: [],
      source: "manual",
    };
    await addArCharacter(cid, { ar, hp: { cur: 30, max: 30 }, mp: { cur: 10, max: 10 }, fate: { cur: 0, max: 0 }, kind: "enemy", ownerUid: null, order: nextOrder });
    setBlankName("");
    return `${name} 추가됨 — 시트를 열어 ‘편집’으로 채워 주세요`;
  }

  async function importGoogle(): Promise<string> {
    const id = extractSheetId(sheetId);
    const gid = sheetId.match(/[#&?]gid=(\d+)/)?.[1];
    try {
      localStorage.setItem(`${LAST_SHEET_KEY}:${cid}`, id);
    } catch {}
    // 아리안로드 2E 양식이면 툴 안 시트(스킬·장비·아이템까지)로, 아니면 예전처럼 요약만
    const grid = await fetchSheetGridClient(user, id, { title: tab.trim() || undefined, gid: tab.trim() ? undefined : gid });
    if (isGoogleArSheet(grid)) {
      const r = fromGoogleSheetGrid(grid, tab.trim() || "시트 캐릭터");
      await addArCharacter(cid, { ar: r.sheet, hp: { cur: r.hp, max: r.hp }, mp: { cur: r.mp, max: r.mp }, fate: { cur: r.fate, max: r.fate }, kind, ownerUid: owner, order: nextOrder });
      setTab("");
      return `${r.sheet.profile.name} 추가됨 (스킬 ${r.sheet.skills.length}개)`;
    }
    const sheet = await fetchSheet(user, id, tab.trim());
    await addCharacter(cid, sheet, { kind, ownerUid: owner, order: nextOrder });
    setTab("");
    return `${sheet.name} 추가됨`;
  }

  const ownerPicker = (
    <div className="flex gap-2">
      <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Character["kind"])}>
        <option value="pc">PC</option>
        <option value="npc">NPC</option>
        <option value="enemy">에너미 (GM만 보기)</option>
      </select>
      {kind === "pc" && (
        <select className="input" value={ownerUid} onChange={(e) => setOwnerUid(e.target.value)}>
          <option value="">담당 플레이어 (나중에)</option>
          {members
            .filter((m) => m.role === "player")
            .map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.name}
              </option>
            ))}
        </select>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(
          [
            ["json", "JSON 붙여넣기"],
            ["google", "구글 시트"],
            ["blank", "빈 에너미"],
          ] as const
        ).map(([m, label]) => (
          <button key={m} type="button" className={mode === m ? "btn-primary flex-1 text-xs" : "btn flex-1 text-xs"} onClick={() => setMode(m)}>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {mode === "json" && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(importJson);
          }}
        >
          <p className="text-[11px] text-muted">
            Roll20에서 <code>!vtt-export</code> 로 만든 핸드아웃 내용, 또는 ARON 몬스터 JSON(배열도 가능)을 붙여넣으세요. 에너미 시트는 자동으로 에너미(GM만 보기)로 들어가요.
          </p>
          <textarea className="input min-h-28 font-mono text-[11px]" placeholder='{ "format": "roll20-character-export", ... }' value={json} onChange={(e) => setJson(e.target.value)} />
          {ownerPicker}
          <button className="btn-primary w-full" disabled={busy || !json.trim()}>
            <span>{busy ? "추가하는 중…" : "추가하기"}</span>
          </button>
        </form>
      )}

      {mode === "google" && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(importGoogle);
          }}
        >
          <input className="input" placeholder="시트 URL 또는 ID" value={sheetId} onChange={(e) => setSheetId(e.target.value)} />
          <input className="input" placeholder="탭 이름 (= 캐릭터 이름)" value={tab} onChange={(e) => setTab(e.target.value)} />
          {ownerPicker}
          <button className="btn-primary w-full" disabled={busy || !sheetId.trim() || !tab.trim()}>
            <span>{busy ? "불러오는 중…" : "불러오기"}</span>
          </button>
        </form>
      )}

      {mode === "blank" && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (blankName.trim()) run(importBlank);
          }}
        >
          <input className="input" placeholder="[심해의 패자] 크라켄" value={blankName} onChange={(e) => setBlankName(e.target.value)} />
          <button className="btn-primary w-full" disabled={busy || !blankName.trim()}>
            <span>빈 에너미 만들기</span>
          </button>
        </form>
      )}

      {error && <p className="text-xs text-hp">{error}</p>}
      {done && <p className="text-xs text-accent">{done}</p>}
    </div>
  );
}
