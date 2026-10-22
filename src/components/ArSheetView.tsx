"use client";

import { useMemo, useState, type ReactNode } from "react";
import { rollArCheck, saveAr, applyItem, applySkill, type ActCtx } from "@/lib/ar/actions";
import { derive, formatDiceMod } from "@/lib/ar/derive";
import { newId, type ArSheet, type ArSkill, type DiceMod } from "@/lib/ar/types";
import { StyledTextarea } from "./StyledTextarea";
import { setGauge } from "@/lib/campaigns";
import type { Segment } from "@/lib/inline";
import type { Character } from "@/lib/types";
import { GaugeRow } from "./CharacterCard";
import { RichText, SkillName } from "./ChatMessageView";
import { useSession } from "./session/SessionContext";

type Tab = "stat" | "combat" | "skill" | "equip" | "item" | "attack";

// 툴 안 아리안로드 시트 — 누르면 굴리고, 스킬·아이템은 채팅 카드로
export function ArSheetView({ character: c }: { character: Character }) {
  const { cid, user, isGM, campaign } = useSession();
  const ar = c.ar!;
  const canEdit = isGM || c.ownerUid === user.uid;
  const ctx: ActCtx = { cid, uid: user.uid, isGM, gmUid: campaign.gmUid };

  const [tab, setTab] = useState<Tab>("stat");
  const [draft, setDraft] = useState<ArSheet | null>(null); // 편집 중일 때만
  const [fate, setFate] = useState(0);
  const [secret, setSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sheet = draft ?? ar;
  const d = useMemo(() => derive(sheet), [sheet]);
  const editing = !!draft;

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

  // 페이트 주사위는 rollArCheck 가 더한다 (여기서 더하면 두 번 붙음)
  function check(label: string, dm: DiceMod, opts: { check?: boolean } = {}) {
    if (editing || !canEdit) return;
    act(async () => {
      await rollArCheck(ctx, c, label, dm, { fate: opts.check === false ? 0 : fate, secret, check: opts.check });
      if (opts.check !== false) setFate(0);
    });
  }

  const patch = (p: Partial<ArSheet>) => setDraft((s) => ({ ...(s ?? ar), ...p }));

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "stat", label: "능력", show: true },
    { id: "combat", label: "전투", show: true },
    { id: "attack", label: `공격 ${sheet.attacks.length}`, show: sheet.kind === "enemy" || sheet.attacks.length > 0 },
    { id: "skill", label: `스킬 ${sheet.skills.length}`, show: true },
    { id: "equip", label: "장비", show: sheet.kind === "pc" || sheet.equipment.length > 0 },
    { id: "item", label: `아이템 ${sheet.items.length}`, show: true },
  ];
  const p = sheet.profile;

  return (
    <article className="panel p-3 text-sm">
      <header className="flex items-start gap-2">
        {c.portrait && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.portrait} alt="" className="h-12 w-12 shrink-0 rounded-full border border-line object-cover object-top" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-display truncate text-lg font-bold" style={{ color: c.color }}>
            {p.name}
          </h3>
          <p className="truncate text-xs text-muted">
            {[
              p.level != null && `${sheet.kind === "enemy" ? "Lv" : "CL"}.${p.level}`,
              p.race,
              [p.mainClass, p.supportClass].filter(Boolean).join(" / "),
              p.category,
              p.element && `속성 ${p.element}`,
              p.identify != null && `식별치 ${p.identify}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {canEdit && !editing && (
          <button className="btn px-2 py-0.5 text-xs" onClick={() => setDraft(structuredClone(ar))}>
            <span>편집</span>
          </button>
        )}
        {editing && (
          <div className="flex gap-1">
            <button className="btn px-2 py-0.5 text-xs" onClick={() => setDraft(null)}>
              <span>취소</span>
            </button>
            <button
              className="btn-primary px-2 py-0.5 text-xs"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await saveAr(ctx, c, draft!);
                  setDraft(null);
                })
              }
            >
              <span>저장</span>
            </button>
          </div>
        )}
      </header>

      <div className="mt-2 space-y-1.5">
        <GaugeRow label="HP" color="bg-hp" value={c.hp} editable={canEdit} onChange={(v) => act(() => setGauge(cid, c.id, "hp", v))} />
        <GaugeRow label="MP" color="bg-mp" value={c.mp} editable={canEdit} onChange={(v) => act(() => setGauge(cid, c.id, "mp", v))} />
        {sheet.kind === "pc" && (
          <GaugeRow label="페이트" color="bg-fate" value={c.fate} editable={canEdit} onChange={(v) => act(() => setGauge(cid, c.id, "fate", v))} />
        )}
      </div>

      {canEdit && !editing && (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded border border-line bg-panel-2 px-2 py-1 text-xs">
          {sheet.kind === "pc" && (
            <label className="flex items-center gap-1">
              다음 판정에 페이트
              <Stepper value={fate} min={0} max={c.fate.cur} onChange={setFate} />
            </label>
          )}
          {isGM && (
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} />
              GM에게만 굴리기
            </label>
          )}
        </div>
      )}

      <nav className="mt-3 flex flex-wrap gap-1 border-b border-line pb-1" aria-label="시트 탭">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-t px-2 py-1 text-xs ${tab === t.id ? "bg-accent text-accent-ink" : "text-muted hover:text-text"}`}
            >
              {t.label}
            </button>
          ))}
      </nav>

      <div className="mt-2">
        {tab === "stat" && (
          <>
            <div className="grid grid-cols-4 gap-1.5">
              {d.stats.map((st) => {
                const raw = sheet.stats.find((x) => x.key === st.key)!;
                return (
                  <div key={st.key} className="rounded border border-line bg-panel-2 p-1.5 text-center">
                    <div className="text-[10px] text-muted">{st.label}</div>
                    <div className="text-lg leading-tight font-bold">{st.value}</div>
                    {editing ? (
                      <div className="mt-1 grid grid-cols-2 gap-0.5 text-[10px]">
                        <Num label="기본" v={raw.base} on={(v) => patch({ stats: sheet.stats.map((x) => (x.key === st.key ? { ...x, base: v } : x)) })} />
                        <Num label="메인" v={raw.main} on={(v) => patch({ stats: sheet.stats.map((x) => (x.key === st.key ? { ...x, main: v } : x)) })} />
                        <Num label="서포트" v={raw.support} on={(v) => patch({ stats: sheet.stats.map((x) => (x.key === st.key ? { ...x, support: v } : x)) })} />
                        <Num label="기타" v={raw.extra} on={(v) => patch({ stats: sheet.stats.map((x) => (x.key === st.key ? { ...x, extra: v } : x)) })} />
                        <Num label="판정+" v={raw.skill} on={(v) => patch({ stats: sheet.stats.map((x) => (x.key === st.key ? { ...x, skill: v } : x)) })} />
                        <Num label="D" v={raw.dice} on={(v) => patch({ stats: sheet.stats.map((x) => (x.key === st.key ? { ...x, dice: v } : x)) })} />
                      </div>
                    ) : (
                      <RollButton disabled={!canEdit || busy} onClick={() => check(`${st.label} 판정`, st.check)}>
                        {formatDiceMod(st.check)}
                      </RollButton>
                    )}
                  </div>
                );
              })}
            </div>
            {sheet.checks.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {sheet.checks.map((ck) => {
                  const dm = { dice: ck.dice, mod: d.stat[ck.stat] + ck.mod };
                  return (
                    <button key={ck.key} className="btn px-2 py-0.5 text-xs" disabled={editing || !canEdit || busy} onClick={() => check(ck.label, dm)}>
                      <span>
                        {ck.label} <b className="font-mono">{formatDiceMod(dm)}</b>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "combat" && (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              <Tile label="명중" value={formatDiceMod(d.hit)} onRoll={canEdit && !editing ? () => check("명중 판정", d.hit) : undefined} />
              <Tile label="회피" value={formatDiceMod(d.evasion)} onRoll={canEdit && !editing ? () => check("회피 판정", d.evasion) : undefined} />
              <Tile label="대미지" value={formatDiceMod(d.damage)} onRoll={canEdit && !editing ? () => check("대미지", d.damage, { check: false }) : undefined} />
              <Tile label="행동치" value={d.action} />
              <Tile label="이동력" value={`${d.move}m`} />
              <Tile label="무게" value={d.weight} />
              <Tile label="물리 방어" value={d.pdef} />
              <Tile label="마법 방어" value={d.mdef} />
              {sheet.money != null && <Tile label="소지금" value={`${sheet.money}G`} />}
            </div>
            {editing && (
              <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                {(
                  [
                    ["hitDice", "명중 D"],
                    ["hitMod", "명중 +"],
                    ["evaDice", "회피 D"],
                    ["evaMod", "회피 +"],
                    ["dmgDice", "대미지 D"],
                    ["dmgMod", "대미지 +"],
                    ["actionMod", "행동치 +"],
                    ["moveMod", "이동력 +"],
                    ["pdefMod", "물방 +"],
                    ["mdefMod", "마방 +"],
                  ] as const
                ).map(([k, label]) => (
                  <Num key={k} label={label} v={sheet.combat[k]} on={(v) => patch({ combat: { ...sheet.combat, [k]: v } })} />
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted">
              {sheet.fixed ? "에너미 데이터의 회피·행동치·방어력을 그대로 써요." : "명중 = 재주+장비+스킬 · 대미지 = 근력+무기 공격력+스킬 · 행동치 = 민첩+감지+수정 · 마방 = 정신+장비"}
            </p>
          </>
        )}

        {tab === "attack" && (
          <ul className="space-y-1.5">
            {sheet.attacks.map((a) => (
              <li key={a.id} className="rounded border border-line bg-panel-2 p-2">
                {editing ? (
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <Text label="이름" v={a.name} on={(v) => patch({ attacks: sheet.attacks.map((x) => (x.id === a.id ? { ...x, name: v } : x)) })} />
                    <Text label="사거리" v={a.range} on={(v) => patch({ attacks: sheet.attacks.map((x) => (x.id === a.id ? { ...x, range: v } : x)) })} />
                    <Num label="명중 D" v={a.hit.dice} on={(v) => patch({ attacks: sheet.attacks.map((x) => (x.id === a.id ? { ...x, hit: { ...x.hit, dice: v } } : x)) })} />
                    <Num label="명중 +" v={a.hit.mod} on={(v) => patch({ attacks: sheet.attacks.map((x) => (x.id === a.id ? { ...x, hit: { ...x.hit, mod: v } } : x)) })} />
                    <Num label="대미지 D" v={a.damage.dice} on={(v) => patch({ attacks: sheet.attacks.map((x) => (x.id === a.id ? { ...x, damage: { ...x.damage, dice: v } } : x)) })} />
                    <Num label="대미지 +" v={a.damage.mod} on={(v) => patch({ attacks: sheet.attacks.map((x) => (x.id === a.id ? { ...x, damage: { ...x.damage, mod: v } } : x)) })} />
                    <Text label="대미지 종류" v={a.damageType} on={(v) => patch({ attacks: sheet.attacks.map((x) => (x.id === a.id ? { ...x, damageType: v } : x)) })} />
                    <button className="btn text-hp" onClick={() => patch({ attacks: sheet.attacks.filter((x) => x.id !== a.id) })}>
                      <span>지우기</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{a.name}</span>
                    <span className="text-[11px] text-muted">{[a.kind, a.damageType, a.range].filter(Boolean).join(" · ")}</span>
                    <span className="ml-auto flex gap-1">
                      <RollButton disabled={!canEdit || busy} onClick={() => check(`${a.name} 명중`, a.hit)}>
                        명중 {formatDiceMod(a.hit)}
                      </RollButton>
                      <RollButton disabled={!canEdit || busy} onClick={() => check(`${a.name} 대미지`, a.damage, { check: false })}>
                        대미지 {formatDiceMod(a.damage)}
                      </RollButton>
                    </span>
                  </div>
                )}
              </li>
            ))}
            {editing && (
              <button
                className="btn w-full text-xs"
                onClick={() =>
                  patch({
                    attacks: [...sheet.attacks, { id: newId(), name: "새 공격", kind: "", hit: { dice: 2, mod: 0 }, damage: { dice: 2, mod: 0 }, damageType: "", range: "지근" }],
                  })
                }
              >
                <span>공격 추가</span>
              </button>
            )}
            {sheet.drops.length > 0 && (
              <li className="rounded border border-dashed border-line p-2 text-[11px] text-muted">
                드롭: {sheet.drops.map((x) => `${x.range} ${x.name}${x.price ? ` ${x.price}G` : ""}${x.count > 1 ? `×${x.count}` : ""}`).join(" / ")}
              </li>
            )}
          </ul>
        )}

        {tab === "skill" && (
          <SkillList
            skills={sheet.skills}
            editing={editing}
            canUse={canEdit && !busy}
            onUse={(s) => act(async () => void (await applySkill(ctx, c, s)))}
            onChange={(skills) => patch({ skills })}
          />
        )}

        {tab === "equip" && (
          <ul className="space-y-1.5">
            {sheet.equipment.length === 0 && !editing && <li className="text-xs text-muted">장비가 없어요.</li>}
            {sheet.equipment.map((e, i) => (
              <li key={i} className="rounded border border-line bg-panel-2 p-2">
                {editing ? (
                  <div className="grid grid-cols-4 gap-1 text-[11px]">
                    <Text label="부위" v={e.slot} on={(v) => patch({ equipment: sheet.equipment.map((x, j) => (j === i ? { ...x, slot: v } : x)) })} />
                    <div className="col-span-3">
                      <Text label="이름" v={e.name} on={(v) => patch({ equipment: sheet.equipment.map((x, j) => (j === i ? { ...x, name: v } : x)) })} />
                    </div>
                    {(["hit", "atk", "action", "move", "pdef", "mdef", "weight"] as const).map((k) => (
                      <Num
                        key={k}
                        label={{ hit: "명중", atk: "공격력", action: "행동", move: "이동", pdef: "물방", mdef: "마방", weight: "무게" }[k]}
                        v={e[k]}
                        on={(v) => patch({ equipment: sheet.equipment.map((x, j) => (j === i ? { ...x, [k]: v } : x)) })}
                      />
                    ))}
                    <button className="btn text-hp" onClick={() => patch({ equipment: sheet.equipment.filter((_, j) => j !== i) })}>
                      <span>지우기</span>
                    </button>
                    <div className="col-span-4">
                      <Text label="효과" v={e.note} area on={(v) => patch({ equipment: sheet.equipment.map((x, j) => (j === i ? { ...x, note: v } : x)) })} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="w-16 shrink-0 text-[11px] text-muted">{e.slot}</span>
                      <span className="font-bold">{e.name}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1 text-[11px] text-muted">
                      {e.hit !== 0 && <Chip>명중 {sign(e.hit)}</Chip>}
                      {e.atk !== 0 && <Chip>공격력 {sign(e.atk)}</Chip>}
                      {e.action !== 0 && <Chip>행동 {sign(e.action)}</Chip>}
                      {e.move !== 0 && <Chip>이동 {sign(e.move)}</Chip>}
                      {e.pdef !== 0 && <Chip>물방 {e.pdef}</Chip>}
                      {e.mdef !== 0 && <Chip>마방 {e.mdef}</Chip>}
                      {e.weight !== 0 && <Chip>무게 {e.weight}</Chip>}
                    </div>
                    {e.note && <p className="mt-1 text-[11px] whitespace-pre-wrap text-muted">{e.note}</p>}
                  </>
                )}
              </li>
            ))}
            {editing && (
              <button
                className="btn w-full text-xs"
                onClick={() =>
                  patch({ equipment: [...sheet.equipment, { slot: "장신구", name: "새 장비", weight: 0, hit: 0, atk: 0, action: 0, move: 0, pdef: 0, mdef: 0, note: "" }] })
                }
              >
                <span>장비 추가</span>
              </button>
            )}
          </ul>
        )}

        {tab === "item" && (
          <ul className="space-y-1">
            {sheet.items.length === 0 && !editing && <li className="text-xs text-muted">아이템이 없어요.</li>}
            {sheet.items.map((it) => (
              <ItemRow
                key={it.id}
                name={it.name}
                qty={it.qty}
                weight={it.weight}
                desc={it.desc}
                editing={editing}
                canUse={canEdit && !busy && it.qty > 0}
                onUse={() => act(() => applyItem(ctx, c, it))}
                onChange={(p) => patch({ items: sheet.items.map((x) => (x.id === it.id ? { ...x, ...p } : x)) })}
                onDelete={() => patch({ items: sheet.items.filter((x) => x.id !== it.id) })}
              />
            ))}
            {editing && (
              <button className="btn w-full text-xs" onClick={() => patch({ items: [...sheet.items, { id: newId(), name: "새 아이템", qty: 1, weight: 0, desc: "" }] })}>
                <span>아이템 추가</span>
              </button>
            )}
          </ul>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-hp">{error}</p>}
    </article>
  );
}

function SkillList({
  skills,
  editing,
  canUse,
  onUse,
  onChange,
}: {
  skills: ArSkill[];
  editing: boolean;
  canUse: boolean;
  onUse: (s: ArSkill) => void;
  onChange: (s: ArSkill[]) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const shown = skills.filter((s) => !q || (s.name + s.timing + s.effect).includes(q));
  const set = (id: string, p: Partial<ArSkill>) => onChange(skills.map((s) => (s.id === id ? { ...s, ...p } : s)));

  return (
    <div>
      <input className="input mb-2 py-1 text-xs" placeholder="스킬 찾기 (이름·타이밍·효과)" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="space-y-1">
        {shown.map((s) => {
          const isOpen = open === s.id || editing;
          return (
            <li key={s.id} className="rounded border border-line bg-panel-2">
              <button className="flex w-full items-center gap-2 px-2 py-1.5 text-left" onClick={() => setOpen(isOpen && !editing ? null : s.id)}>
                <SkillName name={s.name} color={s.color} glow={s.glow} className="min-w-0 flex-1 truncate text-[13px]" />
                <span className="shrink-0 text-[10px] text-muted">
                  {[s.timing, s.cost && s.cost !== "-" ? `코스트 ${s.cost}` : ""].filter(Boolean).join(" · ")}
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-line/60 px-2 py-2">
                  {editing ? (
                    <div className="grid grid-cols-4 gap-1 text-[11px]">
                      <div className="col-span-4">
                        <Text label="이름" v={s.name} on={(v) => set(s.id, { name: v })} />
                      </div>
                      <Text label="타이밍" v={s.timing} on={(v) => set(s.id, { timing: v })} />
                      <Text label="대상" v={s.target} on={(v) => set(s.id, { target: v })} />
                      <Text label="사거리" v={s.range} on={(v) => set(s.id, { range: v })} />
                      <Text label="코스트" v={s.cost} on={(v) => set(s.id, { cost: v })} />
                      <Num label="SL" v={s.sl} on={(v) => set(s.id, { sl: v })} />
                      <Text label="최대 SL" v={s.slMax} on={(v) => set(s.id, { slMax: v })} />
                      <Text label="딸린 굴림" v={s.roll ?? ""} on={(v) => set(s.id, { roll: v || undefined })} />
                      <label className="flex items-end gap-1">
                        <input type="color" value={s.color ?? "#ffffff"} onChange={(e) => set(s.id, { color: e.target.value })} aria-label="이름 색" />
                        <input type="color" value={s.glow ?? "#000000"} onChange={(e) => set(s.id, { glow: e.target.value })} aria-label="빛 색" />
                      </label>
                      <div className="col-span-4">
                        <Text label="효과 ([[5D6+20]] 처럼 쓰면 쓸 때 굴려요)" v={s.effect} area on={(v) => set(s.id, { effect: v })} />
                      </div>
                      <button className="btn col-span-4 text-hp" onClick={() => onChange(skills.filter((x) => x.id !== s.id))}>
                        <span>스킬 지우기</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-1 flex flex-wrap gap-1">
                        {[s.timing && `【${s.timing}】`, `SL ${s.sl}${s.slMax ? `/${s.slMax}` : ""}`, s.target, s.range, s.cost && `코스트 ${s.cost}`, s.roll && `굴림 ${s.roll}`]
                          .filter((x): x is string => !!x && x !== "-")
                          .map((m, i) => (
                            <Chip key={i}>{m}</Chip>
                          ))}
                      </div>
                      {s.effect && <RichText segments={previewSegments(s.effect)} className="text-[12px] leading-relaxed text-text/90" />}
                      <button className="btn-primary mt-2 w-full py-1 text-xs" disabled={!canUse} onClick={() => onUse(s)}>
                        <span>사용 — 채팅에 카드{/^\d+$/.test(s.cost.trim()) ? ` · MP ${s.cost}` : ""}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {editing && (
        <button
          className="btn mt-2 w-full text-xs"
          onClick={() =>
            onChange([...skills, { id: newId(), name: "새 스킬", sl: 1, slMax: "1", timing: "메이저", target: "단일", range: "지근", cost: "-", effect: "" }])
          }
        >
          <span>스킬 추가</span>
        </button>
      )}
    </div>
  );
}

// 미리보기에서는 굴리지 않고 식을 그대로 보여준다
function previewSegments(text: string): Segment[] {
  return [text.replace(/\[\[([^\]]+)\]\]/g, "⟦$1⟧")];
}

function ItemRow({
  name,
  qty,
  weight,
  desc,
  editing,
  canUse,
  onUse,
  onChange,
  onDelete,
}: {
  name: string;
  qty: number;
  weight: number;
  desc: string;
  editing: boolean;
  canUse: boolean;
  onUse: () => void;
  onChange: (p: { name?: string; qty?: number; weight?: number; desc?: string }) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (editing) {
    return (
      <li className="grid grid-cols-4 gap-1 rounded border border-line bg-panel-2 p-2 text-[11px]">
        <div className="col-span-2">
          <Text label="이름" v={name} on={(v) => onChange({ name: v })} />
        </div>
        <Num label="수량" v={qty} on={(v) => onChange({ qty: v })} />
        <Num label="무게" v={weight} on={(v) => onChange({ weight: v })} />
        <div className="col-span-4">
          <Text label="설명 (MP를 [[4d6+16]]만큼 회복 → 쓰면 자동 회복)" v={desc} area on={(v) => onChange({ desc: v })} />
        </div>
        <button className="btn col-span-4 text-hp" onClick={onDelete}>
          <span>지우기</span>
        </button>
      </li>
    );
  }
  return (
    <li className={`rounded border border-line bg-panel-2 ${qty <= 0 ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2 px-2 py-1">
        <button className="min-w-0 flex-1 truncate text-left" onClick={() => setOpen((v) => !v)}>
          {name} <span className="text-muted">×{qty}</span>
        </button>
        <button className="btn px-2 py-0 text-[11px]" disabled={!canUse} onClick={onUse}>
          <span>사용</span>
        </button>
      </div>
      {open && desc && <p className="border-t border-line/60 px-2 py-1 text-[11px] whitespace-pre-wrap text-muted">{desc.replace(/\[\[([^\]]+)\]\]/g, "⟦$1⟧")}</p>}
    </li>
  );
}

function Tile({ label, value, onRoll }: { label: string; value: ReactNode; onRoll?: () => void }) {
  const inner = (
    <>
      <div className="text-[10px] text-muted">{label}</div>
      <div className="font-mono text-base font-bold">{value}</div>
    </>
  );
  return onRoll ? (
    <button className="rounded border border-accent/50 bg-accent/10 p-1.5 text-center transition hover:bg-accent/20" onClick={onRoll} title={`${label} 굴리기`}>
      {inner}
    </button>
  ) : (
    <div className="rounded border border-line bg-panel-2 p-1.5 text-center">{inner}</div>
  );
}

function RollButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="mt-0.5 w-full rounded border border-accent/50 bg-accent/10 px-1 py-0.5 font-mono text-[11px] text-accent transition hover:bg-accent/20 disabled:pointer-events-none disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded border border-line bg-panel px-1.5 text-[11px] text-muted">{children}</span>;
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <button className="btn px-1.5 py-0" onClick={() => onChange(Math.max(min, value - 1))} aria-label="줄이기">
        <span>−</span>
      </button>
      <b className="w-5 text-center">{value}</b>
      <button className="btn px-1.5 py-0" onClick={() => onChange(Math.min(max, value + 1))} aria-label="늘리기">
        <span>+</span>
      </button>
      <span className="text-muted">/ {max}</span>
    </span>
  );
}

function Num({ label, v, on }: { label: string; v: number; on: (v: number) => void }) {
  return (
    <label className="block text-muted">
      {label}
      <input
        type="number"
        className="input mt-0.5 px-1 py-0.5 text-[11px] text-text"
        value={Number.isFinite(v) ? v : 0}
        onChange={(e) => on(parseInt(e.target.value, 10) || 0)}
      />
    </label>
  );
}

function Text({ label, v, on, area }: { label: string; v: string; on: (v: string) => void; area?: boolean }) {
  // 긴 글(스킬 효과·아이템 설명)은 꾸밀 수 있는 칸으로
  if (area)
    return (
      <div className="block text-muted">
        {label}
        <div className="mt-0.5">
          <StyledTextarea className="min-h-20 px-1 py-0.5 text-[11px] text-text" value={v} onChange={on} />
        </div>
      </div>
    );
  return (
    <label className="block text-muted">
      {label}
      <input className="input mt-0.5 px-1 py-0.5 text-[11px] text-text" value={v} onChange={(e) => on(e.target.value)} />
    </label>
  );
}

function sign(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

