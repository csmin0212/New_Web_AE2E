"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CampaignShell } from "@/components/campaign/CampaignShell";
import { ProfileEditor, type ProfileDraft } from "@/components/campaign/ProfileEditor";
import "@/components/campaign/showcase.css";
import { JournalBody } from "@/components/JournalView";
import { useSession } from "@/components/session/SessionContext";
import { playTransition } from "@/lib/fx";
import { patchJournal, showJournal, subscribeJournal, type JournalEntry } from "@/lib/journal";
import { updateScene } from "@/lib/scene";

export default function AtlasPage() {
  return (
    <CampaignShell active="atlas">
      <Atlas />
    </CampaignShell>
  );
}

const BLANK: ProfileDraft = { type: "place", title: "", body: "", shared: false, viewers: [] };

//  ┌ 나라·권역별 풍경 카드 ───────────────────┐
//  └ 누르면 큰 풍경 + 설명, GM 은 「배경으로」 ┘
function Atlas() {
  const { cid, user, isGM, scene } = useSession();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProfileDraft | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => subscribeJournal(cid, user.uid, isGM, (l) => setEntries(l.filter((e) => e.type === "place"))), [cid, user.uid, isGM]);

  const groups = useMemo(() => {
    const q = search.trim();
    const m = new Map<string, JournalEntry[]>();
    for (const e of entries) {
      if (q && !(e.title + e.subtitle + e.body + e.group).includes(q)) continue;
      const g = e.group || "기타 지역";
      m.set(g, [...(m.get(g) ?? []), e]);
    }
    return [...m.entries()];
  }, [entries, search]);
  const groupNames = [...new Set(entries.map((e) => e.group).filter((g): g is string => !!g))];
  const current = entries.find((e) => e.id === open);

  if (current)
    return (
      <PlaceView
        e={current}
        onBack={() => setOpen(null)}
        onEdit={() => setEditing({ ...current })}
        editor={editing && <ProfileEditor draft={editing} groups={groupNames} onClose={() => setEditing(null)} />}
      />
    );

  return (
    <div className="h-full overflow-y-auto">
      <section className="mx-auto max-w-6xl space-y-8 p-4 pb-16">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="font-latin text-[11px] text-accent">ATLAS</div>
            <h2 className="font-display text-xl font-bold">지역 도감</h2>
          </div>
          <input className="input ml-auto w-48" placeholder="지명·설명 찾기" value={search} onChange={(e) => setSearch(e.target.value)} />
          {isGM && (
            <>
              {scene.background && (
                <button
                  className="btn h-8 text-xs"
                  title="세션에 걸려 있는 배경 그림으로 새 지역을 만들어요"
                  onClick={() => setEditing({ ...BLANK, title: scene.place || "", image: scene.background ?? undefined })}
                >
                  <span>지금 배경으로 추가</span>
                </button>
              )}
              <button className="btn-primary pop h-8 text-xs" onClick={() => setEditing({ ...BLANK })}>
                <span>+ 지역 추가</span>
              </button>
            </>
          )}
        </div>
        {groups.length === 0 && (
          <p className="text-sm text-muted">{isGM ? "‘+ 지역 추가’로 마을·던전·나라를 등록하세요. 세션 배경으로 바로 쓸 수 있어요." : "아직 알게 된 지역이 없어요."}</p>
        )}
        {groups.map(([g, list], gi) => (
          <div key={g}>
            <h3 className="font-display mb-2 flex items-center gap-2 text-sm font-bold">
              <span className="h-3 w-1 bg-accent" />
              {g}
              <span className="text-xs font-normal text-muted">{list.length}</span>
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((e, i) => (
                <button key={e.id} className="sc-place sc-rise" style={{ "--i": gi * 3 + i } as CSSProperties} onClick={() => setOpen(e.id)}>
                  {e.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.image} alt="" loading="lazy" />
                  ) : (
                    <span className="absolute inset-0" style={{ background: "var(--pattern), var(--panel-2)" }} />
                  )}
                  <div className="sc-band">
                    <div className="font-display text-lg leading-tight font-bold">{e.title}</div>
                    {e.subtitle && <div className="truncate text-xs opacity-80">{e.subtitle}</div>}
                  </div>
                  {isGM && !e.shared && (
                    <span className="absolute top-1.5 right-1.5 rounded bg-black/70 px-1.5 text-[10px] text-white">{e.viewers.length ? `👤${e.viewers.length}` : "🔒"}</span>
                  )}
                  {scene.background && e.image === scene.background && (
                    <span className="absolute top-1.5 left-1.5 rounded bg-accent px-1.5 text-[10px] font-bold text-accent-ink">지금 여기</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
      {editing && <ProfileEditor draft={editing} groups={groupNames} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PlaceView({ e, onBack, onEdit, editor }: { e: JournalEntry; onBack: () => void; onEdit: () => void; editor: React.ReactNode }) {
  const { cid, user, isGM, scene } = useSession();
  const [msg, setMsg] = useState<string | null>(null);
  const canEdit = isGM || e.ownerUid === user.uid;

  // 암전과 함께 세션 배경·장소 이름을 바꾼다
  async function applyAsBackground() {
    if (!e.image) return;
    await playTransition(cid, "fade", 1200);
    await new Promise((r) => setTimeout(r, 540));
    await updateScene(cid, { background: e.image, place: e.title, mode: "talk" });
    setMsg("세션 배경을 바꿨어요.");
  }

  return (
    <div key={e.id} className="h-full overflow-y-auto">
      <div className="sc-vista">
        {e.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.image} alt="" />
        ) : (
          <div className="h-full w-full" style={{ background: "var(--pattern), var(--panel-2)" }} />
        )}
        <div className="sc-vista-title">
          <small>{e.group || "ATLAS"}</small>
          <h2>{e.title}</h2>
          {e.subtitle && <p className="mt-1 text-sm opacity-85">{e.subtitle}</p>}
        </div>
        <button className="btn absolute top-3 left-3 h-8 text-xs" onClick={onBack}>
          <span>← 도감</span>
        </button>
      </div>
      <div className="mx-auto max-w-3xl space-y-4 p-4 pb-16">
        <div className="flex flex-wrap gap-2">
          {isGM && e.image && (
            <button className="btn-primary pop text-xs" onClick={applyAsBackground} disabled={scene.background === e.image && scene.place === e.title}>
              <span>{scene.background === e.image ? "지금 세션 배경" : "🎬 세션 배경으로"}</span>
            </button>
          )}
          {isGM && (
            <button
              className="btn text-xs"
              onClick={async () => {
                await showJournal(cid, e);
                setMsg("세션 화면에 띄웠어요.");
              }}
            >
              <span>📣 보여주기</span>
            </button>
          )}
          {isGM && (
            <button className="btn text-xs" onClick={() => patchJournal(cid, e.id, { shared: !e.shared, viewers: [] })}>
              <span>{e.shared ? "🌐 공개 중 → 숨기기" : "🔒 숨김 → 공개"}</span>
            </button>
          )}
          {canEdit && (
            <button className="btn ml-auto text-xs" onClick={onEdit}>
              <span>고치기</span>
            </button>
          )}
        </div>
        {msg && <p className="text-xs text-accent">{msg}</p>}
        <div className="panel p-5">
          <JournalBody body={e.body} />
        </div>
      </div>
      {editor}
    </div>
  );
}
