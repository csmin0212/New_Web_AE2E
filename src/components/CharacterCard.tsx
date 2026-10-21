"use client";

import type { User } from "firebase/auth";
import { useState } from "react";
import { fetchSheet, removeCharacter, resyncCharacter, setGauge, updateCharacter } from "@/lib/campaigns";
import { sendMessage } from "@/lib/chat";
import { roll } from "@/lib/dice";
import type { Character, Gauge, Member } from "@/lib/types";

type GaugeKey = "hp" | "mp" | "fate";
const GAUGES: { key: GaugeKey; label: string; color: string }[] = [
  { key: "hp", label: "HP", color: "bg-hp" },
  { key: "mp", label: "MP", color: "bg-mp" },
  { key: "fate", label: "페이트", color: "bg-fate" },
];

export function CharacterCard({
  cid,
  user,
  character: c,
  isGM,
  members,
}: {
  cid: string;
  user: User;
  character: Character;
  isGM: boolean;
  members: Member[];
}) {
  const canEdit = isGM || c.ownerUid === user.uid;
  const owner = members.find((m) => m.uid === c.ownerUid);
  const [statIdx, setStatIdx] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = c.sheet;

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "문제가 생겼어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel p-3">
      <header className="flex items-start gap-2">
        {(c.portrait ?? c.standing) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.portrait ?? c.standing} alt="" className="h-11 w-11 shrink-0 rounded-full border border-line object-cover object-top" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-display truncate text-lg font-bold" style={{ color: c.color }}>
            {s.name}
          </h3>
          <p className="truncate text-xs text-muted">
            {[s.level != null && `Lv.${s.level}`, s.race, s.charClass, s.attribute].filter(Boolean).join(" · ")}
            {c.kind === "pc" && <> · {owner ? owner.name : "담당 없음"}</>}
          </p>
        </div>
        {canEdit && (
          <button className="btn px-2 py-0.5 text-xs" onClick={() => setMenu((v) => !v)} aria-label="캐릭터 메뉴">
            <span>⋯</span>
          </button>
        )}
      </header>

      {canEdit && menu && (
        <div className="mt-2 space-y-2 rounded-md border border-line bg-panel-2 p-2 text-xs">
          <ArtFields c={c} onSave={(patch) => act(() => updateCharacter(cid, c.id, patch))} busy={busy} />
          {isGM && (
            <>
              {s.sheetId && (
                <button
                  className="btn w-full"
                  disabled={busy}
                  onClick={() => act(async () => resyncCharacter(cid, c, await fetchSheet(user, s.sheetId, s.tab)))}
                >
                  <span>시트 다시 불러오기</span>
                </button>
              )}
              {c.kind === "pc" && (
                <select
                  className="input"
                  value={c.ownerUid ?? ""}
                  onChange={(e) => act(() => updateCharacter(cid, c.id, { ownerUid: e.target.value || null }))}
                >
                  <option value="">담당 플레이어 없음</option>
                  {members
                    .filter((m) => m.role === "player")
                    .map((m) => (
                      <option key={m.uid} value={m.uid}>
                        {m.name}
                      </option>
                    ))}
                </select>
              )}
              <button
                className="btn w-full text-hp"
                disabled={busy}
                onClick={() => confirm(`${s.name}을(를) 목록에서 지울까요? (구글 시트는 그대로예요)`) && act(() => removeCharacter(cid, c.id))}
              >
                <span>목록에서 지우기</span>
              </button>
              <p className="text-muted">마지막 동기화: {new Date(c.syncedAt).toLocaleString("ko-KR")}</p>
            </>
          )}
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        {GAUGES.map((g) => (
          <GaugeRow
            key={g.key}
            label={g.label}
            color={g.color}
            value={c[g.key]}
            editable={canEdit}
            onChange={(v) => act(() => setGauge(cid, c.id, g.key, v))}
          />
        ))}
      </div>

      {s.stats.length > 0 && (
        <div className="mt-3 grid grid-cols-7 gap-1">
          {s.stats.map((st, i) => (
            <button
              key={st.key}
              disabled={!canEdit || st.mod == null}
              onClick={() => setStatIdx(statIdx === i ? null : i)}
              className={`rounded border px-0.5 py-1 text-center transition ${
                statIdx === i ? "border-accent bg-accent/15" : "border-line bg-panel-2 hover:border-accent/60"
              } disabled:hover:border-line`}
              title={canEdit ? `${st.label} 판정 (2D+${st.mod ?? "?"})` : `${st.label} 기본치 ${st.value ?? "-"}`}
            >
              <div className="text-[10px] text-muted">{st.label}</div>
              <div className="text-sm font-bold">{st.mod ?? "-"}</div>
            </button>
          ))}
        </div>
      )}

      {statIdx != null && s.stats[statIdx]?.mod != null && (
        <CheckPanel
          label={`${s.stats[statIdx].label} 판정`}
          mod={s.stats[statIdx].mod!}
          fate={c.fate}
          isGM={isGM}
          onRoll={(bonus, fate, secret) =>
            act(async () => {
              if (fate > c.fate.cur) throw new Error("페이트가 모자라요.");
              const total = s.stats[statIdx].mod! + bonus;
              const result = roll(`2D${total >= 0 ? "+" : ""}${total}`, {
                check: true,
                fate,
                label: `${s.stats[statIdx].label} 판정`,
              });
              if (fate > 0) await setGauge(cid, c.id, "fate", { ...c.fate, cur: c.fate.cur - fate });
              await sendMessage(
                cid,
                {
                  uid: user.uid,
                  speaker: { name: s.name, uid: user.uid, charId: c.id, image: c.standing, avatar: c.portrait, color: c.color },
                  kind: "roll",
                  text: "",
                  roll: result,
                  secret: secret || undefined,
                },
                secret ? [user.uid] : undefined,
              );
              setStatIdx(null);
            })
          }
          busy={busy}
        />
      )}

      {s.skills.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted">스킬 {s.skills.length}개</summary>
          <ul className="mt-1 flex flex-wrap gap-1">
            {s.skills.map((sk) => (
              <li key={sk.name} className="rounded border border-line bg-panel-2 px-1.5 py-0.5">
                {sk.name} <span className="text-muted">SL{sk.sl}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {error && <p className="mt-2 text-xs text-hp">{error}</p>}
    </article>
  );
}

export function GaugeRow({
  label,
  color,
  value,
  editable,
  onChange,
}: {
  label: string;
  color: string;
  value: Gauge;
  editable: boolean;
  onChange: (v: Gauge) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const pct = value.max > 0 ? Math.max(0, Math.min(100, (value.cur / value.max) * 100)) : 0;

  // "-12", "+5" 는 증감, 그냥 숫자는 그 값으로 설정
  function commit() {
    setEditing(false);
    const t = draft.trim();
    if (!t) return;
    const n = parseInt(t, 10);
    if (Number.isNaN(n)) return;
    const next = /^[+-]/.test(t) ? value.cur + n : n;
    onChange({ ...value, cur: Math.max(0, Math.min(value.max, next)) });
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 shrink-0 text-muted">{label}</span>
      <div className="relative h-5 flex-1 overflow-hidden rounded bg-bg">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        {editing ? (
          <input
            autoFocus
            className="absolute inset-0 bg-transparent text-center font-semibold outline-none"
            value={draft}
            placeholder="-12 / +5 / 30"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <button
            disabled={!editable}
            onClick={() => {
              setDraft("");
              setEditing(true);
            }}
            className="absolute inset-0 font-semibold"
            title={editable ? "클릭해서 수정 (-12, +5, 30)" : undefined}
          >
            {value.cur} / {value.max}
          </button>
        )}
      </div>
      {editable && (
        <>
          <button className="btn px-1.5 py-0" onClick={() => onChange({ ...value, cur: Math.max(0, value.cur - 1) })} aria-label={`${label} 1 감소`}>
            −
          </button>
          <button className="btn px-1.5 py-0" onClick={() => onChange({ ...value, cur: Math.min(value.max, value.cur + 1) })} aria-label={`${label} 1 증가`}>
            +
          </button>
        </>
      )}
    </div>
  );
}

function CheckPanel({
  label,
  mod,
  fate,
  isGM,
  busy,
  onRoll,
}: {
  label: string;
  mod: number;
  fate: Gauge;
  isGM: boolean;
  busy: boolean;
  onRoll: (bonus: number, fate: number, secret: boolean) => void;
}) {
  const [bonus, setBonus] = useState(0);
  const [useFate, setUseFate] = useState(0);
  const [secret, setSecret] = useState(false);
  const total = mod + bonus;
  return (
    <div className="mt-2 space-y-2 rounded-md border border-accent/40 bg-panel-2 p-2 text-xs">
      <div className="font-semibold">
        {label}: {2 + useFate}D{total >= 0 ? "+" : ""}
        {total}
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          보정
          <input type="number" className="input w-16 py-0.5" value={bonus} onChange={(e) => setBonus(parseInt(e.target.value, 10) || 0)} />
        </label>
        <label className="flex items-center gap-1">
          페이트
          <input
            type="number"
            min={0}
            max={fate.cur}
            className="input w-14 py-0.5"
            value={useFate}
            onChange={(e) => setUseFate(Math.max(0, Math.min(fate.cur, parseInt(e.target.value, 10) || 0)))}
          />
          <span className="text-muted">/ {fate.cur}</span>
        </label>
        {isGM && (
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} />
            비밀
          </label>
        )}
      </div>
      <button className="btn-primary w-full" disabled={busy} onClick={() => onRoll(bonus, useFate, secret)}>
        굴리기
      </button>
    </div>
  );
}

// 얼굴·스탠딩·이름 색 — 이미지 주소를 넣는다 (public/ 아래 경로나 https 주소)
function ArtFields({
  c,
  onSave,
  busy,
}: {
  c: Character;
  onSave: (patch: Partial<Pick<Character, "portrait" | "standing" | "color">>) => void;
  busy: boolean;
}) {
  const [portrait, setPortrait] = useState(c.portrait ?? "");
  const [standing, setStanding] = useState(c.standing ?? "");
  const [color, setColor] = useState(c.color ?? "#c9a45c");
  return (
    <form
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ portrait: portrait.trim() || undefined, standing: standing.trim() || undefined, color });
      }}
    >
      <label className="block">
        <span className="text-muted">얼굴 아이콘</span>
        <input className="input mt-0.5" placeholder="/local/teresa.jpg 또는 https://…" value={portrait} onChange={(e) => setPortrait(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-muted">스탠딩 (배경 투명 PNG)</span>
        <input className="input mt-0.5" placeholder="/local/elin-standing.png" value={standing} onChange={(e) => setStanding(e.target.value)} />
      </label>
      <label className="flex items-center gap-2">
        <span className="text-muted">이름 색</span>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-6 w-10 cursor-pointer bg-transparent" />
        <button className="btn-primary ml-auto py-1" disabled={busy}>
          <span>그림 저장</span>
        </button>
      </label>
    </form>
  );
}
