"use client";

import type { User } from "firebase/auth";
import { useState } from "react";
import { importCandidates, parseImport, type ImportCandidate, type LibraryEntry } from "@/lib/library";
import { SheetLibraryImport } from "./SheetLibraryImport";

// Roll20 핸드아웃 내용(여러 개 이어 붙여도 됨) / ARON JSON → 미리보기 → 골라서 보관함에
export function ImportPanel({ user, existing, onClose }: { user: User; existing: LibraryEntry[]; onClose: () => void }) {
  const [mode, setMode] = useState<"sheet" | "roll20">("sheet");
  const [text, setText] = useState("");
  const [list, setList] = useState<ImportCandidate[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [copyImages, setCopyImages] = useState(true);
  const [overwrite, setOverwrite] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function read() {
    setError(null);
    try {
      const l = parseImport(text, existing);
      if (!l.length) throw new Error("붙여넣은 내용이 없어요.");
      setList(l);
      setPicked(new Set(l.map((c) => c.key)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "읽지 못했어요.");
    }
  }

  async function run() {
    if (!list) return;
    setError(null);
    try {
      const chosen = list.filter((c) => picked.has(c.key));
      const r = await importCandidates(user, chosen, { copyImages, overwrite }, (done, total, name) => setProgress({ done, total, name }));
      setResult(
        `새로 ${r.added}명, 갱신 ${r.updated}명` + (r.imageFailures.length ? ` · 그림 복사 실패 ${r.imageFailures.length}명 (원래 주소를 그대로 씀)` : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "가져오지 못했어요.");
    } finally {
      setProgress(null);
    }
  }

  const toggle = (k: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="가져오기">
      <div className="panel flex max-h-[90dvh] w-full max-w-2xl flex-col p-5">
        <header className="mb-3 flex items-center">
          <h2 className="font-display text-lg font-bold">보관함으로 가져오기</h2>
          <button className="btn ml-auto px-2 py-0.5 text-xs" onClick={onClose}>
            <span>닫기 ✕</span>
          </button>
        </header>

        <div className="mb-3 flex overflow-hidden rounded-md border border-line text-sm">
          {(
            [
              ["sheet", "구글 시트에서"],
              ["roll20", "Roll20에서"],
            ] as const
          ).map(([m, label]) => (
            <button key={m} className={`flex-1 px-3 py-1.5 ${mode === m ? "bg-accent font-bold text-accent-ink" : "bg-panel-2 text-muted hover:text-text"}`} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
        </div>

        {mode === "sheet" ? (
          result ? (
            <p className="text-sm text-accent">{result}</p>
          ) : (
            <SheetLibraryImport user={user} existing={existing} onDone={setResult} />
          )
        ) : !list ? (
          <>
            <ol className="mb-2 list-inside list-decimal space-y-0.5 text-xs text-muted">
              <li>
                Roll20 채팅에 <code className="text-text">!vtt-export all</code> (PC만: <code>all pc</code>, 에너미만: <code>all enemy</code>)
              </li>
              <li>핸드아웃 「VTT 내보내기 · 전체」를 열어 내용을 통째로 복사 — 여러 개로 나뉘었으면 전부 이어서 붙여넣어도 돼요</li>
              <li>아래에 붙여넣고 「읽기」. ARON 몬스터 JSON 도 돼요</li>
            </ol>
            <textarea
              className="input min-h-56 flex-1 font-mono text-[11px]"
              placeholder='[ { "format": "roll20-character-export", ... }, ... ]'
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {error && <p className="mt-2 text-xs text-hp">{error}</p>}
            <div className="mt-3 flex justify-end">
              <button className="btn-primary" disabled={!text.trim()} onClick={read}>
                <span>읽기</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-3 text-xs">
              <span className="text-muted">
                {list.length}명 중 {picked.size}명 선택
              </span>
              <button className="text-muted underline" onClick={() => setPicked(new Set(list.map((c) => c.key)))}>
                전부
              </button>
              <button className="text-muted underline" onClick={() => setPicked(new Set())}>
                없음
              </button>
            </div>
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {list.map((c) => (
                <li key={c.key}>
                  <label className="flex cursor-pointer items-center gap-3 rounded border border-line bg-panel-2 px-2 py-1.5">
                    <input type="checkbox" checked={picked.has(c.key)} onChange={() => toggle(c.key)} />
                    {c.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatar} alt="" className="h-9 w-9 rounded-full border border-line object-cover object-top" />
                    ) : (
                      <span className="h-9 w-9 rounded-full bg-panel" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{c.data.name}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {c.data.kind === "enemy" ? "에너미" : "PC"} ·{" "}
                        {[c.data.ar.profile.level && `Lv.${c.data.ar.profile.level}`, c.data.ar.profile.mainClass, c.data.ar.profile.category].filter(Boolean).join(" · ")} · 스킬{" "}
                        {c.data.ar.skills.length} · 아이템 {c.data.ar.items.length}
                      </span>
                    </span>
                    {c.existingId && <span className="rounded bg-accent/15 px-1.5 text-[11px] text-accent">이미 있음</span>}
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 text-xs">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={copyImages} onChange={(e) => setCopyImages(e.target.checked)} />
                그림을 내 저장소로 복사 (Roll20 쪽 그림이 사라져도 안 깨짐)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                「이미 있음」은 새 내용으로 덮어쓰기 (끄면 따로 하나 더 만듦)
              </label>
            </div>
            {progress && (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-black/50">
                  <div className="h-full bg-accent transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  {progress.done}/{progress.total} {progress.name}
                </p>
              </div>
            )}
            {error && <p className="mt-2 text-xs text-hp">{error}</p>}
            {result && <p className="mt-2 text-xs text-accent">{result}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn" disabled={!!progress} onClick={() => setList(null)}>
                <span>다시 붙여넣기</span>
              </button>
              {result ? (
                <button className="btn-primary" onClick={onClose}>
                  <span>완료</span>
                </button>
              ) : (
                <button className="btn-primary" disabled={!!progress || picked.size === 0} onClick={run}>
                  <span>{progress ? "가져오는 중…" : `${picked.size}명 가져오기`}</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
