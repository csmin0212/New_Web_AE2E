"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ImageDrop } from "@/components/ImageDrop";
import { JournalView } from "@/components/JournalView";
import { SessionProvider, useSession } from "@/components/session/SessionContext";
import { ThemeRoot } from "@/components/session/ThemeRoot";
import { signInWithGoogle, useAuth } from "@/lib/auth";
import {
  JOURNAL_TYPES,
  createJournal,
  deleteJournal,
  saveJournal,
  showJournal,
  subscribeJournal,
  type JournalEntry,
  type JournalType,
} from "@/lib/journal";
import { useCampaign } from "@/lib/useCampaign";

const SAVE_DELAY = 700;

export default function JournalPage() {
  const { cid } = useParams<{ cid: string }>();
  const { user, loading } = useAuth();
  const state = useCampaign(cid, user?.uid);

  if (loading) return <Center>불러오는 중…</Center>;
  if (!user)
    return (
      <Center>
        <button className="btn-primary" onClick={() => signInWithGoogle()}>
          구글로 로그인
        </button>
      </Center>
    );
  if (state.status === "denied")
    return (
      <Center>
        <p>이 캠페인에 참가하지 않았거나 없는 캠페인이에요.</p>
        <Link href="/" className="btn mt-4">
          홈으로
        </Link>
      </Center>
    );
  if (state.status === "loading") return <Center>불러오는 중…</Center>;

  return (
    <SessionProvider cid={cid} user={user} campaign={state.campaign} members={state.members} characters={state.characters}>
      <ThemeRoot>
        <Journal />
      </ThemeRoot>
    </SessionProvider>
  );
}

//  ┌ 위 띠: 세션으로 · 캠페인 이름 ───────────────────────┐
//  │ 목록 (검색·종류)  │ 읽기 / 고치기                     │
//  └─────────────────────────────────────────────────────┘
function Journal() {
  const { cid, user, isGM, campaign } = useSession();
  const [list, setList] = useState<JournalEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<JournalType | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(() => (typeof window !== "undefined" ? decodeURIComponent(location.hash.slice(1)) || null : null));

  useEffect(() => subscribeJournal(cid, user.uid, isGM, setList, (e) => setError(e.message)), [cid, user.uid, isGM]);

  const shown = list.filter((e) => (filter === "all" || e.type === filter) && (!search.trim() || (e.title + "\n" + e.body).includes(search.trim())));
  const current = list.find((e) => e.id === selected) ?? null;

  function pick(id: string | null) {
    setSelected(id);
    history.replaceState(null, "", id ? `#${id}` : location.pathname);
  }

  async function add(type: JournalType) {
    const id = await createJournal(cid, user.uid, type);
    pick(id);
  }

  return (
    <div className="flex h-dvh flex-col" style={{ background: "var(--pattern), var(--bg)" }}>
      <header className="flex items-center gap-3 border-b border-line bg-panel/90 px-3 py-2">
        <Link href={`/c/${cid}`} className="btn h-8 text-xs">
          <span>← 세션으로</span>
        </Link>
        <div className="leading-tight">
          <div className="font-display font-bold">{campaign.name}</div>
          <div className="font-latin text-[10px] text-accent">JOURNAL · HANDOUTS</div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* 목록 */}
        <aside className={`flex min-h-0 w-full shrink-0 flex-col border-line md:w-72 md:border-r ${current ? "hidden md:flex" : "flex"}`}>
          <div className="space-y-2 border-b border-line p-2">
            <input className="input" placeholder="제목·내용 찾기" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="flex gap-1 text-xs">
              {([["all", "전체"], ...JOURNAL_TYPES.map((t) => [t.id, t.label])] as [JournalType | "all", string][]).map(([k, label]) => (
                <button key={k} className={filter === k ? "btn-primary px-2 py-0.5 text-xs" : "btn px-2 py-0.5 text-xs"} onClick={() => setFilter(k)}>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {shown.length === 0 && <li className="p-3 text-center text-xs text-muted">{list.length ? "찾는 항목이 없어요." : "아직 아무것도 없어요."}</li>}
            {shown.map((e) => (
              <li key={e.id}>
                <button
                  className={`pop flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm ${
                    e.id === selected ? "border-accent bg-accent/15" : "border-line bg-panel/70"
                  }`}
                  onClick={() => pick(e.id)}
                >
                  <span className="shrink-0 rounded bg-panel-2 px-1 text-[10px] whitespace-nowrap text-muted">
                    {JOURNAL_TYPES.find((t) => t.id === e.type)?.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{e.title || "(제목 없음)"}</span>
                  <Visibility e={e} />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-1 border-t border-line p-2">
            {(isGM ? JOURNAL_TYPES : JOURNAL_TYPES.filter((t) => t.id === "note")).map((t) => (
              <button key={t.id} className="btn flex-1 text-xs" onClick={() => add(t.id)} title={t.hint}>
                <span>+ {t.label}</span>
              </button>
            ))}
          </div>
          {error && <p className="p-2 text-xs text-hp">{error}</p>}
        </aside>

        {/* 읽기 · 고치기 */}
        <main className={`min-h-0 min-w-0 flex-1 overflow-y-auto ${current ? "block" : "hidden md:block"}`}>
          {current ? (
            <Entry key={current.id} entry={current} onBack={() => pick(null)} onDeleted={() => pick(null)} />
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">
              <div>
                <p>왼쪽에서 항목을 고르세요.</p>
                {isGM && <p className="mt-1 text-xs">핸드아웃은 플레이어를 골라 따로 보내거나, ‘보여주기’로 모두의 세션 화면에 띄울 수 있어요.</p>}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Visibility({ e }: { e: JournalEntry }) {
  if (e.shared) return <span title="모두 공개">🌐</span>;
  if (e.viewers.length) return <span title={`${e.viewers.length}명에게 공개`} className="text-[11px] text-muted">👤{e.viewers.length}</span>;
  return <span title="비공개">🔒</span>;
}

function Entry({ entry, onBack, onDeleted }: { entry: JournalEntry; onBack: () => void; onDeleted: () => void }) {
  const { cid, user, isGM, members } = useSession();
  const canEdit = isGM || entry.ownerUid === user.uid;
  const [editing, setEditing] = useState(canEdit && !entry.body && entry.title.startsWith("새 "));
  const [draft, setDraft] = useState<JournalEntry | null>(null);
  const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [showMsg, setShowMsg] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const cur = draft ?? entry;

  function change(patch: Partial<JournalEntry>) {
    const next = { ...cur, ...patch };
    setDraft(next);
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setStatus("saving");
      try {
        await saveJournal(cid, next);
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

  const players = members.filter((m) => m.role === "player");
  const mode = cur.shared ? "all" : cur.viewers.length ? "some" : "none";

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button className="btn h-8 text-xs md:hidden" onClick={onBack}>
          <span>← 목록</span>
        </button>
        {canEdit && (
          <div className="flex overflow-hidden rounded-md border border-line text-xs">
            <button className={`px-3 py-1 ${!editing ? "bg-accent text-accent-ink" : "bg-panel-2 text-muted"}`} onClick={() => setEditing(false)}>
              보기
            </button>
            <button className={`px-3 py-1 ${editing ? "bg-accent text-accent-ink" : "bg-panel-2 text-muted"}`} onClick={() => setEditing(true)}>
              고치기
            </button>
          </div>
        )}
        {canEdit && <span className="text-[11px] text-muted">{{ saved: "저장됨", dirty: "고치는 중…", saving: "저장 중…", error: "저장 실패" }[status]}</span>}
        <div className="ml-auto flex gap-1.5">
          {isGM && (
            <button
              className="btn-primary pop h-8 text-xs"
              title="모두에게 공개하고, 세션 화면에 띄웁니다"
              onClick={async () => {
                await showJournal(cid, cur);
                setShowMsg("모두의 세션 화면에 띄웠어요.");
                setTimeout(() => setShowMsg(null), 2500);
              }}
            >
              <span>📣 보여주기</span>
            </button>
          )}
          {canEdit && (
            <button
              className="btn h-8 text-xs text-hp"
              onClick={async () => {
                if (!confirm(`「${cur.title}」을(를) 지울까요?`)) return;
                await deleteJournal(cid, entry.id);
                onDeleted();
              }}
            >
              <span>삭제</span>
            </button>
          )}
        </div>
      </div>
      {showMsg && <p className="mb-2 text-xs text-accent">{showMsg}</p>}

      {editing && canEdit ? (
        <div className="panel space-y-3 p-3 text-sm">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input className="input font-display text-lg font-bold" value={cur.title} onChange={(e) => change({ title: e.target.value })} placeholder="제목" />
            <select className="input w-auto" value={cur.type} onChange={(e) => change({ type: e.target.value as JournalType })}>
              {JOURNAL_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* 누가 볼 수 있나 */}
          <div className="rounded-md border border-line p-2">
            <div className="mb-1 text-xs font-bold">누가 볼 수 있나</div>
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-1">
                <input type="radio" checked={mode === "none"} onChange={() => change({ shared: false, viewers: [] })} /> 🔒 {isGM ? "GM만" : "나만"}
              </label>
              {isGM && (
                <label className="flex items-center gap-1">
                  <input type="radio" checked={mode === "some"} onChange={() => change({ shared: false, viewers: cur.viewers.length ? cur.viewers : players.slice(0, 1).map((p) => p.uid) })} /> 👤 고른 플레이어
                </label>
              )}
              <label className="flex items-center gap-1">
                <input type="radio" checked={mode === "all"} onChange={() => change({ shared: true })} /> 🌐 모두
              </label>
            </div>
            {isGM && mode === "some" && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {players.length === 0 && <span className="text-muted">아직 참가한 플레이어가 없어요.</span>}
                {players.map((p) => (
                  <label key={p.uid} className="flex items-center gap-1 rounded border border-line px-2 py-0.5">
                    <input
                      type="checkbox"
                      checked={cur.viewers.includes(p.uid)}
                      onChange={(e) => change({ viewers: e.target.checked ? [...cur.viewers, p.uid] : cur.viewers.filter((x) => x !== p.uid) })}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <ImageDrop user={user} kind="background" label="그림 (선택)" value={cur.image} onChange={(v) => change({ image: v })} aspect="aspect-video" className="max-w-sm" />

          <label className="block">
            <span className="text-xs text-muted"># 큰 제목 · ## 작은 제목 · - 목록 · &gt; 인용 · **굵게** · --- 구분선</span>
            <textarea className="input mt-1 min-h-[45vh] resize-y leading-relaxed" value={cur.body} onChange={(e) => change({ body: e.target.value })} />
          </label>
        </div>
      ) : (
        <div className="panel p-5">
          <JournalView entry={cur} />
        </div>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center p-6 text-center text-muted">{children}</main>;
}
