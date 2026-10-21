"use client";

import { LoginButton } from "@/components/LoginButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AddToCampaign } from "@/components/library/AddToCampaign";
import { ImportPanel } from "@/components/library/ImportPanel";
import { useAuth } from "@/lib/auth";
import { blankEntry, createEntry, deleteEntries, subscribeLibrary, type LibraryEntry, type LibraryKind } from "@/lib/library";

const KIND_LABEL: Record<LibraryKind, string> = { pc: "PC", npc: "NPC", enemy: "에너미" };
type Sort = "recent" | "name" | "level";

export default function LibraryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<LibraryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<LibraryKind | "all">("all");
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState<LibraryEntry[] | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeLibrary(user.uid, setList, (e) => setError(e.message));
  }, [user]);

  const tags = useMemo(() => Array.from(new Set((list ?? []).flatMap((e) => e.tags))).sort(), [list]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const l = (list ?? []).filter(
      (e) =>
        (kind === "all" || e.kind === kind) &&
        (!tag || e.tags.includes(tag)) &&
        (!t || [e.name, e.ar.profile.mainClass, e.ar.profile.supportClass, e.ar.profile.category, ...e.tags].join(" ").toLowerCase().includes(t)),
    );
    if (sort === "name") l.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "level") l.sort((a, b) => (b.ar.profile.level ?? 0) - (a.ar.profile.level ?? 0));
    return l;
  }, [list, q, kind, tag, sort]);

  if (loading) return <Center>불러오는 중…</Center>;
  if (!user)
    return (
      <Center>
        <LoginButton className="w-72" />
      </Center>
    );

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const chosen = (list ?? []).filter((e) => selected.has(e.id));

  async function create(k: LibraryKind) {
    const name = prompt(`새 ${KIND_LABEL[k]} 이름`);
    if (!name?.trim()) return;
    const id = await createEntry(user!.uid, blankEntry(k, name.trim()));
    router.push(`/library/${id}`);
  }

  function backup() {
    const data = JSON.stringify(chosen.length ? chosen : list, null, 1);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = `trpg-vtt-보관함-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div data-skin="ornate" className="theme-root min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="text-muted hover:text-text" aria-label="홈으로">
            ←
          </Link>
          <h1 className="font-display text-xl font-bold">캐릭터 보관함</h1>
          <span className="text-xs text-muted">{list?.length ?? 0}명</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setImporting(true)}>
              <span>Roll20에서 가져오기</span>
            </button>
            {(["pc", "npc", "enemy"] as const).map((k) => (
              <button key={k} className="btn" onClick={() => create(k)}>
                <span>+ {KIND_LABEL[k]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pb-3">
          <input className="input w-56" placeholder="이름·클래스·태그 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex gap-1">
            {(["all", "pc", "npc", "enemy"] as const).map((k) => (
              <button key={k} className={kind === k ? "btn-primary px-2 py-1 text-xs" : "btn px-2 py-1 text-xs"} onClick={() => setKind(k)}>
                <span>{k === "all" ? "전체" : KIND_LABEL[k]}</span>
              </button>
            ))}
          </div>
          <select className="input w-auto py-1 text-xs" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬">
            <option value="recent">최근 고친 순</option>
            <option value="name">이름 순</option>
            <option value="level">레벨 높은 순</option>
          </select>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <button
                  key={t}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${tag === t ? "border-accent bg-accent/20 text-text" : "border-line text-muted hover:text-text"}`}
                  onClick={() => setTag(tag === t ? null : t)}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 pb-28">
        {error && <p className="mb-3 text-sm text-hp">{error}</p>}
        {list && list.length === 0 && (
          <div className="panel mx-auto max-w-lg p-8 text-center">
            <p className="font-display text-lg">보관함이 비어 있어요</p>
            <p className="mt-2 text-sm text-muted">Roll20에서 캐릭터를 한꺼번에 가져오거나, 새로 만들어 보세요.</p>
            <button className="btn-primary mt-4" onClick={() => setImporting(true)}>
              <span>Roll20에서 가져오기</span>
            </button>
          </div>
        )}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((e) => (
            <li key={e.id} className={`panel group relative overflow-hidden ${selected.has(e.id) ? "ring-2 ring-accent" : ""}`}>
              <label className="absolute top-2 left-2 z-10 grid h-6 w-6 cursor-pointer place-items-center rounded bg-black/60" title="선택">
                <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} aria-label={`${e.name} 선택`} />
              </label>
              <Link href={`/library/${e.id}`} className="block">
                <div className="aspect-square bg-panel-2">
                  {e.portrait ?? e.standing ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.portrait ?? e.standing} alt="" className="h-full w-full object-cover object-top transition group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="font-display grid h-full place-items-center text-4xl text-accent/60">{e.name.slice(0, 1)}</div>
                  )}
                </div>
                <div className="p-2">
                  <div className="flex items-center gap-1">
                    <span className="shrink-0 rounded bg-panel-2 px-1 text-[10px] whitespace-nowrap text-muted">{KIND_LABEL[e.kind]}</span>
                    <span className="font-display truncate font-bold" style={{ color: e.color }}>
                      {e.name}
                    </span>
                  </div>
                  <div className="truncate text-[11px] text-muted">
                    {[e.ar.profile.level != null && `Lv.${e.ar.profile.level}`, e.ar.profile.mainClass, e.ar.profile.category].filter(Boolean).join(" · ") || "—"}
                  </div>
                  <div className="mt-1 flex gap-2 text-[11px] text-muted tabular-nums">
                    <span>HP {e.hp.max}</span>
                    <span>MP {e.mp.max}</span>
                    <span>스킬 {e.ar.skills.length}</span>
                  </div>
                  {e.tags.length > 0 && <div className="mt-1 truncate text-[10px] text-accent/80">{e.tags.map((t) => `#${t}`).join(" ")}</div>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      {chosen.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
            <span className="text-sm">{chosen.length}명 선택</span>
            <button className="text-xs text-muted underline" onClick={() => setSelected(new Set())}>
              선택 해제
            </button>
            <div className="ml-auto flex gap-2">
              <button className="btn" onClick={backup}>
                <span>JSON 백업</span>
              </button>
              <button
                className="btn text-hp"
                onClick={async () => {
                  if (!confirm(`${chosen.length}명을 보관함에서 지울까요? 캠페인에 넣은 사본은 그대로예요.`)) return;
                  await deleteEntries(user.uid, chosen.map((e) => e.id));
                  setSelected(new Set());
                }}
              >
                <span>지우기</span>
              </button>
              <button className="btn-primary" onClick={() => setAdding(chosen)}>
                <span>캠페인에 넣기</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {importing && <ImportPanel user={user} existing={list ?? []} onClose={() => setImporting(false)} />}
      {adding && (
        <AddToCampaign
          user={user}
          entries={adding}
          onClose={() => {
            setAdding(null);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center p-6 text-center text-muted">{children}</main>;
}
