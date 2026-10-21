"use client";

import { setGauge, updateAr, updateArWithSummary } from "../campaigns";
import { sendMessage } from "../chat";
import { roll } from "../dice";
import { evalExpr, rollInline } from "../inline";
import type { Character, ChatCard, Speaker } from "../types";
import { findRecovery } from "./recovery";
import type { ArItem, ArSheet, ArSkill, DiceMod } from "./types";

// 시트 버튼 → 채팅 카드·굴림 + MP·수량·HP 반영

export type ActCtx = { cid: string; uid: string; isGM: boolean; gmUid: string };

export function speakerOf(c: Character, uid: string): Speaker {
  return { name: c.sheet.name, uid, charId: c.id, image: c.standing, avatar: c.portrait, color: c.color };
}

async function saveAr(ctx: ActCtx, c: Character, ar: ArSheet) {
  if (ctx.isGM) await updateArWithSummary(ctx.cid, c, ar);
  else await updateAr(ctx.cid, c, ar);
}

export async function rollArCheck(
  ctx: ActCtx,
  c: Character,
  label: string,
  dm: DiceMod,
  opts: { fate?: number; secret?: boolean; check?: boolean } = {},
) {
  const fate = opts.fate ?? 0;
  if (fate > c.fate.cur) throw new Error("페이트가 모자라요.");
  const result = roll(`${dm.dice}D${dm.mod >= 0 ? "+" : ""}${dm.mod}`, { check: opts.check ?? true, fate, label });
  if (fate > 0) await setGauge(ctx.cid, c.id, "fate", { ...c.fate, cur: c.fate.cur - fate });
  await sendMessage(
    ctx.cid,
    { uid: ctx.uid, speaker: speakerOf(c, ctx.uid), kind: "roll", text: "", roll: result, secret: opts.secret || undefined },
    opts.secret ? [ctx.gmUid] : undefined,
  );
}

function numericCost(cost: string): number | null {
  const m = cost.trim().match(/^(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

export async function applySkill(ctx: ActCtx, c: Character, skill: ArSkill) {
  const cost = numericCost(skill.cost);
  if (cost != null && cost > c.mp.cur) throw new Error(`MP가 모자라요. (필요 ${cost}, 남은 ${c.mp.cur})`);
  let extra: ChatCard["extra"];
  if (skill.roll) {
    try {
      extra = { label: "굴림", result: evalExpr(skill.roll) };
    } catch {
      extra = undefined;
    }
  }
  const card: ChatCard = {
    tag: "skill",
    title: skill.name,
    color: skill.color,
    glow: skill.glow,
    meta: [skill.timing && `【${skill.timing}】`, `SL ${skill.sl}${skill.slMax ? `/${skill.slMax}` : ""}`, skill.target, skill.range, skill.cost && `코스트 ${skill.cost}`].filter(
      (x): x is string => !!x && x !== "-",
    ),
    body: rollInline(skill.effect),
    extra,
    note: cost ? `MP ${cost} 소모 (${c.mp.cur} → ${c.mp.cur - cost})` : undefined,
  };
  if (cost) await setGauge(ctx.cid, c.id, "mp", { ...c.mp, cur: c.mp.cur - cost });
  await sendMessage(ctx.cid, { uid: ctx.uid, speaker: speakerOf(c, ctx.uid), kind: "card", text: "", card });
}

export async function applyItem(ctx: ActCtx, c: Character, item: ArItem) {
  if (!c.ar) return;
  if (item.qty <= 0) throw new Error(`${item.name}이(가) 남아 있지 않아요.`);
  const body = rollInline(item.desc);
  const rec = findRecovery(body);
  const notes = [`남은 수량 ${item.qty - 1}`];
  if (rec) {
    const g = c[rec.key];
    const next = Math.min(g.max, g.cur + rec.amount);
    notes.unshift(`${rec.key.toUpperCase()} +${next - g.cur} (${g.cur} → ${next})`);
    await setGauge(ctx.cid, c.id, rec.key, { ...g, cur: next });
  }
  const ar: ArSheet = { ...c.ar, items: c.ar.items.map((x) => (x.id === item.id ? { ...x, qty: x.qty - 1 } : x)) };
  await saveAr(ctx, c, ar);
  const card: ChatCard = { tag: "item", title: item.name, meta: ["아이템 사용"], body, note: notes.join(" · ") };
  await sendMessage(ctx.cid, { uid: ctx.uid, speaker: speakerOf(c, ctx.uid), kind: "card", text: "", card });
}

export { saveAr };
