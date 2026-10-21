"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CampaignShell } from "@/components/campaign/CampaignShell";
import { ProfileEditor, type ProfileDraft } from "@/components/campaign/ProfileEditor";
import "@/components/campaign/showcase.css";
import { JournalBody } from "@/components/JournalView";
import { Modal } from "@/components/session/EditDialogs";
import { useSession } from "@/components/session/SessionContext";
import { useImageShape } from "@/lib/imageShape";
import { patchJournal, showJournal, subscribeJournal, type JournalEntry } from "@/lib/journal";
import { splitTitle } from "@/lib/stage";
import type { Character } from "@/lib/types";

export default function CastPage() {
  return (
    <CampaignShell active="cast">
      <Cast />
    </CampaignShell>
  );
}

// 무대에 세울 한 사람 — PC(캠페인 캐릭터) 또는 인물 프로필(저널 person)
type Person = {
  key: string;
  name: string;
  title?: string; // 칭호·소속
  image?: string;
  color?: string;
  group: string;
  character?: Character;
  entry?: JournalEntry;
};

function classLine(c?: Character): string | undefined {
  const p = c?.ar?.profile;
  if (!p) return undefined;
  return [p.level != null && `Lv.${p.level}`, [p.mainClass, p.supportClass].filter(Boolean).join("/"), p.race].filter(Boolean).join(" · ") || undefined;
}

//  ┌ PARTY — 파티가 무대 조명 아래 나란히 ───────────────┐
//  ├ CAST — 세력별 인물 카드                              │
//  └ 누르면 큰 프로필                                      ┘
function Cast() {
  const { cid, user, isGM, characters } = useSession();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProfileDraft | null>(null);

  useEffect(() => subscribeJournal(cid, user.uid, isGM, (l) => setEntries(l.filter((e) => e.type === "person"))), [cid, user.uid, isGM]);

  const { party, groups } = useMemo(() => {
    const byChar = new Map(entries.filter((e) => e.charId).map((e) => [e.charId!, e]));
    const party: Person[] = characters
      .filter((c) => c.kind === "pc")
      .map((c) => {
        const e = byChar.get(c.id);
        return {
          key: `char:${c.id}`,
          name: splitTitle(e?.title || c.sheet.name).name,
          title: e?.subtitle || splitTitle(c.sheet.name).title || classLine(c),
          image: e?.image ?? c.standing ?? c.portrait,
          color: c.color,
          group: "PARTY",
          character: c,
          entry: e,
        };
      });
    const partyIds = new Set(party.map((p) => p.character!.id));
    const others: Person[] = entries
      .filter((e) => !e.charId || !partyIds.has(e.charId))
      .map((e) => {
        const c = e.charId ? characters.find((x) => x.id === e.charId) : undefined;
        return {
          key: `entry:${e.id}`,
          name: splitTitle(e.title).name,
          title: e.subtitle || splitTitle(e.title).title || undefined,
          image: e.image ?? c?.standing ?? c?.portrait,
          color: c?.color,
          group: e.group || "그 밖의 인물",
          character: c,
          entry: e,
        };
      });
    const groups = new Map<string, Person[]>();
    for (const p of others) groups.set(p.group, [...(groups.get(p.group) ?? []), p]);
    return { party, groups: [...groups.entries()] };
  }, [characters, entries]);

  const all = [...party, ...groups.flatMap(([, l]) => l)];
  const current = all.find((p) => p.key === open);
  const groupNames = [...new Set(entries.map((e) => e.group).filter((g): g is string => !!g))];
  // 프로필이 없는 NPC 캐릭터 (GM 만 — 만들기 버튼)
  const bare = isGM ? characters.filter((c) => c.kind !== "pc" && !entries.some((e) => e.charId === c.id)) : [];

  function newDraft(c?: Character): ProfileDraft {
    const mine = c?.kind === "pc" && c.ownerUid === user.uid;
    return {
      type: "person",
      title: c?.sheet.name ?? "",
      subtitle: classLine(c),
      image: c?.standing ?? c?.portrait,
      body: "",
      charId: c?.id,
      shared: c?.kind === "pc" || mine, // PC 프로필은 처음부터 모두에게, NPC 는 만날 때까지 비공개
      viewers: [],
    };
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* PARTY */}
      <section className="sc-stage">
        <div className="sc-title">
          PARTY
          <b>모험가들</b>
        </div>
        {party.length ? (
          <div className="sc-row">
            {party.map((p, i) => (
              <Hero key={p.key} p={p} i={i} onOpen={() => setOpen(p.key)} />
            ))}
          </div>
        ) : (
          <p className="relative z-10 p-16 text-center text-sm opacity-70">아직 파티에 PC가 없어요.</p>
        )}
      </section>

      {/* CAST */}
      <section className="mx-auto max-w-6xl space-y-8 p-4 pb-16">
        <div className="flex items-end gap-3">
          <div>
            <div className="font-latin text-[11px] text-accent">CAST</div>
            <h2 className="font-display text-xl font-bold">등장인물</h2>
          </div>
          {isGM && (
            <button className="btn-primary pop ml-auto h-8 text-xs" onClick={() => setEditing(newDraft())}>
              <span>+ 인물 추가</span>
            </button>
          )}
        </div>
        {groups.length === 0 && <p className="text-sm text-muted">{isGM ? "‘+ 인물 추가’로 NPC 프로필을 만들어 보세요. 처음에는 GM만 보이고, 만나면 공개하면 돼요." : "아직 알게 된 인물이 없어요."}</p>}
        {groups.map(([g, list], gi) => (
          <div key={g}>
            <h3 className="font-display mb-2 flex items-center gap-2 text-sm font-bold">
              <span className="h-3 w-1 bg-accent" />
              {g}
              <span className="text-xs font-normal text-muted">{list.length}</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {list.map((p, i) => (
                <button
                  key={p.key}
                  className="sc-card sc-rise"
                  style={{ "--i": gi * 3 + i, "--hero": p.color } as CSSProperties}
                  onClick={() => setOpen(p.key)}
                >
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" loading="lazy" />
                  ) : (
                    <span className="font-display absolute inset-0 grid place-items-center text-5xl text-accent/40">{p.name.slice(0, 1)}</span>
                  )}
                  <div className="sc-band">
                    {p.title && <div className="truncate text-[10px] opacity-80">{p.title}</div>}
                    <div className="font-display truncate font-bold">{p.name}</div>
                  </div>
                  {isGM && p.entry && !p.entry.shared && (
                    <span className="absolute top-1.5 right-1.5 rounded bg-black/70 px-1.5 text-[10px] text-white" title={p.entry.viewers.length ? "고른 플레이어만" : "GM만"}>
                      {p.entry.viewers.length ? `👤${p.entry.viewers.length}` : "🔒"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
        {bare.length > 0 && (
          <div className="rounded-md border border-dashed border-line p-3 text-xs">
            <div className="mb-2 text-muted">프로필이 없는 NPC·에너미 캐릭터 (GM만 보임)</div>
            <div className="flex flex-wrap gap-1.5">
              {bare.map((c) => (
                <button key={c.id} className="btn text-xs" onClick={() => setEditing(newDraft(c))}>
                  <span>+ {c.sheet.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {current && (
        <ProfileView
          p={current}
          onClose={() => setOpen(null)}
          onEdit={() => {
            const e = current.entry;
            setEditing(e ? { ...e } : newDraft(current.character));
          }}
        />
      )}
      {editing && <ProfileEditor draft={editing} groups={groupNames} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Hero({ p, i, onOpen }: { p: Person; i: number; onOpen: () => void }) {
  const shape = useImageShape(p.image);
  return (
    <div className="sc-hero sc-rise" style={{ "--i": i, "--hero": p.color } as CSSProperties} onClick={onOpen} role="button" title={`${p.name} 프로필`}>
      {p.image && shape?.kind === "sprite" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="sc-sprite" src={p.image} alt={p.name} draggable={false} />
      )}
      {p.image && shape?.kind === "card" && (
        <div className="sc-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.image} alt={p.name} draggable={false} />
        </div>
      )}
      {!p.image && <div className="sc-frame grid place-items-center bg-black/40 text-5xl">{p.name.slice(0, 1)}</div>}
      <div className="sc-plate">
        {p.title && <small>{p.title}</small>}
        <b>{p.name}</b>
      </div>
    </div>
  );
}

function ProfileView({ p, onClose, onEdit }: { p: Person; onClose: () => void; onEdit: () => void }) {
  const { cid, user, isGM } = useSession();
  const e = p.entry;
  const c = p.character;
  const canEdit = isGM || (e ? e.ownerUid === user.uid : c?.ownerUid === user.uid);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Modal title={p.group === "PARTY" ? "PARTY" : p.group} onClose={onClose} width={860}>
      <div className="grid gap-5 md:grid-cols-[minmax(0,320px)_1fr]" style={{ "--hero": p.color } as CSSProperties}>
        <div className="relative overflow-hidden rounded-md border border-line bg-panel-2">
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" className="max-h-[60vh] w-full object-contain" />
          ) : (
            <div className="font-display grid aspect-[3/4] place-items-center text-6xl text-accent/40">{p.name.slice(0, 1)}</div>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          <div>
            {p.title && <div className="text-sm text-muted">{p.title}</div>}
            <h2 className="font-display text-3xl leading-tight font-black" style={{ color: p.color }}>
              {p.name}
            </h2>
            {c && classLine(c) && <div className="font-latin mt-1 text-[11px] text-accent">{classLine(c)}</div>}
          </div>
          {e ? <JournalBody body={e.body} /> : <p className="text-sm text-muted">아직 소개가 없어요.</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            {canEdit && (
              <button className="btn text-xs" onClick={onEdit}>
                <span>{e ? "고치기" : "소개 쓰기"}</span>
              </button>
            )}
            {isGM && e && (
              <button
                className="btn text-xs"
                onClick={() => patchJournal(cid, e.id, { shared: !e.shared, viewers: [] })}
                title="플레이어에게 보이기 / 숨기기"
              >
                <span>{e.shared ? "🌐 공개 중 → 숨기기" : "🔒 숨김 → 모두에게 공개"}</span>
              </button>
            )}
            {isGM && e && (
              <button
                className="btn-primary text-xs"
                onClick={async () => {
                  await showJournal(cid, e);
                  setMsg("세션 화면에 띄웠어요.");
                }}
              >
                <span>📣 세션에 보여주기</span>
              </button>
            )}
          </div>
          {msg && <p className="text-xs text-accent">{msg}</p>}
        </div>
      </div>
    </Modal>
  );
}
