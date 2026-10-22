"use client";

import { stageImageOf } from "@/lib/characterArt";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  addCast,
  addToken,
  PHASES,
  removeCast,
  removeNpc,
  removeToken,
  saveNpc,
  setPhase,
  updateBattleMeta,
  updateScene,
  updateToken,
  type TokenSide,
} from "@/lib/scene";
import { derive } from "@/lib/ar/derive";
import { setTurn } from "@/lib/battle";
import { initiativeOrder } from "@/lib/battleRules";
import { addArCharacter } from "@/lib/campaigns";
import { addEntryToCampaign, blankEntry, subscribeLibrary, type LibraryEntry } from "@/lib/library";
import type { Character } from "@/lib/types";
import { splitTitle } from "@/lib/stage";
import { THEMES } from "@/lib/themes";
import { SheetImport } from "../SheetImport";
import { AnimationsSection } from "./AnimationsSection";
import { BattleMapsBlock } from "./BattleMapsBlock";
import { CutinsSection, ScenesSection } from "./FxSections";
import { ResizeHandle, useResizable } from "./Resizable";
import { useSession } from "./SessionContext";

const RECENT_KEY = "trpg-vtt:recent-urls";

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function pushRecent(url: string) {
  if (!url) return;
  try {
    const list = [url, ...readRecent().filter((u) => u !== url)].slice(0, 20);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {}
}

// GM 연출 패널 — 모드·페이즈·배경·출연진·NPC·전투 준비
export function DirectorPanel({ onClose }: { onClose: () => void }) {
  const { scene, cid } = useSession();
  const width = useResizable("director", 400, 320, 720);
  return (
    <aside
      className="absolute inset-y-0 left-0 z-40 flex max-w-full flex-col border-r border-line bg-panel shadow-2xl animate-rise-in"
      style={{ width: width.size }}
    >
      <ResizeHandle side="right" label="연출 패널" {...width} />
      <header className="flex items-center border-b border-line px-4 py-3">
        <h2 className="font-display text-lg font-bold">연출</h2>
        <span className="font-latin ml-2 text-[10px] text-muted">DIRECTOR</span>
        <button className="btn ml-auto px-2 py-0.5 text-xs" onClick={onClose}>
          <span>닫기 ✕</span>
        </button>
      </header>
      <datalist id="recent-urls">
        {readRecent().map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <Section title="진행" open>
          <div className="grid grid-cols-2 gap-1.5">
            {(["talk", "battle"] as const).map((m) => (
              <button
                key={m}
                className={scene.mode === m ? "btn-primary" : "btn"}
                onClick={() => updateScene(cid, { mode: m })}
              >
                <span>{m === "talk" ? "대화" : "전투"}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {PHASES.map((p) => (
              <button key={p.id} className={scene.phase === p.id ? "btn-primary text-xs" : "btn text-xs"} onClick={() => setPhase(cid, p.id)}>
                <span>{p.ko}</span>
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted">페이즈를 바꾸면 모두의 화면에 컷인이 떠요.</p>
          <TextField label="장소 이름" placeholder="그랑펠덴 · 왕녀의 집무실" value={scene.place} onSave={(v) => updateScene(cid, { place: v })} />
        </Section>

        <Section title="테마">
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => updateScene(cid, { theme: t.id })}
                className={`rounded-md border p-2 text-left transition ${scene.theme === t.id ? "border-accent bg-accent/10" : "border-line hover:border-accent/60"}`}
              >
                <div className="flex gap-1">
                  {t.swatch.map((c) => (
                    <span key={c} className="h-4 w-4 rounded-sm border border-white/10" style={{ background: c }} />
                  ))}
                </div>
                <div className="mt-1 text-xs font-bold">{t.name}</div>
                <div className="text-[10px] leading-snug text-muted">{t.tagline}</div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="배경 · CG" open>
          <TextField
            label="배경 그림"
            placeholder="/local/bg-town.jpg"
            value={scene.background ?? ""}
            list
            onSave={(v) => {
              pushRecent(v);
              updateScene(cid, { background: v || null });
            }}
          />
          <TextField
            label="CG (장면 위 컷신)"
            placeholder="/local/… 또는 로그의 이미지에서 '무대에 띄우기'"
            value={scene.cg ?? ""}
            list
            onSave={(v) => {
              pushRecent(v);
              updateScene(cid, { cg: v || null });
            }}
          />
          {scene.cg && (
            <button className="btn mt-1 w-full text-xs" onClick={() => updateScene(cid, { cg: null })}>
              <span>CG 내리기</span>
            </button>
          )}
        </Section>

        <ScenesSection Section={Section} />
        <CutinsSection Section={Section} />
        <AnimationsSection Section={Section} />
        <CastSection />
        <NpcSection />
        <BattleSection />
        <ImportSection />
      </div>
    </aside>
  );
}

function Section({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="panel group p-3">
      <summary className="font-display flex cursor-pointer list-none items-center text-sm font-bold">
        {title}
        <span className="ml-auto text-xs text-muted transition group-open:rotate-90">▶</span>
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function TextField({
  label,
  placeholder,
  value,
  onSave,
  list,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onSave: (v: string) => void;
  list?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [base, setBase] = useState(value);
  // 다른 곳에서 값이 바뀌면 따라간다 (편집 중이 아닐 때)
  if (value !== base) {
    setBase(value);
    setDraft(value);
  }
  return (
    <form
      className="mt-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft.trim());
      }}
    >
      <span className="text-xs text-muted">{label}</span>
      <div className="mt-0.5 flex gap-1">
        <input className="input" placeholder={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} list={list ? "recent-urls" : undefined} />
        <button className="btn shrink-0 text-xs" disabled={draft.trim() === value}>
          <span>적용</span>
        </button>
      </div>
    </form>
  );
}

function CastSection() {
  const { scene, cid, characters } = useSession();
  const [pick, setPick] = useState("");
  const entries = Object.entries(scene.cast).sort((a, b) => a[1].slot - b[1].slot);
  const nextSlot = entries.length ? Math.max(...entries.map(([, c]) => c.slot)) + 1 : 0;

  function add() {
    if (pick.startsWith("char:")) {
      const c = characters.find((x) => x.id === pick.slice(5));
      if (c) addCast(cid, { name: c.sheet.name, image: stageImageOf(c), charId: c.id, slot: nextSlot });
    } else if (pick.startsWith("npc:")) {
      const n = scene.npcs[pick.slice(4)];
      if (n) addCast(cid, { name: n.name, image: n.image, slot: nextSlot });
    }
    setPick("");
  }

  return (
    <Section title={`무대 출연진 (${entries.length})`}>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={scene.autoCast} onChange={(e) => updateScene(cid, { autoCast: e.target.checked })} />
        말한 사람이 자동으로 무대에 오르기 (그림이 있을 때, 최대 4명)
      </label>
      <p className="mt-1 text-[11px] text-muted">고정 출연진은 말하지 않아도 계속 서 있어요.</p>
      <ul className="mt-2 space-y-1">
        {entries.map(([k, c]) => (
          <li key={k} className="flex items-center gap-2 rounded border border-line px-2 py-1 text-xs">
            <span className="flex-1 truncate">{c.name}</span>
            {!c.image && <span className="text-muted">그림 없음</span>}
            <button className="text-muted hover:text-hp" onClick={() => removeCast(cid, k)} aria-label={`${c.name} 내리기`}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      {Object.keys(scene.offstage).length > 0 && (
        <div className="mt-2 rounded border border-dashed border-line p-1.5 text-xs">
          <div className="mb-1 text-[11px] text-muted">무대에서 내린 인물 (말해도 안 올라와요)</div>
          <div className="flex flex-wrap gap-1">
            {Object.keys(scene.offstage).map((k) => {
              const c = k.startsWith("char:") ? characters.find((x) => x.id === k.slice(5)) : undefined;
              const name = c?.sheet.name ?? k.replace(/^name:/, "");
              return (
                <button key={k} className="btn px-1.5 py-0 text-[11px]" title="다시 자동으로 오르게" onClick={() => updateScene(cid, { offstage: { ...scene.offstage, [k]: undefined } as Record<string, true> })}>
                  <span>↺ {splitTitle(name).name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-2 flex gap-1">
        <select className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">무대에 올릴 인물…</option>
          {characters.map((c) => (
            <option key={c.id} value={`char:${c.id}`}>
              {c.sheet.name}
              {stageImageOf(c) ? "" : " (그림 없음)"}
            </option>
          ))}
          {Object.entries(scene.npcs).map(([k, n]) => (
            <option key={k} value={`npc:${k}`}>
              {n.name}
            </option>
          ))}
        </select>
        <button className="btn shrink-0 text-xs" disabled={!pick} onClick={add}>
          <span>올리기</span>
        </button>
      </div>
    </Section>
  );
}

function NpcSection() {
  const { scene, cid } = useSession();
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [color, setColor] = useState("#c9a45c");
  const list = Object.entries(scene.npcs);
  return (
    <Section title={`NPC 화자 (${list.length})`}>
      <p className="text-[11px] text-muted">여기 등록한 NPC로 말할 수 있어요. 「[칭호] 이름」으로 쓰면 이름표에 칭호가 따로 붙어요.</p>
      <ul className="mt-2 space-y-1">
        {list.map(([k, n]) => (
          <li key={k} className="flex items-center gap-2 rounded border border-line px-2 py-1 text-xs">
            {n.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={n.image} alt="" className="h-6 w-6 rounded-full object-cover object-top" />
            ) : (
              <span className="h-6 w-6 rounded-full bg-panel-2" />
            )}
            <span className="flex-1 truncate" style={{ color: n.color }}>
              {n.name}
            </span>
            <button className="text-muted hover:text-hp" onClick={() => removeNpc(cid, k)} aria-label={`${n.name} 지우기`}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 space-y-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          pushRecent(image.trim());
          saveNpc(cid, { name: name.trim(), image: image.trim() || undefined, color });
          setName("");
          setImage("");
        }}
      >
        <input className="input" placeholder="[제 3왕녀] 앤드리아" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-1">
          <input className="input" placeholder="스탠딩 그림 (선택)" value={image} onChange={(e) => setImage(e.target.value)} list="recent-urls" />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-9 shrink-0 cursor-pointer bg-transparent" aria-label="이름 색" />
          <button className="btn shrink-0 text-xs" disabled={!name.trim()}>
            <span>추가</span>
          </button>
        </div>
      </form>
    </Section>
  );
}

function BattleSection() {
  const { battle, cid, characters, scene } = useSession();
  const { meta } = battle;
  const [pick, setPick] = useState("");
  const [enemy, setEnemy] = useState({ name: "", image: "", hp: "30", init: "8" });
  const tokens = initiativeOrder(Object.entries(battle.tokens).map(([id, t]) => ({ ...t, id }))).map((t) => [t.id, t] as const);
  const [busy, setBusy] = useState(false);

  // 비어 있는 칸 하나 (왼쪽 위부터)
  function freeCell(side: TokenSide) {
    const used = new Set(Object.values(battle.pos).map((p) => `${p.x},${p.y}`));
    const xs = side === "enemy" ? [...Array(meta.cols).keys()].reverse() : [...Array(meta.cols).keys()];
    for (const x of xs) for (let y = 0; y < meta.rows; y++) if (!used.has(`${x},${y}`)) return { x, y };
    return { x: 0, y: 0 };
  }

  return (
    <Section title={`전투 준비 (토큰 ${tokens.length})`} open={scene.mode === "battle"}>
      <div className="grid grid-cols-3 gap-1.5 text-xs">
        <NumField label="가로 칸" value={meta.cols} min={4} max={40} onSave={(v) => updateBattleMeta(cid, { cols: v })} />
        <NumField label="세로 칸" value={meta.rows} min={4} max={30} onSave={(v) => updateBattleMeta(cid, { rows: v })} />
        <NumField label="라운드" value={battle.turn.round} min={1} max={99} onSave={(v) => setTurn(cid, { ...battle.turn, round: v })} />
      </div>
      <TextField
        label="전장 그림 (한 칸 = 5m)"
        placeholder="/local/bg-cathedral.jpg"
        value={meta.background ?? ""}
        list
        onSave={(v) => {
          pushRecent(v);
          updateBattleMeta(cid, { background: v || null });
        }}
      />

      <ul className="mt-3 space-y-1">
        {tokens.map(([k, t]) => (
          <li key={k} className="flex items-center gap-2 rounded border border-line px-2 py-1 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: t.side === "enemy" ? "#d0463a" : t.side === "ally" ? "#4fae7c" : "var(--accent)" }}
            />
            <span className="flex-1 truncate">{splitTitle(t.name).name}</span>
            <label className="flex items-center gap-1 text-muted">
              행동치
              <input
                type="number"
                className="input w-14 py-0.5"
                defaultValue={t.init}
                onBlur={(e) => updateToken(cid, k, { init: parseInt(e.target.value, 10) || 0 })}
              />
            </label>
            <button className="text-muted hover:text-hp" onClick={() => removeToken(cid, k)} aria-label={`${t.name} 토큰 지우기`}>
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex gap-1">
        <select className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">캐릭터 토큰 올리기…</option>
          {characters
            .filter((c) => !Object.values(battle.tokens).some((t) => t.charId === c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.sheet.name}
              </option>
            ))}
        </select>
        <button
          className="btn shrink-0 text-xs"
          disabled={!pick}
          onClick={() => {
            const c = characters.find((x) => x.id === pick);
            if (!c) return;
            const side = sideOf(c);
            // 툴 안 시트가 있으면 계산된 행동치, 구글 시트면 【민첩】+【감지】
            const agi = c.sheet.stats.find((s) => s.key === "AGI")?.mod ?? 0;
            const per = c.sheet.stats.find((s) => s.key === "PER")?.mod ?? 0;
            const init = c.ar ? derive(c.ar).action : agi + per;
            addToken(
              cid,
              { name: c.sheet.name, charId: c.id, ownerUid: c.ownerUid ?? undefined, side, init, image: c.token ?? c.portrait },
              freeCell(side),
            );
            setPick("");
          }}
        >
          <span>올리기</span>
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted">행동치는 【민첩】+【감지】로 넣어요. 장비·스킬 보정은 위에서 고쳐 주세요.</p>
      <BattleMapsBlock />

      <form
        className="mt-3 space-y-1 rounded border border-dashed border-line p-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!enemy.name.trim() || busy) return;
          setBusy(true);
          // 간이 에너미도 GM 만 읽는 에너미 캐릭터로 만든다 (HP 가 플레이어에게 새지 않게). 나중에 시트를 채울 수 있다
          const name = enemy.name.trim();
          const hp = Math.max(1, parseInt(enemy.hp, 10) || 1);
          const init = parseInt(enemy.init, 10) || 0;
          const image = enemy.image.trim() || undefined;
          const base = blankEntry("enemy", name);
          try {
            const charId = await addArCharacter(cid, {
              ar: { ...base.ar, fixed: { ...base.ar.fixed, action: init } },
              hp: { cur: hp, max: hp },
              mp: { cur: 0, max: 0 },
              fate: { cur: 0, max: 0 },
              portrait: image,
              token: image,
              kind: "enemy",
              ownerUid: null,
              order: Date.now(),
            });
            await addToken(cid, { name, image, charId, side: "enemy", init }, freeCell("enemy"));
            setEnemy((s) => ({ ...s, name: "" }));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="text-xs font-bold">간이 에너미 (이름·HP·행동치만)</div>
        <input className="input" placeholder="고블린 A" value={enemy.name} onChange={(e) => setEnemy({ ...enemy, name: e.target.value })} />
        <input className="input" placeholder="토큰 그림 (선택)" value={enemy.image} onChange={(e) => setEnemy({ ...enemy, image: e.target.value })} list="recent-urls" />
        <div className="flex gap-1 text-xs">
          <label className="flex flex-1 items-center gap-1 text-muted">
            HP <input className="input py-0.5" value={enemy.hp} onChange={(e) => setEnemy({ ...enemy, hp: e.target.value })} />
          </label>
          <label className="flex flex-1 items-center gap-1 text-muted">
            행동치 <input className="input py-0.5" value={enemy.init} onChange={(e) => setEnemy({ ...enemy, init: e.target.value })} />
          </label>
          <button className="btn shrink-0" disabled={!enemy.name.trim()}>
            <span>추가</span>
          </button>
        </div>
      </form>
    </Section>
  );
}

// 토큰 편: PC → 아군 테두리, 에너미(또는 에너미 시트를 가진 옛 NPC) → 적
function sideOf(c: Character): TokenSide {
  if (c.kind === "pc") return "pc";
  if (c.kind === "enemy" || c.ar?.kind === "enemy") return "enemy";
  return "ally";
}

function NumField({ label, value, min, max, onSave }: { label: string; value: number; min: number; max: number; onSave: (v: number) => void }) {
  return (
    <label className="text-muted">
      {label}
      <input
        key={value}
        type="number"
        min={min}
        max={max}
        defaultValue={value}
        className="input mt-0.5 py-0.5"
        onBlur={(e) => {
          const v = Math.min(max, Math.max(min, parseInt(e.target.value, 10) || value));
          if (v !== value) onSave(v);
        }}
      />
    </label>
  );
}

function ImportSection() {
  const { cid, user, members, characters } = useSession();
  return (
    <>
      <LibrarySection />
      <Section title="캐릭터 추가 (시트 · Roll20 · 에너미)">
        <SheetImport cid={cid} user={user} members={members} nextOrder={characters.length} onDone={() => {}} />
      </Section>
    </>
  );
}

// 내 보관함에서 바로 꺼내 넣기
function LibrarySection() {
  const { cid, user } = useSession();
  const [list, setList] = useState<LibraryEntry[]>([]);
  const [q, setQ] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  useEffect(() => subscribeLibrary(user.uid, setList), [user.uid]);
  const t = q.trim().toLowerCase();
  const shown = list.filter((e) => !t || [e.name, ...e.tags, e.ar.profile.category ?? ""].join(" ").toLowerCase().includes(t)).slice(0, 30);
  return (
    <Section title={`보관함에서 넣기 (${list.length})`} open>
      <div className="flex gap-1">
        <input className="input py-1" placeholder="이름·태그 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
        <Link href="/library" target="_blank" className="btn shrink-0 py-1 text-xs">
          <span>보관함 열기</span>
        </Link>
      </div>
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        {shown.map((e) => (
          <li key={e.id} className="flex items-center gap-2 rounded border border-line px-2 py-1 text-xs">
            {e.portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.portrait} alt="" className="h-6 w-6 rounded-full object-cover object-top" />
            ) : (
              <span className="h-6 w-6 rounded-full bg-panel-2" />
            )}
            <span className="min-w-0 flex-1 truncate">{e.name}</span>
            <span className="shrink-0 whitespace-nowrap text-muted">{e.kind === "pc" ? "PC" : e.kind === "npc" ? "NPC" : "에너미"}</span>
            <button
              className="btn px-2 py-0 text-[11px]"
              onClick={async () => {
                await addEntryToCampaign(cid, e, { kind: e.kind, ownerUid: null, order: Date.now() });
                setAdded(e.name);
              }}
            >
              <span>넣기</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="text-[11px] text-muted">보관함이 비어 있어요.</li>}
      </ul>
      {added && <p className="mt-1 text-[11px] text-accent">{added} 넣었어요.</p>}
    </Section>
  );
}
