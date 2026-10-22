"use client";

import { push, ref, remove, set, update } from "firebase/database";
import { sendEffect } from "./battle";
import { sendMessage } from "./chat";
import { readDiceColor } from "./diceColor";
import { rtdb } from "./firebase";
import { evalExpr, type Segment } from "./inline";
import { resolveDamage, type DamageWindow, type DmgCover, type DmgMod, type DmgReduce } from "./damageRules";
import type { Character } from "./types";

// 대미지 처리 창 — battle/{cid}/damage (한 번에 하나). 참가자 누구나 선언을 보탤 수 있다.

const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function openDamage(cid: string, w: Omit<DamageWindow, "at" | "phase">) {
  return set(ref(rtdb, `battle/${cid}/damage`), clean({ ...w, phase: "before", at: Date.now() }));
}

export function cancelDamage(cid: string) {
  return remove(ref(rtdb, `battle/${cid}/damage`));
}

// 식 하나를 지금 굴린다 (직후 선언은 선언할 때 굴린다)
export function rollExpr(expr: string): { total: number; seg: Segment } {
  const r = evalExpr(expr.replace(/^\+/, ""));
  return { total: r.total, seg: r };
}

export function addPlus(cid: string, m: DmgMod) {
  return push(ref(rtdb, `battle/${cid}/damage/plus`), clean(m));
}
export function addMinus(cid: string, m: DmgReduce) {
  return push(ref(rtdb, `battle/${cid}/damage/minus`), clean(m));
}
export function addCover(cid: string, c: DmgCover) {
  return push(ref(rtdb, `battle/${cid}/damage/covers`), clean(c));
}
export function removeDecl(cid: string, kind: "plus" | "minus" | "covers", key: string) {
  return remove(ref(rtdb, `battle/${cid}/damage/${kind}/${key}`));
}

// ② 대미지 굴림 — 기본 대미지 + 직전에 선언된 증가를 함께 굴려 채팅에 남기고 직후 단계로
export async function rollDamage(ctx: { cid: string; uid: string }, w: DamageWindow) {
  const segs: Segment[] = [];
  let base = 0;
  if (w.base.expr) {
    const r = evalExpr(w.base.expr);
    base = r.total;
    segs.push("기본 ", r);
  } else {
    base = w.base.fixed ?? 0;
    segs.push(`기본 ${base}`);
  }
  let total = base;
  const patch: Record<string, unknown> = {};
  for (const [k, m] of Object.entries(w.plus ?? {})) {
    if (m.phase !== "before") continue;
    const r = evalExpr(m.expr.replace(/^\+/, ""));
    total += r.total;
    patch[`battle/${ctx.cid}/damage/plus/${k}/total`] = r.total;
    segs.push(` + ${m.skill ?? m.by} `, r);
  }
  patch[`battle/${ctx.cid}/damage/rolled`] = { base, total };
  patch[`battle/${ctx.cid}/damage/phase`] = "after";
  await update(ref(rtdb), patch);
  await sendMessage(ctx.cid, {
    uid: ctx.uid,
    speaker: { name: w.attacker.name, uid: ctx.uid, charId: w.attacker.charId },
    kind: "card",
    text: "",
    card: { tag: "attack", title: `대미지 굴림 · ${w.source}`, meta: ["대미지 굴림", w.targets.map((t) => t.name).join(", ")], body: segs, note: `합계 ${total} — 직후 선언(경감·커버링)을 받아요` },
    diceColor: readDiceColor(),
  });
}

// ④ 확정 — 대상마다 경감·커버링을 반영해 적용 (방어력은 적용 단계에서 뺀다)
export async function finalizeDamage(
  ctx: { cid: string; uid: string; gmUid: string; isGM: boolean; characters: Character[] },
  w: DamageWindow,
) {
  const results = resolveDamage(w);
  const lines: string[] = [];
  for (const r of results) {
    if (r.covered) lines.push(`🛡 ${r.recipient.name}이(가) ${r.target.name}을(를) 커버링`);
    if (r.reduced) lines.push(`🛡 ${r.target.name} 경감 ${r.reduced}`);
  }
  if (lines.length)
    await sendMessage(ctx.cid, { uid: ctx.uid, speaker: { name: w.attacker.name, uid: ctx.uid }, kind: "system", text: lines.join(" · ") });
  // 같은 사람이 여러 번 받으면 (커버링) 따로따로 적용 — 방어력도 각각
  for (const r of results) {
    await sendEffect(ctx, [{ tid: r.recipient.tid, charId: r.recipient.charId, name: r.recipient.name }], {
      kind: "damage",
      amount: r.amount,
      dmgType: w.dmgType,
      from: w.attacker.name,
      source: w.source,
    });
  }
  await cancelDamage(ctx.cid);
}
