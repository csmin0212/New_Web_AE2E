"use client";

import { useMemo, useState } from "react";
import { applyItem, applySkill, rollArCheck, rolledTotals, type ActCtx } from "@/lib/ar/actions";
import { derive, formatDiceMod } from "@/lib/ar/derive";
import type { DiceMod } from "@/lib/ar/types";
import { sendEffect, sendStatus } from "@/lib/battle";
import { openDamage } from "@/lib/damageWindow";
import { DAMAGE_LABEL, EFFECT_LABEL, statusDefs, type DamageType, type EffectKind } from "@/lib/battleRules";
import { splitTitle } from "@/lib/stage";
import type { Character, Gauge } from "@/lib/types";
import { useContextMenu, type MenuItem } from "../ContextMenu";
import { useSession } from "./SessionContext";

// 내 차례 행동 바 — 전투 그리드 아래쪽에 떠 있다.
//   ① 공격·스킬·아이템 중 하나를 고르고  ② 그리드에서 토큰을 눌러 대상을 정하고
//   ③ 굴린 뒤 나온 값을 대상에게 적용 (방어 경감·HP 차감은 자동, 에너미는 GM 화면이 처리)

export type DockUnit = { id: string; name: string; character?: Character };
export type DockTarget = { id: string; name: string; charId?: string };

type Mode = "attack" | "skill" | "item";
type AttackOpt = { id: string; name: string; hit: DiceMod; damage: DiceMod; dmgType: DamageType };

function dmgTypeOf(s: string): DamageType {
  if (/관통|pierce/i.test(s)) return "pierce";
  if (/마법|magic/i.test(s)) return "magic";
  return "physical";
}

export function ActionDock({
  unit,
  targets,
  onRemoveTarget,
  onClose,
}: {
  unit: DockUnit;
  targets: DockTarget[];
  onRemoveTarget: (id: string) => void;
  onClose: () => void;
}) {
  const { cid, user, isGM, campaign, characters, battle } = useSession();
  const c = unit.character;
  const ar = c?.ar;
  const ctx: ActCtx = { cid, uid: user.uid, isGM, gmUid: campaign.gmUid };

  const attacks: AttackOpt[] = useMemo(() => {
    if (!ar) return [];
    const list: AttackOpt[] = ar.attacks.map((a) => ({ id: a.id, name: a.name || "공격", hit: a.hit, damage: a.damage, dmgType: dmgTypeOf(a.damageType) }));
    if (ar.kind === "pc" || list.length === 0) {
      const d = derive(ar);
      const weapon = ar.equipment.find((e) => e.atk !== 0 || /무기|오른손|왼손|weapon/i.test(e.slot))?.name;
      list.unshift({ id: "weapon", name: weapon ? `무기 공격 (${weapon})` : "무기 공격", hit: d.hit, damage: d.damage, dmgType: "physical" });
    }
    return list;
  }, [ar]);
  const skills = ar?.skills ?? [];
  const items = (ar?.items ?? []).filter((i) => i.qty > 0);

  const [mode, setMode] = useState<Mode>("attack");
  const [pick, setPick] = useState<Record<Mode, string>>({ attack: "", skill: "", item: "" });
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<EffectKind>("damage");
  const [dmgType, setDmgType] = useState<DamageType>("physical");
  const [quick, setQuick] = useState<{ label: string; total: number }[]>([]);
  const [source, setSource] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [folded, setFolded] = useState(false);
  const bsMenu = useContextMenu();

  const attack = attacks.find((a) => a.id === pick.attack) ?? attacks[0];
  const skill = skills.find((s) => s.id === pick.skill) ?? skills[0];
  const item = items.find((i) => i.id === pick.item) ?? items[0];

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "실패했어요.", bad: true });
    } finally {
      setBusy(false);
    }
  }

  function offer(values: { label: string; total: number }[], src: string, k: EffectKind, type?: DamageType) {
    setQuick(values);
    setSource(src);
    setKind(k);
    if (type) setDmgType(type);
    if (values.length) setAmount(String(values[values.length - 1].total));
  }

  // 대상에게 BS 걸기 (강도가 있는 것은 묻는다)
  async function giveBs(id: string, label: string, strength: boolean) {
    const n = strength ? parseInt(prompt(`${label} 강도`, "1") ?? "", 10) : 1;
    if (!Number.isFinite(n) || n < 1) return;
    await run(async () => {
      const list = targets.map((t) => ({ tid: t.id, charId: t.charId ?? "", name: t.name }));
      const r = await sendStatus({ cid, uid: user.uid, isGM, tokens: battle.tokens }, list, { id, label, strength: n }, c?.sheet.name ?? unit.name, source);
      setMsg({ text: r.queued ? `${label}을(를) 걸었어요. (${r.queued}명은 GM 화면에서 처리)` : `${label}을(를) 걸었어요.` });
    });
  }

  // 대미지 처리 창 열기 (직전 → 굴림 → 직후 → 확정)
  async function startTiming(base: { expr?: string; fixed?: number }, src: string, type: DamageType) {
    const list = targets.filter((t) => t.charId).map((t) => ({ tid: t.id, charId: t.charId!, name: t.name }));
    if (!list.length) throw new Error("먼저 그리드에서 대상을 골라 주세요.");
    await openDamage(cid, { attacker: { name: c?.sheet.name ?? unit.name, charId: c?.id, uid: user.uid }, source: src, dmgType: type, base, targets: list });
  }

  async function apply() {
    const n = parseInt(amount, 10);
    if (!Number.isFinite(n) || n < 0) return setMsg({ text: "적용할 값을 적어 주세요.", bad: true });
    const list = targets.filter((t) => t.charId).map((t) => ({ tid: t.id, charId: t.charId!, name: t.name }));
    if (!list.length) return setMsg({ text: "시트와 연결된 대상을 골라 주세요.", bad: true });
    await run(async () => {
      const r = await sendEffect(
        { cid, uid: user.uid, gmUid: campaign.gmUid, isGM, characters },
        list,
        { kind, amount: n, dmgType: kind === "damage" ? dmgType : undefined, from: c?.sheet.name ?? unit.name, source },
      );
      setMsg({ text: r.queued ? `적용했어요. (${r.queued}명은 GM 화면에서 처리)` : "적용했어요." });
    });
  }

  const name = splitTitle(unit.name).name;

  if (folded)
    return (
      <div className="pointer-events-auto absolute bottom-3 left-1/2 z-30 -translate-x-1/2">
        <button className="btn-primary pop rounded-full px-4 shadow-xl" onClick={() => setFolded(false)}>
          <span>⚔ {name} 행동 열기</span>
        </button>
      </div>
    );

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-30 w-[min(600px,calc(100%-24px))] -translate-x-1/2 animate-rise-in">
      {bsMenu.node}
      <div className="panel space-y-2 p-2.5 text-xs shadow-[0_12px_40px_rgba(0,0,0,.6)]" style={{ background: "color-mix(in srgb, var(--panel) 94%, transparent)" }}>
        {/* 머리: 누가 · 자원 · 접기 · 턴 종료 */}
        <div className="flex items-center gap-2">
          <span className="font-latin text-[10px] text-accent">ACTION</span>
          <span className="font-display min-w-0 truncate text-sm font-bold">{name}</span>
          {c && <Res g={c.hp} label="HP" color="bg-hp" />}
          {c && c.mp.max > 0 && <Res g={c.mp} label="MP" color="bg-mp" />}
          {/* 턴 종료는 위 행동 순서 띠에 늘 있다 — 여기서 겹쳐 두지 않는다 */}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button className="btn px-2 py-0.5 text-[11px]" onClick={() => setFolded(true)} title="접기">
              <span>▾</span>
            </button>
            <button className="btn px-2 py-0.5 text-[11px]" onClick={onClose} title="닫기">
              <span>✕</span>
            </button>
          </div>
        </div>

        {/* ① 무엇을 */}
        {ar ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex overflow-hidden rounded-md border border-line">
              {(
                [
                  ["attack", `공격 ${attacks.length}`],
                  ["skill", `스킬 ${skills.length}`],
                  ["item", `아이템 ${items.length}`],
                ] as const
              ).map(([m, label]) => (
                <button key={m} className={`px-2.5 py-1 ${mode === m ? "bg-accent text-accent-ink" : "bg-panel-2 text-muted hover:text-text"}`} onClick={() => setMode(m)}>
                  {label}
                </button>
              ))}
            </div>
            {mode === "attack" && attack && (
              <>
                <select className="input w-auto max-w-56 py-1" value={attack.id} onChange={(e) => setPick({ ...pick, attack: e.target.value })}>
                  {attacks.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn py-1"
                  disabled={busy}
                  onClick={() => run(async () => void (await rollArCheck(ctx, c!, `${attack.name} 명중`, attack.hit)))}
                >
                  <span>명중 {formatDiceMod(attack.hit)}</span>
                </button>
                <button
                  className="btn py-1"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const r = await rollArCheck(ctx, c!, `${attack.name} 대미지`, attack.damage, { check: false });
                      offer([{ label: "대미지", total: r.total }], attack.name, "damage", attack.dmgType);
                    })
                  }
                >
                  <span>대미지 {formatDiceMod(attack.damage)}</span>
                </button>
                <button
                  className="btn-primary py-1"
                  disabled={busy || !!battle.damage}
                  title="대미지 굴림 직전·직후 스킬(증가·경감·커버링)을 받고 나서 굴리고 적용해요"
                  onClick={() => run(() => startTiming({ expr: formatDiceMod(attack.damage) }, attack.name, attack.dmgType))}
                >
                  <span>⏱ 대미지 (타이밍)</span>
                </button>
              </>
            )}
            {mode === "skill" &&
              (skill ? (
                <>
                  <select className="input w-auto max-w-64 py-1" value={skill.id} onChange={(e) => setPick({ ...pick, skill: e.target.value })}>
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.cost && s.cost !== "-" ? ` · ${s.cost}` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn-primary py-1"
                    disabled={busy}
                    title={`${skill.timing} · ${skill.target} · ${skill.range}`}
                    onClick={() =>
                      run(async () => {
                        const card = await applySkill(ctx, c!, skill);
                        const heal = /회복/.test(skill.effect) && !/대미지/.test(skill.effect);
                        offer(rolledTotals(card), skill.name, heal ? "heal" : "damage", dmgTypeOf(skill.effect));
                      })
                    }
                  >
                    <span>사용</span>
                  </button>
                  {skill.timing && <span className="text-[11px] text-muted">【{skill.timing}】</span>}
                </>
              ) : (
                <span className="text-muted">스킬이 없어요.</span>
              ))}
            {mode === "item" &&
              (item ? (
                <>
                  <select className="input w-auto max-w-56 py-1" value={item.id} onChange={(e) => setPick({ ...pick, item: e.target.value })}>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ×{i.qty}
                      </option>
                    ))}
                  </select>
                  <button className="btn-primary py-1" disabled={busy} onClick={() => run(() => applyItem(ctx, c!, item))} title="자기 자신에게 사용 (회복량은 자동 반영)">
                    <span>사용</span>
                  </button>
                </>
              ) : (
                <span className="text-muted">남은 아이템이 없어요.</span>
              ))}
          </div>
        ) : (
          <p className="text-muted">툴 안 시트가 없는 캐릭터예요. 굴림은 채팅으로 하고, 아래에서 값만 적용할 수 있어요.</p>
        )}

        {/* ② 누구에게 */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-muted">대상</span>
          {targets.length === 0 && <span className="text-muted/70">— 그리드에서 토큰을 눌러 고르세요</span>}
          {targets.map((t) => (
            <button key={t.id} className="rounded-full border border-hp/60 bg-hp/15 px-2 py-0.5 hover:line-through" onClick={() => onRemoveTarget(t.id)} title="빼기">
              {splitTitle(t.name).name}
            </button>
          ))}
        </div>

        {/* ③ 적용 */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
          {quick.map((q, i) => (
            <button key={i} className="rounded border border-accent/60 bg-accent/10 px-1.5 py-0.5 tabular-nums" onClick={() => setAmount(String(q.total))} title={q.label}>
              {q.total}
            </button>
          ))}
          <input className="input w-16 py-1 text-center tabular-nums" inputMode="numeric" placeholder="값" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} />
          <select className="input w-auto py-1" value={kind} onChange={(e) => setKind(e.target.value as EffectKind)}>
            {(Object.keys(EFFECT_LABEL) as EffectKind[]).map((k) => (
              <option key={k} value={k}>
                {EFFECT_LABEL[k]}
              </option>
            ))}
          </select>
          {kind === "damage" && (
            <select className="input w-auto py-1" value={dmgType} onChange={(e) => setDmgType(e.target.value as DamageType)}>
              {(Object.keys(DAMAGE_LABEL) as DamageType[]).map((k) => (
                <option key={k} value={k}>
                  {DAMAGE_LABEL[k]}
                </option>
              ))}
            </select>
          )}
          <button
            className="btn py-1"
            disabled={busy || targets.length === 0}
            title="대상에게 상태 이상(BS)·버프를 건다"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              bsMenu.open(
                { clientX: r.left, clientY: r.top - 4 },
                [
                  { title: `대상 ${targets.length}명에게 BS 부여` },
                  ...statusDefs(battle.statusDefs).map(
                    (b): MenuItem => ({
                      label: b.label,
                      hint: b.hint.split(" · ")[0],
                      icon: <span style={{ color: b.color }}>●</span>,
                      onSelect: () => giveBs(b.id, b.label, !!b.strength),
                    }),
                  ),
                ],
              );
            }}
          >
            <span>☠ BS</span>
          </button>
          {kind === "damage" && (
            <button
              className="btn ml-auto py-1"
              disabled={busy || !amount || targets.length === 0 || !!battle.damage}
              title="이 값으로 대미지 처리 창을 열어 직전·직후 선언(증가·경감·커버링)을 받아요"
              onClick={() => run(() => startTiming({ fixed: parseInt(amount, 10) || 0 }, source ?? "대미지", dmgType))}
            >
              <span>⏱ 타이밍 처리</span>
            </button>
          )}
          <button className={`btn-primary py-1 ${kind === "damage" ? "" : "ml-auto"}`} disabled={busy || !amount || targets.length === 0} onClick={apply}>
            <span>대상 {targets.length}명에게 적용</span>
          </button>
        </div>
        {msg && <p className={msg.bad ? "text-hp" : "text-muted"}>{msg.text}</p>}
      </div>
    </div>
  );
}

function Res({ g, label, color }: { g: Gauge; label: string; color: string }) {
  const pct = g.max > 0 ? Math.max(0, Math.min(100, (g.cur / g.max) * 100)) : 0;
  return (
    <span className="flex shrink-0 items-center gap-1 text-[10px] whitespace-nowrap text-muted">
      {label}
      <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-black/60 sm:block">
        <span className={`block h-full ${color}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular-nums">
        {g.cur}/{g.max}
      </span>
    </span>
  );
}
