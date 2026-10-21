"use client";

import { useMemo, useState, type ReactNode } from "react";
import { derive, formatDiceMod } from "@/lib/ar/derive";
import { AR_STATS, newId, type ArSheet, type ArSkill, type ArStatKey } from "@/lib/ar/types";
import { RichText, SkillName } from "./ChatMessageView";

// 시트 전체 편집기 (보관함용). 모든 칸이 한 화면에 펼쳐져 있고, 계산값은 바로 다시 계산된다.
export function ArSheetEditor({ sheet, onChange }: { sheet: ArSheet; onChange: (s: ArSheet) => void }) {
  const d = useMemo(() => derive(sheet), [sheet]);
  const set = (p: Partial<ArSheet>) => onChange({ ...sheet, ...p });
  const setProfile = (p: Partial<ArSheet["profile"]>) => set({ profile: { ...sheet.profile, ...p } });
  const enemy = sheet.kind === "enemy";

  const sections = [
    ["basic", "기본"],
    ["stats", "능력치"],
    ["combat", "전투"],
    ...(enemy || sheet.attacks.length ? [["attacks", "공격"]] : []),
    ["skills", `스킬 ${sheet.skills.length}`],
    ["equip", "장비"],
    ["items", `아이템 ${sheet.items.length}`],
    ...(enemy || sheet.drops.length ? [["drops", "드롭"]] : []),
  ] as [string, string][];

  return (
    <div className="space-y-4">
      <nav className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-1 bg-bg/90 px-1 py-2 backdrop-blur" aria-label="시트 구역">
        {sections.map(([id, label]) => (
          <a key={id} href={`#sec-${id}`} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-text">
            {label}
          </a>
        ))}
      </nav>

      <Section id="basic" title="기본 정보">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="이름" wide>
            <input className="input" value={sheet.profile.name} onChange={(e) => setProfile({ name: e.target.value })} />
          </Field>
          <Field label="구분">
            <select className="input" value={sheet.kind} onChange={(e) => set({ kind: e.target.value as ArSheet["kind"] })}>
              <option value="pc">PC 시트</option>
              <option value="enemy">에너미 시트</option>
            </select>
          </Field>
          <Field label={enemy ? "레벨" : "CL"}>
            <NumIn v={sheet.profile.level ?? 0} on={(v) => setProfile({ level: v })} />
          </Field>
          {enemy ? (
            <>
              <Field label="분류">
                <input className="input" value={sheet.profile.category ?? ""} onChange={(e) => setProfile({ category: e.target.value })} />
              </Field>
              <Field label="속성">
                <input className="input" value={sheet.profile.element ?? ""} onChange={(e) => setProfile({ element: e.target.value })} />
              </Field>
              <Field label="식별치">
                <NumIn v={sheet.profile.identify ?? 0} on={(v) => setProfile({ identify: v })} />
              </Field>
            </>
          ) : (
            <>
              <Field label="종족">
                <input className="input" value={sheet.profile.race ?? ""} onChange={(e) => setProfile({ race: e.target.value })} />
              </Field>
              <Field label="메인 클래스">
                <input className="input" value={sheet.profile.mainClass ?? ""} onChange={(e) => setProfile({ mainClass: e.target.value })} />
              </Field>
              <Field label="서포트 클래스">
                <input className="input" value={sheet.profile.supportClass ?? ""} onChange={(e) => setProfile({ supportClass: e.target.value })} />
              </Field>
              <Field label="플레이어">
                <input className="input" value={sheet.profile.player ?? ""} onChange={(e) => setProfile({ player: e.target.value })} />
              </Field>
              <Field label="길드">
                <input className="input" value={sheet.profile.guild ?? ""} onChange={(e) => setProfile({ guild: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="소지금 (G)">
            <NumIn v={sheet.money ?? 0} on={(v) => set({ money: v })} />
          </Field>
        </div>
      </Section>

      <Section id="stats" title="능력치" hint="능력치 = 기본치÷3 + 클래스 수정 + 기타 · 판정 = 주사위 + 능력치 + 판정 보너스">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-[11px] text-muted">
              <tr className="[&>th]:px-1 [&>th]:pb-1 [&>th]:font-normal">
                <th className="text-left">능력</th>
                <th>기본치</th>
                <th>보너스</th>
                <th>메인</th>
                <th>서포트</th>
                <th>기타</th>
                <th className="text-accent">능력치</th>
                <th>판정+</th>
                <th>주사위</th>
                <th className="text-accent">판정</th>
              </tr>
            </thead>
            <tbody>
              {AR_STATS.map(({ key, label }) => {
                const st = sheet.stats.find((x) => x.key === key)!;
                const ds = d.stats.find((x) => x.key === key)!;
                const up = (p: Partial<typeof st>) => set({ stats: sheet.stats.map((x) => (x.key === key ? { ...x, ...p } : x)) });
                return (
                  <tr key={key} className="border-t border-line/60 [&>td]:px-1 [&>td]:py-1">
                    <td className="font-bold">{label}</td>
                    <td><NumIn v={st.base} on={(v) => up({ base: v })} /></td>
                    <td className="text-center text-muted">{ds.bonus}</td>
                    <td><NumIn v={st.main} on={(v) => up({ main: v })} /></td>
                    <td><NumIn v={st.support} on={(v) => up({ support: v })} /></td>
                    <td><NumIn v={st.extra} on={(v) => up({ extra: v })} /></td>
                    <td className="text-center text-lg font-bold text-accent">{ds.value}</td>
                    <td><NumIn v={st.skill} on={(v) => up({ skill: v })} /></td>
                    <td><NumIn v={st.dice} on={(v) => up({ dice: Math.max(1, v) })} /></td>
                    <td className="text-center font-mono font-bold text-accent">{formatDiceMod(ds.check)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center text-xs text-muted">
            특수 판정
            <button
              className="btn ml-auto px-2 py-0.5 text-xs"
              onClick={() => set({ checks: [...sheet.checks, { key: newId(), label: "새 판정", stat: "INT", dice: 2, mod: 0 }] })}
            >
              <span>추가</span>
            </button>
          </div>
          <div className="space-y-1">
            {sheet.checks.map((c) => {
              const up = (p: Partial<typeof c>) => set({ checks: sheet.checks.map((x) => (x.key === c.key ? { ...x, ...p } : x)) });
              return (
                <div key={c.key} className="grid grid-cols-[1fr_6rem_4rem_4rem_6rem_auto] items-center gap-1">
                  <input className="input py-1" value={c.label} onChange={(e) => up({ label: e.target.value })} />
                  <select className="input py-1" value={c.stat} onChange={(e) => up({ stat: e.target.value as ArStatKey })}>
                    {AR_STATS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <NumIn v={c.dice} on={(v) => up({ dice: v })} title="주사위" />
                  <NumIn v={c.mod} on={(v) => up({ mod: v })} title="추가 수정" />
                  <span className="text-center font-mono text-sm text-accent">{formatDiceMod({ dice: c.dice, mod: d.stat[c.stat] + c.mod })}</span>
                  <Del onClick={() => set({ checks: sheet.checks.filter((x) => x.key !== c.key) })} />
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      <Section id="combat" title="전투">
        <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
          <Stat label="명중" v={formatDiceMod(d.hit)} />
          <Stat label="회피" v={formatDiceMod(d.evasion)} />
          <Stat label="대미지" v={formatDiceMod(d.damage)} />
          <Stat label="행동치" v={d.action} />
          <Stat label="이동력" v={`${d.move}m`} />
          <Stat label="물리 방어" v={d.pdef} />
          <Stat label="마법 방어" v={d.mdef} />
          <Stat label="무게" v={d.weight} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          {(
            [
              ["hitDice", "명중 주사위"],
              ["hitMod", "명중 수정"],
              ["evaDice", "회피 주사위"],
              ["evaMod", "회피 수정"],
              ["dmgDice", "대미지 주사위"],
              ["dmgMod", "대미지 수정"],
              ["actionMod", "행동치 수정"],
              ["moveMod", "이동력 수정"],
              ["pdefMod", "물방 수정"],
              ["mdefMod", "마방 수정"],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <NumIn v={sheet.combat[k]} on={(v) => set({ combat: { ...sheet.combat, [k]: v } })} />
            </Field>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={!!sheet.fixed}
            onChange={(e) =>
              set({ fixed: e.target.checked ? { evasion: d.evasion, action: d.action, move: d.move, pdef: d.pdef, mdef: d.mdef } : undefined })
            }
          />
          회피·행동치·이동력·방어력을 계산 대신 직접 적기 (에너미 데이터처럼)
        </label>
        {sheet.fixed && (
          <div className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-6">
            <Field label="회피 주사위">
              <NumIn v={sheet.fixed.evasion?.dice ?? 2} on={(v) => set({ fixed: { ...sheet.fixed, evasion: { dice: v, mod: sheet.fixed?.evasion?.mod ?? 0 } } })} />
            </Field>
            <Field label="회피 수정">
              <NumIn v={sheet.fixed.evasion?.mod ?? 0} on={(v) => set({ fixed: { ...sheet.fixed, evasion: { dice: sheet.fixed?.evasion?.dice ?? 2, mod: v } } })} />
            </Field>
            {(["action", "move", "pdef", "mdef"] as const).map((k) => (
              <Field key={k} label={{ action: "행동치", move: "이동력", pdef: "물리 방어", mdef: "마법 방어" }[k]}>
                <NumIn v={sheet.fixed?.[k] ?? 0} on={(v) => set({ fixed: { ...sheet.fixed, [k]: v } })} />
              </Field>
            ))}
          </div>
        )}
      </Section>

      {(enemy || sheet.attacks.length > 0) && (
        <Section
          id="attacks"
          title="공격"
          action={
            <AddBtn
              onClick={() =>
                set({ attacks: [...sheet.attacks, { id: newId(), name: "새 공격", kind: "", hit: { dice: 2, mod: 0 }, damage: { dice: 2, mod: 0 }, damageType: "", range: "지근" }] })
              }
            />
          }
        >
          <div className="space-y-2">
            {sheet.attacks.map((a) => {
              const up = (p: Partial<typeof a>) => set({ attacks: sheet.attacks.map((x) => (x.id === a.id ? { ...x, ...p } : x)) });
              return (
                <div key={a.id} className="grid grid-cols-2 gap-2 rounded border border-line p-2 md:grid-cols-[2fr_1fr_repeat(4,4.5rem)_1fr_1fr_auto]">
                  <Field label="이름"><input className="input py-1" value={a.name} onChange={(e) => up({ name: e.target.value })} /></Field>
                  <Field label="종류"><input className="input py-1" value={a.kind} onChange={(e) => up({ kind: e.target.value })} /></Field>
                  <Field label="명중 D"><NumIn v={a.hit.dice} on={(v) => up({ hit: { ...a.hit, dice: v } })} /></Field>
                  <Field label="명중 +"><NumIn v={a.hit.mod} on={(v) => up({ hit: { ...a.hit, mod: v } })} /></Field>
                  <Field label="대미지 D"><NumIn v={a.damage.dice} on={(v) => up({ damage: { ...a.damage, dice: v } })} /></Field>
                  <Field label="대미지 +"><NumIn v={a.damage.mod} on={(v) => up({ damage: { ...a.damage, mod: v } })} /></Field>
                  <Field label="대미지 종류"><input className="input py-1" value={a.damageType} onChange={(e) => up({ damageType: e.target.value })} /></Field>
                  <Field label="사거리"><input className="input py-1" value={a.range} onChange={(e) => up({ range: e.target.value })} /></Field>
                  <div className="flex items-end"><Del onClick={() => set({ attacks: sheet.attacks.filter((x) => x.id !== a.id) })} /></div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section
        id="skills"
        title="스킬"
        hint="효과에 [[5D6+20]] 처럼 쓰면 쓸 때 굴려요 · **굵게**"
        action={
          <AddBtn
            onClick={() =>
              set({ skills: [...sheet.skills, { id: newId(), name: "새 스킬", sl: 1, slMax: "1", timing: "메이저", target: "단일", range: "지근", cost: "-", effect: "" }] })
            }
          />
        }
      >
        <SkillsEditor skills={sheet.skills} onChange={(skills) => set({ skills })} />
      </Section>

      <Section
        id="equip"
        title="장비"
        action={<AddBtn onClick={() => set({ equipment: [...sheet.equipment, { slot: "장신구", name: "새 장비", weight: 0, hit: 0, atk: 0, action: 0, move: 0, pdef: 0, mdef: 0, note: "" }] })} />}
      >
        <div className="space-y-2">
          {sheet.equipment.length === 0 && <Empty>장비가 없어요.</Empty>}
          {sheet.equipment.map((e, i) => {
            const up = (p: Partial<typeof e>) => set({ equipment: sheet.equipment.map((x, j) => (j === i ? { ...x, ...p } : x)) });
            return (
              <div key={i} className="rounded border border-line p-2">
                <div className="grid grid-cols-4 gap-2 md:grid-cols-[7rem_1fr_repeat(7,4rem)_auto]">
                  <Field label="부위">
                    <select className="input py-1" value={e.slot} onChange={(ev) => up({ slot: ev.target.value })}>
                      {["오른손", "왼손", "양손", "머리", "몸", "보조 방어구", "장신구", e.slot].filter((v, k, a) => a.indexOf(v) === k).map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="이름" wide><input className="input py-1" value={e.name} onChange={(ev) => up({ name: ev.target.value })} /></Field>
                  {(["hit", "atk", "action", "move", "pdef", "mdef", "weight"] as const).map((k) => (
                    <Field key={k} label={{ hit: "명중", atk: "공격력", action: "행동", move: "이동", pdef: "물방", mdef: "마방", weight: "무게" }[k]}>
                      <NumIn v={e[k]} on={(v) => up({ [k]: v })} />
                    </Field>
                  ))}
                  <div className="flex items-end"><Del onClick={() => set({ equipment: sheet.equipment.filter((_, j) => j !== i) })} /></div>
                </div>
                <textarea className="input mt-2 min-h-12 text-xs" placeholder="효과·크리스탈" value={e.note} onChange={(ev) => up({ note: ev.target.value })} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        id="items"
        title="아이템"
        hint="설명에 「MP를 [[4d6+16]]만큼 회복」처럼 쓰면 사용할 때 자동 회복"
        action={<AddBtn onClick={() => set({ items: [...sheet.items, { id: newId(), name: "새 아이템", qty: 1, weight: 0, desc: "" }] })} />}
      >
        <div className="space-y-1.5">
          {sheet.items.length === 0 && <Empty>아이템이 없어요.</Empty>}
          {sheet.items.map((it) => {
            const up = (p: Partial<typeof it>) => set({ items: sheet.items.map((x) => (x.id === it.id ? { ...x, ...p } : x)) });
            return (
              <div key={it.id} className="grid grid-cols-[1fr_4.5rem_4.5rem_auto] gap-2 rounded border border-line p-2 md:grid-cols-[14rem_4.5rem_4.5rem_1fr_auto]">
                <Field label="이름"><input className="input py-1" value={it.name} onChange={(e) => up({ name: e.target.value })} /></Field>
                <Field label="수량"><NumIn v={it.qty} on={(v) => up({ qty: Math.max(0, v) })} /></Field>
                <Field label="무게"><NumIn v={it.weight} on={(v) => up({ weight: v })} /></Field>
                <div className="col-span-4 md:col-span-1">
                  <Field label="설명"><textarea className="input min-h-9 py-1 text-xs" value={it.desc} onChange={(e) => up({ desc: e.target.value })} /></Field>
                </div>
                <div className="flex items-end"><Del onClick={() => set({ items: sheet.items.filter((x) => x.id !== it.id) })} /></div>
              </div>
            );
          })}
        </div>
      </Section>

      {(enemy || sheet.drops.length > 0) && (
        <Section id="drops" title="드롭" action={<AddBtn onClick={() => set({ drops: [...sheet.drops, { range: "", name: "", price: 0, count: 1 }] })} />}>
          <div className="space-y-1">
            {sheet.drops.map((x, i) => {
              const up = (p: Partial<typeof x>) => set({ drops: sheet.drops.map((y, j) => (j === i ? { ...y, ...p } : y)) });
              return (
                <div key={i} className="grid grid-cols-[5rem_1fr_5rem_4rem_auto] items-end gap-2">
                  <Field label="눈"><input className="input py-1" value={x.range} onChange={(e) => up({ range: e.target.value })} /></Field>
                  <Field label="이름"><input className="input py-1" value={x.name} onChange={(e) => up({ name: e.target.value })} /></Field>
                  <Field label="가격"><NumIn v={x.price} on={(v) => up({ price: v })} /></Field>
                  <Field label="개수"><NumIn v={x.count} on={(v) => up({ count: v })} /></Field>
                  <Del onClick={() => set({ drops: sheet.drops.filter((_, j) => j !== i) })} />
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

function SkillsEditor({ skills, onChange }: { skills: ArSkill[]; onChange: (s: ArSkill[]) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const shown = skills.filter((s) => !q || (s.name + s.timing + s.effect).toLowerCase().includes(q.toLowerCase()));
  const up = (id: string, p: Partial<ArSkill>) => onChange(skills.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const move = (id: string, dir: -1 | 1) => {
    const i = skills.findIndex((s) => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= skills.length) return;
    const next = [...skills];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <input className="input mb-2" placeholder="스킬 찾기 (이름·타이밍·효과)" value={q} onChange={(e) => setQ(e.target.value)} />
      {skills.length === 0 && <Empty>스킬이 없어요.</Empty>}
      <ul className="space-y-1.5">
        {shown.map((s) => {
          const isOpen = open === s.id;
          return (
            <li key={s.id} className="rounded-md border border-line bg-panel-2">
              <div className="flex items-center gap-2 px-3 py-2">
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
                  <SkillName name={s.name || "(이름 없음)"} color={s.color} glow={s.glow} className="text-[15px]" />
                  <span className="ml-2 text-[11px] text-muted">
                    {[s.timing && `【${s.timing}】`, `SL ${s.sl}${s.slMax ? `/${s.slMax}` : ""}`, s.cost && s.cost !== "-" && `코스트 ${s.cost}`].filter(Boolean).join(" · ")}
                  </span>
                </button>
                <button className="px-1 text-muted hover:text-text" onClick={() => move(s.id, -1)} aria-label="위로">
                  ▲
                </button>
                <button className="px-1 text-muted hover:text-text" onClick={() => move(s.id, 1)} aria-label="아래로">
                  ▼
                </button>
              </div>
              {isOpen && (
                <div className="grid gap-3 border-t border-line/60 p-3 md:grid-cols-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="이름" wide><input className="input py-1" value={s.name} onChange={(e) => up(s.id, { name: e.target.value })} /></Field>
                    <Field label="이름 색">
                      <div className="flex items-center gap-2">
                        <input type="color" value={s.color ?? "#ffffff"} onChange={(e) => up(s.id, { color: e.target.value })} aria-label="글자색" />
                        <input type="color" value={s.glow ?? "#000000"} onChange={(e) => up(s.id, { glow: e.target.value })} aria-label="빛 색" />
                        <button className="text-[11px] text-muted hover:text-text" onClick={() => up(s.id, { color: undefined, glow: undefined })}>
                          꾸밈 없애기
                        </button>
                      </div>
                    </Field>
                    <Field label="타이밍"><input className="input py-1" value={s.timing} onChange={(e) => up(s.id, { timing: e.target.value })} /></Field>
                    <Field label="대상"><input className="input py-1" value={s.target} onChange={(e) => up(s.id, { target: e.target.value })} /></Field>
                    <Field label="사거리"><input className="input py-1" value={s.range} onChange={(e) => up(s.id, { range: e.target.value })} /></Field>
                    <Field label="코스트 (숫자면 MP 차감)"><input className="input py-1" value={s.cost} onChange={(e) => up(s.id, { cost: e.target.value })} /></Field>
                    <Field label="SL"><NumIn v={s.sl} on={(v) => up(s.id, { sl: v })} /></Field>
                    <Field label="최대 SL"><input className="input py-1" value={s.slMax} onChange={(e) => up(s.id, { slMax: e.target.value })} /></Field>
                    <Field label="딸린 굴림 (예: 4d6+17)" wide><input className="input py-1" value={s.roll ?? ""} onChange={(e) => up(s.id, { roll: e.target.value || undefined })} /></Field>
                    <Field label="효과" wide>
                      <textarea className="input min-h-36 text-xs leading-relaxed" value={s.effect} onChange={(e) => up(s.id, { effect: e.target.value })} />
                    </Field>
                    <div className="col-span-2">
                      <button className="btn text-xs text-hp" onClick={() => onChange(skills.filter((x) => x.id !== s.id))}>
                        <span>이 스킬 지우기</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-[11px] text-muted">미리보기 (채팅 카드)</div>
                    <div className="rounded-md border border-line bg-panel">
                      <div className="border-b border-line bg-black/30 px-3 py-1.5">
                        <SkillName name={s.name} color={s.color} glow={s.glow} className="text-[15px]" />
                      </div>
                      <RichText
                        segments={[s.effect.replace(/\[\[([^\]]+)\]\]/g, "⟦$1⟧") || "효과를 적으면 여기 보여요."]}
                        className="px-3 py-2 text-[13px] leading-relaxed"
                      />
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Section({ id, title, hint, action, children }: { id: string; title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={`sec-${id}`} className="panel scroll-mt-16 p-4">
      <header className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </header>
      {children}
    </section>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`block text-[11px] text-muted ${wide ? "col-span-2" : ""}`}>
      <span className="mb-0.5 block">{label}</span>
      {children}
    </label>
  );
}

function NumIn({ v, on, title }: { v: number; on: (v: number) => void; title?: string }) {
  return (
    <input
      type="number"
      title={title}
      className="input px-1.5 py-1 text-center tabular-nums"
      value={Number.isFinite(v) ? v : 0}
      onChange={(e) => on(parseInt(e.target.value, 10) || 0)}
    />
  );
}

function Stat({ label, v }: { label: string; v: ReactNode }) {
  return (
    <div className="rounded border border-line bg-panel-2 p-2 text-center">
      <div className="text-[10px] text-muted">{label}</div>
      <div className="font-mono text-base font-bold text-accent">{v}</div>
    </div>
  );
}

function AddBtn({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn px-2 py-0.5 text-xs" onClick={onClick}>
      <span>+ 추가</span>
    </button>
  );
}

function Del({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn px-2 py-1 text-xs text-hp" onClick={onClick} aria-label="지우기">
      <span>✕</span>
    </button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-2 text-xs text-muted">{children}</p>;
}
