"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  applyPreset,
  CUTIN_STYLES,
  deleteCutin,
  deletePreset,
  playTransition,
  saveCutin,
  savePreset,
  TRANSITIONS,
  triggerCutin,
  type CutinPreset,
  type ScenePreset,
  type TransitionType,
} from "@/lib/fx";
import { PHASES, type Phase } from "@/lib/scene";
import { ImageDrop } from "../ImageDrop";
import { CutinView } from "./FxOverlays";
import { useSession } from "./SessionContext";

// 연출 패널 안의 「장면」·「컷인」 구역

export function ScenesSection({ Section }: { Section: (p: { title: string; open?: boolean; children: ReactNode }) => ReactNode }) {
  const { cid, scene, battle } = useSession();
  const [name, setName] = useState("");
  const [tr, setTr] = useState<TransitionType>("fade");
  const [ms, setMs] = useState(1200);
  const [withPhase, setWithPhase] = useState<Phase | "">("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = Object.entries(scene.presets).sort((a, b) => a[1].createdAt - b[1].createdAt);

  const snapshot = (n: string, createdAt: number): ScenePreset => ({
    name: n,
    mode: scene.mode,
    background: scene.background,
    cg: scene.cg,
    place: scene.place,
    phase: withPhase || undefined,
    autoCast: scene.autoCast,
    cast: scene.cast,
    battleBackground: battle.meta.background,
    transition: tr,
    ms,
    createdAt,
  });

  async function go(key: string, p: ScenePreset) {
    setBusy(key);
    setError(null);
    try {
      await applyPreset(cid, p);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title={`장면 (${list.length})`} open>
      <p className="text-[11px] text-muted">지금 무대(모드·배경·CG·장소·출연진·전장 그림)를 장면으로 저장해 두고, 누르면 전환 효과와 함께 모두의 화면이 바뀌어요.</p>
      <ul className="mt-2 space-y-1">
        {list.map(([key, p]) => (
          <li key={key} className="flex items-center gap-2 rounded border border-line p-1 text-xs">
            <div
              className="h-9 w-14 shrink-0 rounded bg-panel-2 bg-cover bg-center"
              style={{ backgroundImage: p.background || p.cg ? `url("${p.cg ?? p.background}")` : undefined }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{p.name}</div>
              <div className="truncate text-[10px] text-muted">
                {p.mode === "battle" ? "전투" : "대화"} · {TRANSITIONS.find((t) => t.id === p.transition)?.label} {p.ms}ms
                {p.phase && ` · ${PHASES.find((x) => x.id === p.phase)?.ko}`}
              </div>
            </div>
            <button className="btn-primary px-2 py-0.5 text-[11px]" disabled={!!busy} onClick={() => go(key, p)}>
              <span>{busy === key ? "전환 중" : "전환"}</span>
            </button>
            <button
              className="btn px-1.5 py-0.5 text-[11px]"
              title="지금 무대로 덮어쓰기"
              onClick={() => confirm(`「${p.name}」을(를) 지금 무대로 덮어쓸까요?`) && savePreset(cid, { ...snapshot(p.name, p.createdAt), transition: p.transition, ms: p.ms, phase: p.phase }, key)}
            >
              <span>덮어쓰기</span>
            </button>
            <button className="px-1 text-muted hover:text-hp" onClick={() => confirm(`「${p.name}」 장면을 지울까요?`) && deletePreset(cid, key)} aria-label={`${p.name} 지우기`}>
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form
        className="mt-3 space-y-2 rounded border border-dashed border-line p-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setError(null);
          try {
            await savePreset(cid, snapshot(name.trim(), Date.now()));
            setName("");
          } catch (err) {
            setError(errText(err));
          }
        }}
      >
        <div className="text-xs font-bold">지금 무대를 장면으로 저장</div>
        <input className="input py-1" placeholder="왕녀의 집무실 · 낮" value={name} onChange={(e) => setName(e.target.value)} />
        <TransitionPicker type={tr} ms={ms} onType={setTr} onMs={setMs} />
        <label className="flex items-center gap-2 text-[11px] text-muted">
          전환할 때 페이즈도
          <select className="input w-auto py-0.5 text-[11px]" value={withPhase} onChange={(e) => setWithPhase(e.target.value as Phase | "")}>
            <option value="">그대로</option>
            {PHASES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.ko}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1">
          <button className="btn-primary flex-1 text-xs" disabled={!name.trim()}>
            <span>장면 저장</span>
          </button>
          <button
            type="button"
            className="btn text-xs"
            onClick={() => playTransition(cid, tr, ms).catch((err) => setError(errText(err)))}
            title="장면은 그대로, 효과만 (시간 경과·분위기 전환)"
          >
            <span>효과만 재생</span>
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-[11px] text-hp">{error}</p>}
    </Section>
  );
}

function TransitionPicker({ type, ms, onType, onMs }: { type: TransitionType; ms: number; onType: (t: TransitionType) => void; onMs: (n: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {TRANSITIONS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.hint}
            onClick={() => onType(t.id)}
            className={`rounded border px-2 py-0.5 text-[11px] ${type === t.id ? "border-accent bg-accent/20 text-text" : "border-line text-muted hover:text-text"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {type !== "cut" && (
        <label className="flex items-center gap-2 text-[11px] text-muted">
          길이
          <input type="range" min={400} max={3000} step={100} value={ms} onChange={(e) => onMs(+e.target.value)} className="flex-1" />
          <span className="w-12 text-right tabular-nums">{(ms / 1000).toFixed(1)}초</span>
        </label>
      )}
    </div>
  );
}

const EMPTY_CUTIN: CutinPreset = { name: "", style: "band", text: "", sub: "", ms: 2600 };

export function CutinsSection({ Section }: { Section: (p: { title: string; open?: boolean; children: ReactNode }) => ReactNode }) {
  const { cid, scene, user } = useSession();
  const [editing, setEditing] = useState<{ key?: string; c: CutinPreset } | null>(null);
  const [preview, setPreview] = useState<{ c: CutinPreset; n: number } | null>(null);
  const closePreview = useCallback(() => setPreview(null), []);
  const [error, setError] = useState<string | null>(null);
  const list = Object.entries(scene.cutins);

  return (
    <Section title={`컷인 (${list.length})`}>
      <p className="text-[11px] text-muted">
        「재생」하면 모두의 화면에 떠요. 채팅에 <code className="text-text">/cutin 이름</code>을 치거나, 정해 둔 키워드가 대사에 들어가도 재생돼요 (플레이어도 가능).
      </p>
      <ul className="mt-2 space-y-1">
        {list.map(([key, c]) => (
          <li key={key} className="flex items-center gap-2 rounded border border-line p-1 text-xs">
            {c.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.image} alt="" className="h-9 w-9 shrink-0 rounded object-cover object-top" />
            ) : (
              <span className="h-9 w-9 shrink-0 rounded" style={{ background: c.color ?? "var(--accent)" }} />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{c.name}</div>
              <div className="truncate text-[10px] text-muted">
                {CUTIN_STYLES.find((s) => s.id === c.style)?.label}
                {c.keyword && ` · 키워드 「${c.keyword}」`}
              </div>
            </div>
            <button className="btn-primary px-2 py-0.5 text-[11px]" onClick={() => triggerCutin(cid, user.uid, key).catch((e) => setError(errText(e)))}>
              <span>재생</span>
            </button>
            <button className="btn px-1.5 py-0.5 text-[11px]" onClick={() => setEditing({ key, c })}>
              <span>편집</span>
            </button>
            <button className="px-1 text-muted hover:text-hp" onClick={() => confirm(`「${c.name}」 컷인을 지울까요?`) && deleteCutin(cid, key)} aria-label={`${c.name} 지우기`}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      {!editing && (
        <button className="btn mt-2 w-full text-xs" onClick={() => setEditing({ c: { ...EMPTY_CUTIN } })}>
          <span>+ 새 컷인</span>
        </button>
      )}

      {editing && (
        <form
          className="mt-3 space-y-2 rounded border border-dashed border-line p-2 text-xs"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editing.c.name.trim()) return;
            setError(null);
            try {
              await saveCutin(cid, { ...editing.c, name: editing.c.name.trim(), keyword: editing.c.keyword?.trim() || undefined }, editing.key);
              setEditing(null);
            } catch (err) {
              setError(errText(err));
            }
          }}
        >
          <input className="input py-1" placeholder="컷인 이름 (예: 총공격)" value={editing.c.name} onChange={(e) => setEditing({ ...editing, c: { ...editing.c, name: e.target.value } })} />
          <div className="grid grid-cols-2 gap-1">
            {CUTIN_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setEditing({ ...editing, c: { ...editing.c, style: s.id } })}
                className={`rounded border p-1.5 text-left ${editing.c.style === s.id ? "border-accent bg-accent/15" : "border-line hover:border-accent/60"}`}
              >
                <div className="font-bold">{s.label}</div>
                <div className="text-[10px] leading-snug text-muted">{s.hint}</div>
              </button>
            ))}
          </div>
          <ImageDrop
            user={user}
            kind={editing.c.style === "full" ? "background" : "standing"}
            label={editing.c.style === "full" ? "그림 (가로로 긴 CG)" : "그림 (배경 투명 스탠딩 권장)"}
            value={editing.c.image}
            onChange={(v) => setEditing({ ...editing, c: { ...editing.c, image: v } })}
            aspect={editing.c.style === "full" ? "aspect-video" : "aspect-[4/3]"}
          />
          <input
            className="input py-1"
            placeholder={editing.c.style === "side" ? "[칭호] 이름 (예: [호수의 성녀] 유즈)" : "큰 글씨 (예: HOLD UP!)"}
            value={editing.c.text ?? ""}
            onChange={(e) => setEditing({ ...editing, c: { ...editing.c, text: e.target.value } })}
          />
          <input
            className="input py-1"
            placeholder={editing.c.style === "side" ? "스킬 이름이나 대사" : "작은 글씨 (예: ALL-OUT ATTACK)"}
            value={editing.c.sub ?? ""}
            onChange={(e) => setEditing({ ...editing, c: { ...editing.c, sub: e.target.value } })}
          />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-muted">
              강조색
              <input type="color" value={editing.c.color ?? "#e3192b"} onChange={(e) => setEditing({ ...editing, c: { ...editing.c, color: e.target.value } })} />
            </label>
            {editing.c.color && (
              <button type="button" className="text-[11px] text-muted underline" onClick={() => setEditing({ ...editing, c: { ...editing.c, color: undefined } })}>
                테마색
              </button>
            )}
            <label className="ml-auto flex items-center gap-1 text-muted">
              길이
              <input
                type="range"
                min={1200}
                max={6000}
                step={200}
                value={editing.c.ms}
                onChange={(e) => setEditing({ ...editing, c: { ...editing.c, ms: +e.target.value } })}
              />
              <span className="w-9 tabular-nums">{(editing.c.ms / 1000).toFixed(1)}초</span>
            </label>
          </div>
          <input
            className="input py-1"
            placeholder="키워드 (선택) — 채팅에 이 말이 들어가면 자동 재생"
            value={editing.c.keyword ?? ""}
            onChange={(e) => setEditing({ ...editing, c: { ...editing.c, keyword: e.target.value } })}
          />
          <div className="flex gap-1">
            <button type="button" className="btn flex-1" onClick={() => setPreview({ c: editing.c, n: Date.now() })}>
              <span>나만 미리보기</span>
            </button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              <span>취소</span>
            </button>
            <button className="btn-primary flex-1" disabled={!editing.c.name.trim()}>
              <span>저장</span>
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-[11px] text-hp">{error}</p>}
      {preview && <PreviewOnce key={preview.n} c={preview.c} onDone={closePreview} />}
    </Section>
  );
}

function PreviewOnce({ c, onDone }: { c: CutinPreset; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, c.ms + 50);
    return () => clearTimeout(t);
  }, [c.ms, onDone]);
  return <CutinView preset={c} />;
}

function errText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return /PERMISSION_DENIED/i.test(m) ? "저장 권한이 없어요 (GM 만 바꿀 수 있어요)." : m;
}
