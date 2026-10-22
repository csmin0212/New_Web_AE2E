"use client";

import type { User } from "firebase/auth";
import { useState } from "react";
import { fromGoogleSheetGrid, isGoogleArSheet, type GoogleSheetResult } from "@/lib/ar/googleSheet";
import { fetchSheetGridClient, fetchSheetTabs } from "@/lib/campaigns";
import { createEntry, patchEntry, type LibraryEntry } from "@/lib/library";
import { extractSheetId } from "@/lib/sheet/parse";

// 구글 시트(아리안로드 2E 양식) → 보관함. 플레이어도 자기 캐릭터를 이렇게 넣는다.
//   ① 시트 주소 붙여넣기  ② 탭 고르기  ③ 미리보기  ④ 보관함에 넣기 (같은 탭이면 덮어쓰기)

const LAST_URL = "vtt:last-sheet-url";
const TEMPLATE_TABS = /이걸 복사|세션 인원|저장용|백업/;

type Tab = { title: string; gid: string };
type Preview = { tab: Tab; r: GoogleSheetResult; existing?: LibraryEntry };

export function gidOf(url: string): string | undefined {
  return url.match(/[#&?]gid=(\d+)/)?.[1];
}

export function SheetLibraryImport({ user, existing, onDone }: { user: User; existing: LibraryEntry[]; onDone: (msg: string) => void }) {
  const [url, setUrl] = useState(() => {
    try {
      return localStorage.getItem(LAST_URL) ?? "";
    } catch {
      return "";
    }
  });
  const [tabs, setTabs] = useState<Tab[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [previews, setPreviews] = useState<Preview[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sheetId = extractSheetId(url);

  async function loadTabs() {
    setError(null);
    setBusy("탭 목록을 읽는 중…");
    try {
      try {
        localStorage.setItem(LAST_URL, url);
      } catch {}
      const list = await fetchSheetTabs(user, sheetId);
      setTabs(list);
      const g = gidOf(url);
      // 주소에 특정 탭이 들어 있으면 그 탭을 미리 골라 둔다 (양식 탭이 아니면)
      const hit = g ? list.find((t) => t.gid === g && !TEMPLATE_TABS.test(t.title)) : undefined;
      setPicked(new Set(hit ? [hit.gid] : []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "탭 목록을 읽지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  async function read() {
    if (!tabs) return;
    setError(null);
    const chosen = tabs.filter((t) => picked.has(t.gid));
    const out: Preview[] = [];
    try {
      for (let i = 0; i < chosen.length; i++) {
        const tab = chosen[i];
        setBusy(`읽는 중 ${i + 1}/${chosen.length} — ${tab.title}`);
        const grid = await fetchSheetGridClient(user, sheetId, { title: tab.title, gid: tab.gid });
        if (!isGoogleArSheet(grid)) throw new Error(`「${tab.title}」은(는) 캐릭터 시트 양식이 아니에요.`);
        const r = fromGoogleSheetGrid(grid, tab.title);
        out.push({ tab, r, existing: existing.find((e) => e.sheetRef?.id === sheetId && e.sheetRef.gid === tab.gid) });
      }
      setPreviews(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "읽지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!previews) return;
    setError(null);
    let added = 0;
    let updated = 0;
    try {
      for (const p of previews) {
        setBusy(`넣는 중 — ${p.r.sheet.profile.name}`);
        const data = {
          name: p.r.sheet.profile.name,
          kind: "pc" as const,
          ar: p.r.sheet,
          hp: { cur: p.r.hp, max: p.r.hp },
          mp: { cur: p.r.mp, max: p.r.mp },
          fate: { cur: p.r.fate, max: p.r.fate },
          sheetRef: { id: sheetId, gid: p.tab.gid, tab: p.tab.title },
          bio: p.r.bio,
        };
        if (p.existing) {
          // 직접 넣은 그림·태그는 그대로, 시트 내용만 새로
          await patchEntry(user.uid, p.existing.id, data);
          updated++;
        } else {
          const now = Date.now();
          await createEntry(user.uid, { ...data, tags: ["시트"], createdAt: now, updatedAt: now });
          added++;
        }
      }
      onDone(`시트에서 새로 ${added}명, 갱신 ${updated}명을 넣었어요.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "넣지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  const shown = (tabs ?? []).filter((t) => !filter.trim() || t.title.includes(filter.trim()));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 text-sm">
      {!previews && (
        <>
          <ol className="list-inside list-decimal space-y-0.5 text-xs text-muted">
            <li>구글 시트(아리안로드 2E 양식)의 주소를 붙여넣어요. 시트는 「링크가 있는 모든 사용자 보기」로 공유돼 있어야 해요</li>
            <li>「탭 목록」을 눌러 내 캐릭터 탭을 고르고 「읽기」</li>
            <li>미리보기를 확인하고 「보관함에 넣기」 — 시트를 고친 뒤 다시 가져오면 같은 캐릭터를 덮어써요</li>
          </ol>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=…"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setTabs(null);
              }}
            />
            <button className="btn-primary shrink-0" disabled={!sheetId || !!busy} onClick={loadTabs}>
              <span>탭 목록</span>
            </button>
          </div>
          {tabs && (
            <div className="flex min-h-0 flex-1 flex-col rounded border border-line p-2">
              <div className="mb-1 flex items-center gap-2">
                <input className="input py-1 text-xs" placeholder="탭 이름 찾기" value={filter} onChange={(e) => setFilter(e.target.value)} />
                <span className="shrink-0 text-xs text-muted">{picked.size}개 고름</span>
              </div>
              <ul className="grid min-h-0 flex-1 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
                {shown.map((t) => {
                  const template = TEMPLATE_TABS.test(t.title);
                  const on = picked.has(t.gid);
                  const had = existing.some((e) => e.sheetRef?.id === sheetId && e.sheetRef.gid === t.gid);
                  return (
                    <li key={t.gid}>
                      <label className={`flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-xs ${on ? "border-accent bg-accent/15" : "border-line"} ${template ? "opacity-50" : ""}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setPicked((s) => {
                              const n = new Set(s);
                              if (n.has(t.gid)) n.delete(t.gid);
                              else n.add(t.gid);
                              return n;
                            })
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                        {template && <span className="shrink-0 text-[10px] text-muted">양식</span>}
                        {had && <span className="shrink-0 text-[10px] text-accent">보관함에 있음</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex justify-end">
                <button className="btn-primary" disabled={!picked.size || !!busy} onClick={read}>
                  <span>읽기 ({picked.size})</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {previews && (
        <>
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {previews.map((p) => {
              const s = p.r.sheet;
              return (
                <li key={p.tab.gid} className="rounded border border-line p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <b className="font-display text-sm">{s.profile.name}</b>
                    <span className="text-muted">
                      {[s.profile.level != null && `Lv.${s.profile.level}`, [s.profile.mainClass, s.profile.supportClass].filter(Boolean).join("/"), s.profile.race].filter(Boolean).join(" · ")}
                    </span>
                    {p.existing && <span className="ml-auto rounded bg-accent/20 px-1 text-[10px] text-accent">덮어쓰기</span>}
                  </div>
                  <div className="mt-0.5 text-muted">
                    HP {p.r.hp} · MP {p.r.mp} · 페이트 {p.r.fate} · 스킬 {s.skills.length} · 장비 {s.equipment.length} · 휴대품 {s.items.length}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={() => setPreviews(null)}>
              <span>← 다시 고르기</span>
            </button>
            <button className="btn-primary" disabled={!!busy} onClick={save}>
              <span>보관함에 넣기 ({previews.length})</span>
            </button>
          </div>
        </>
      )}
      {busy && <p className="text-xs text-accent">{busy}</p>}
      {error && <p className="text-xs text-hp">{error}</p>}
    </div>
  );
}
