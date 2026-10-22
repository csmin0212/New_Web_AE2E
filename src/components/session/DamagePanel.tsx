"use client";

import { useMemo, useState } from "react";
import { applySkill, type ActCtx } from "@/lib/ar/actions";
import { DAMAGE_LABEL } from "@/lib/battleRules";
import { damageTotal, resolveDamage, type DamageWindow } from "@/lib/damageRules";
import { addCover, addMinus, addPlus, cancelDamage, finalizeDamage, removeDecl, rollDamage, rollExpr } from "@/lib/damageWindow";
import { splitTitle } from "@/lib/stage";
import { useSession } from "./SessionContext";

type Kind = "plus" | "minus" | "cover";

// 대미지 처리 창 — 전투 화면 위쪽에 모두에게 뜬다.
//   직전: 대미지 증가 선언 → 공격자(또는 GM)가 굴림
//   직후: 경감·커버링·추가 증가 선언 → 공격자(또는 GM)가 확정
export function DamagePanel({ w }: { w: DamageWindow }) {
  const { cid, user, isGM, campaign, characters } = useSession();
  const ctx: ActCtx = { cid, uid: user.uid, isGM, gmUid: campaign.gmUid };
  const isOwner = isGM || w.attacker.uid === user.uid;
  const before = w.phase === "before";

  // 내가 선언할 수 있는 캐릭터: GM 은 전부, 플레이어는 자기 캐릭터
  const mine = characters.filter((c) => isGM || c.ownerUid === user.uid);
  const [charId, setCharId] = useState(() => mine[0]?.id ?? "");
  const me = mine.find((c) => c.id === charId) ?? mine[0];
  // 고르기 전에는 단계에 맞는 기본값 (직전 = 증가, 직후 = 경감)
  const [kind, setKind] = useState<Kind | null>(null);
  const effKind: Kind = before ? "plus" : (kind ?? "minus");
  const [skillId, setSkillId] = useState("");
  const [target, setTarget] = useState("all");
  const [expr, setExpr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // 이 타이밍에 쓰는 스킬만 (타이밍 칸에 「직전」·「직후」가 든 것), 나머지는 아래에
  const word = before ? "직전" : "직후";
  const skills = useMemo(() => {
    const all = me?.ar?.skills ?? [];
    const fit = all.filter((s) => s.timing.includes(word));
    return { fit, rest: all.filter((s) => !s.timing.includes(word)) };
  }, [me, word]);
  const skill = me?.ar?.skills.find((s) => s.id === skillId);

  async function declare() {
    if (!me) return setErr("선언할 캐릭터가 없어요.");
    setErr(null);
    setBusy(true);
    try {
      if (skill) await applySkill(ctx, me, skill); // 스킬 카드 + MP 소모
      const by = { by: me.sheet.name, byCharId: me.id, skill: skill?.name, uid: user.uid, phase: w.phase };
      if (effKind === "cover") {
        const t = w.targets.find((x) => x.charId === target) ?? w.targets[0];
        await addCover(cid, { target: t.charId, by: { charId: me.id, name: me.sheet.name }, skill: skill?.name, uid: user.uid });
      } else {
        if (!expr.trim()) throw new Error("값을 적어 주세요. 예: 2D, 10, 1D+5");
        // 직전 증가는 대미지 굴림 때 같이 굴린다. 직후 선언은 지금 굴린다
        const total = before ? 0 : rollExpr(expr.trim()).total;
        if (effKind === "plus") await addPlus(cid, { ...by, expr: expr.trim(), total });
        else await addMinus(cid, { ...by, expr: expr.trim(), total, target });
      }
      setExpr("");
      setSkillId("");
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "선언하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  const total = damageTotal(w);
  const preview = before ? null : resolveDamage(w);
  const canRemove = (uid: string) => isGM || uid === user.uid;

  return (
    <div className="pointer-events-auto absolute top-2 left-1/2 z-30 w-[min(560px,calc(100%-24px))] -translate-x-1/2 animate-rise-in">
      <div className="panel space-y-2 p-2.5 text-xs shadow-[0_12px_40px_rgba(0,0,0,.6)]" style={{ background: "color-mix(in srgb, var(--panel) 95%, transparent)" }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 font-bold ${before ? "bg-accent text-accent-ink" : "bg-hp text-white"}`}>⏱ 대미지 굴림 {word}</span>
          <b className="truncate">{w.source}</b>
          <span className="text-muted">
            {splitTitle(w.attacker.name).name} → {w.targets.map((t) => splitTitle(t.name).name).join(", ")} · {DAMAGE_LABEL[w.dmgType]}
          </span>
          {!before && <b className="ml-auto text-base text-hp tabular-nums">합계 {total}</b>}
        </div>

        {/* 선언 목록 */}
        <ul className="space-y-0.5">
          {Object.entries(w.plus ?? {}).map(([k, m]) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="rounded bg-accent/20 px-1 text-[10px] text-accent">증가{m.phase === "after" ? "·직후" : ""}</span>
              <span>
                {m.by}
                {m.skill ? ` 《${m.skill}》` : ""} +{m.expr}
                {m.total ? ` = ${m.total}` : ""}
              </span>
              {canRemove(m.uid) && (
                <button className="ml-auto text-muted hover:text-hp" onClick={() => removeDecl(cid, "plus", k)} aria-label="선언 취소">
                  ×
                </button>
              )}
            </li>
          ))}
          {Object.entries(w.minus ?? {}).map(([k, m]) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="rounded bg-mp/25 px-1 text-[10px]">경감</span>
              <span>
                {m.by}
                {m.skill ? ` 《${m.skill}》` : ""} → {m.target === "all" ? "전원" : w.targets.find((t) => t.charId === m.target)?.name} −{m.total}
              </span>
              {canRemove(m.uid) && (
                <button className="ml-auto text-muted hover:text-hp" onClick={() => removeDecl(cid, "minus", k)} aria-label="선언 취소">
                  ×
                </button>
              )}
            </li>
          ))}
          {Object.entries(w.covers ?? {}).map(([k, c]) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="rounded bg-fate/25 px-1 text-[10px]">커버링</span>
              <span>
                {c.by.name}
                {c.skill ? ` 《${c.skill}》` : ""}이(가) {w.targets.find((t) => t.charId === c.target)?.name} 대신 받음
              </span>
              {canRemove(c.uid) && (
                <button className="ml-auto text-muted hover:text-hp" onClick={() => removeDecl(cid, "covers", k)} aria-label="선언 취소">
                  ×
                </button>
              )}
            </li>
          ))}
          {!w.plus && !w.minus && !w.covers && <li className="text-muted">{before ? "대미지를 늘리는 스킬이 있으면 선언하세요." : "경감·커버링할 스킬이 있으면 선언하세요."}</li>}
        </ul>

        {preview && (
          <div className="flex flex-wrap gap-1.5 border-t border-line pt-1.5">
            {preview.map((r) => (
              <span key={r.target.charId} className="rounded border border-line px-1.5 py-0.5">
                {r.covered ? `${r.recipient.name}(커버)` : r.target.name} <b className="text-hp">{r.amount}</b>
                <span className="text-muted"> − 방어</span>
              </span>
            ))}
          </div>
        )}

        {/* 선언하기 */}
        {mine.length > 0 && (
          <div className="border-t border-line pt-1.5">
            {!open ? (
              <button className="btn px-2 py-0.5 text-[11px]" onClick={() => setOpen(true)}>
                <span>✋ {before ? "대미지 증가 선언" : "경감·커버링 선언"}</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <select className="input w-auto py-0.5 text-[11px]" value={me?.id ?? ""} onChange={(e) => setCharId(e.target.value)}>
                  {mine.map((c) => (
                    <option key={c.id} value={c.id}>
                      {splitTitle(c.sheet.name).name}
                    </option>
                  ))}
                </select>
                {!before && (
                  <select className="input w-auto py-0.5 text-[11px]" value={effKind} onChange={(e) => setKind(e.target.value as Kind)}>
                    <option value="minus">대미지 경감</option>
                    <option value="cover">커버링 (대신 받기)</option>
                    <option value="plus">대미지 증가 (직후)</option>
                  </select>
                )}
                <select className="input w-auto max-w-44 py-0.5 text-[11px]" value={skillId} onChange={(e) => setSkillId(e.target.value)}>
                  <option value="">(스킬 없이)</option>
                  {skills.fit.length > 0 && (
                    <optgroup label={`타이밍: ${word}`}>
                      {skills.fit.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.cost && s.cost !== "-" ? ` · ${s.cost}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {skills.rest.length > 0 && (
                    <optgroup label="그 밖의 스킬">
                      {skills.rest.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {(effKind === "minus" || effKind === "cover") && (
                  <select className="input w-auto py-0.5 text-[11px]" value={effKind === "cover" && target === "all" ? (w.targets[0]?.charId ?? "") : target} onChange={(e) => setTarget(e.target.value)}>
                    {effKind === "minus" && <option value="all">대상 전원</option>}
                    {w.targets.map((t) => (
                      <option key={t.charId} value={t.charId}>
                        {splitTitle(t.name).name}
                      </option>
                    ))}
                  </select>
                )}
                {effKind !== "cover" && (
                  <input className="input w-20 py-0.5 text-center text-[11px]" placeholder={before ? "2D" : "10"} value={expr} onChange={(e) => setExpr(e.target.value)} title="숫자 또는 주사위 식 (2D, 1D+5)" />
                )}
                <button className="btn-primary px-2 py-0.5 text-[11px]" disabled={busy} onClick={declare}>
                  <span>선언</span>
                </button>
                <button className="text-muted hover:text-text" onClick={() => setOpen(false)} aria-label="닫기">
                  ✕
                </button>
                {skill && <p className="w-full text-[10px] text-muted">선언하면 《{skill.name}》 카드가 채팅에 올라가고 코스트가 빠져요.</p>}
              </div>
            )}
          </div>
        )}
        {err && <p className="text-hp">{err}</p>}

        {/* 진행 */}
        {isOwner ? (
          <div className="flex justify-end gap-1.5 border-t border-line pt-1.5">
            <button className="btn px-2 py-0.5 text-[11px]" onClick={() => cancelDamage(cid)}>
              <span>취소</span>
            </button>
            {before ? (
              <button className="btn-primary px-3 py-1 text-xs" disabled={busy} onClick={() => run(() => rollDamage({ cid, uid: user.uid }, w))}>
                <span>🎲 대미지 굴림</span>
              </button>
            ) : (
              <button
                className="btn-primary px-3 py-1 text-xs"
                disabled={busy}
                onClick={() => run(() => finalizeDamage({ cid, uid: user.uid, gmUid: campaign.gmUid, isGM, characters }, w))}
              >
                <span>✔ 확정 · 적용</span>
              </button>
            )}
          </div>
        ) : (
          <p className="border-t border-line pt-1.5 text-muted">{before ? "공격하는 쪽이 대미지를 굴릴 때까지 선언할 수 있어요." : "공격하는 쪽이 확정할 때까지 선언할 수 있어요."}</p>
        )}
      </div>
    </div>
  );

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "실패했어요.");
    } finally {
      setBusy(false);
    }
  }
}
