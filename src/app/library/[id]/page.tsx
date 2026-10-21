"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArSheetEditor } from "@/components/ArSheetEditor";
import { ImageDrop } from "@/components/ImageDrop";
import { AddToCampaign } from "@/components/library/AddToCampaign";
import { signInWithGoogle, useAuth } from "@/lib/auth";
import { createEntry, deleteEntry, saveEntry, subscribeEntry, type LibraryEntry, type LibraryKind } from "@/lib/library";
import type { Gauge } from "@/lib/types";

const SAVE_DELAY = 700;

export default function LibraryEntryPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [entry, setEntry] = useState<LibraryEntry | null | undefined>(undefined);
  const [draft, setDraft] = useState<LibraryEntry | null>(null);
  const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [adding, setAdding] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeEntry(user.uid, id, setEntry);
  }, [user, id]);

  // 고치는 중이 아닐 때만 서버 값을 따라간다
  const current = draft ?? entry ?? null;

  function change(next: LibraryEntry) {
    setDraft(next);
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setStatus("saving");
      try {
        await saveEntry(user!.uid, next);
        setStatus("saved");
        setDraft((d) => (d === next ? null : d));
      } catch {
        setStatus("error");
      }
    }, SAVE_DELAY);
  }

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  if (loading || entry === undefined) return <Center>불러오는 중…</Center>;
  if (!user)
    return (
      <Center>
        <button className="btn-primary" onClick={() => signInWithGoogle()}>
          <span>구글로 로그인</span>
        </button>
      </Center>
    );
  if (!current)
    return (
      <Center>
        <p>보관함에 없는 캐릭터예요.</p>
        <Link href="/library" className="btn mt-4">
          <span>보관함으로</span>
        </Link>
      </Center>
    );

  const e = current;
  const set = (p: Partial<LibraryEntry>) => change({ ...e, ...p });
  const gauge = (k: "hp" | "mp" | "fate", max: number): Gauge => ({ cur: Math.min(e[k].cur, max), max });

  return (
    <div data-skin="ornate" className="theme-root min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/library" className="text-muted hover:text-text" aria-label="보관함으로">
            ←
          </Link>
          <h1 className="font-display truncate text-xl font-bold" style={{ color: e.color }}>
            {e.ar.profile.name || e.name}
          </h1>
          <span className={`text-xs ${status === "error" ? "text-hp" : "text-muted"}`} aria-live="polite">
            {{ saved: "저장됨", dirty: "고치는 중…", saving: "저장 중…", error: "저장 실패 — 연결을 확인하세요" }[status]}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                const { id: _old, ...rest } = e;
                void _old;
                const nid = await createEntry(user.uid, { ...rest, name: `${e.name} (사본)`, ar: { ...e.ar, profile: { ...e.ar.profile, name: `${e.ar.profile.name} (사본)` } }, roll20Id: undefined, createdAt: Date.now(), updatedAt: Date.now() });
                router.push(`/library/${nid}`);
              }}
            >
              <span>복제</span>
            </button>
            <button
              className="btn text-hp"
              onClick={async () => {
                if (!confirm(`${e.name}을(를) 보관함에서 지울까요?`)) return;
                await deleteEntry(user.uid, e.id);
                router.push("/library");
              }}
            >
              <span>지우기</span>
            </button>
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <span>캠페인에 넣기</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="panel space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <ImageDrop user={user} kind="portrait" label="얼굴" value={e.portrait} onChange={(v) => set({ portrait: v })} />
              <ImageDrop user={user} kind="token" label="전투 토큰" value={e.token} onChange={(v) => set({ token: v })} />
            </div>
            <ImageDrop user={user} kind="standing" label="스탠딩 (배경 투명 PNG 권장)" value={e.standing} onChange={(v) => set({ standing: v })} aspect="aspect-[3/4]" />
            <p className="text-[11px] leading-relaxed text-muted">그림 칸을 누르거나, 파일을 끌어다 놓거나, 복사한 그림을 칸을 누른 채 Ctrl+V 하면 올라가요. 주소는 자동으로 들어가요.</p>
          </div>

          <div className="panel space-y-3 p-4 text-xs">
            <label className="block text-muted">
              보관함 분류
              <select className="input mt-1" value={e.kind} onChange={(ev) => set({ kind: ev.target.value as LibraryKind })}>
                <option value="pc">PC</option>
                <option value="npc">NPC</option>
                <option value="enemy">에너미</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-muted">
              이름 색
              <input type="color" value={e.color ?? "#c9a45c"} onChange={(ev) => set({ color: ev.target.value })} />
              {e.color && (
                <button className="underline" onClick={() => set({ color: undefined })}>
                  기본
                </button>
              )}
            </label>
            <div className="text-muted">
              태그
              <div className="mt-1 flex flex-wrap gap-1">
                {e.tags.map((t) => (
                  <button key={t} className="rounded-full border border-line px-2 py-0.5 text-text hover:border-hp" onClick={() => set({ tags: e.tags.filter((x) => x !== t) })} title="눌러서 빼기">
                    #{t} ✕
                  </button>
                ))}
              </div>
              <form
                className="mt-1 flex gap-1"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  const t = tagInput.trim().replace(/^#/, "");
                  if (t && !e.tags.includes(t)) set({ tags: [...e.tags, t] });
                  setTagInput("");
                }}
              >
                <input className="input py-1" placeholder="이상동몽, 보스, 3부…" value={tagInput} onChange={(ev) => setTagInput(ev.target.value)} />
                <button className="btn shrink-0 py-1">
                  <span>추가</span>
                </button>
              </form>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["hp", "mp", "fate"] as const).map((k) => (
                <label key={k} className="block text-muted">
                  {k === "fate" ? "페이트" : k.toUpperCase()} 최대
                  <input
                    type="number"
                    className="input mt-1 px-1.5 py-1 text-center"
                    value={e[k].max}
                    onChange={(ev) => set({ [k]: gauge(k, Math.max(0, parseInt(ev.target.value, 10) || 0)) })}
                  />
                </label>
              ))}
            </div>
          </div>
        </aside>

        <ArSheetEditor sheet={e.ar} onChange={(ar) => set({ ar, name: ar.profile.name || e.name })} />
      </main>

      {adding && <AddToCampaign user={user} entries={[e]} onClose={() => setAdding(false)} />}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center p-6 text-center text-muted">{children}</main>;
}
