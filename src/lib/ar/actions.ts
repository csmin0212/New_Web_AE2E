"use client";

import { parseCost } from "../battleRules";
import { faceOf, stageImageOf } from "../characterArt";
import { imageVisible, isSkillRevealed, publicName, REVEAL_DEFAULT } from "../reveal";
import { setGauge, updateAr, updateArWithSummary } from "../campaigns";
import { sendMessage } from "../chat";
import { readDiceColor } from "../diceColor";
import { roll, type RollResult } from "../dice";
import { evalExpr, rollInline } from "../inline";
import type { Character, ChatCard, Speaker } from "../types";
import { findRecovery } from "./recovery";
import type { ArItem, ArSheet, ArSkill, DiceMod } from "./types";

// 시트 버튼 → 채팅 카드·굴림 + MP·수량·HP 반영

export type ActCtx = { cid: string; uid: string; isGM: boolean; gmUid: string };

export function speakerOf(c: Character, uid: string): Speaker {
  const img = imageVisible(c);
  return { name: publicName(c), uid, charId: c.id, image: img ? stageImageOf(c) : undefined, avatar: img ? faceOf(c) : undefined, color: c.color };
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
): Promise<RollResult> {
  const fate = opts.fate ?? 0;
  if (fate > c.fate.cur) throw new Error("페이트가 모자라요.");
  const result = roll(`${dm.dice}D${dm.mod >= 0 ? "+" : ""}${dm.mod}`, { check: opts.check ?? true, fate, label });
  if (fate > 0) await setGauge(ctx.cid, c.id, "fate", { ...c.fate, cur: c.fate.cur - fate });
  await sendMessage(
    ctx.cid,
    { uid: ctx.uid, speaker: speakerOf(c, ctx.uid), kind: "roll", text: "", roll: result, secret: opts.secret || undefined, diceColor: readDiceColor() },
    opts.secret ? [ctx.gmUid] : undefined,
  );
  return result;
}

// 스킬 사용 — 카드를 남기고 코스트(MP·HP)를 깎는다. 굴린 결과가 든 카드를 돌려준다 (전투에서 대미지로 이어 쓰기)
export async function applySkill(ctx: ActCtx, c: Character, skill: ArSkill): Promise<ChatCard> {
  const cost = parseCost(skill.cost);
  if (cost && cost.mp > c.mp.cur) throw new Error(`MP가 모자라요. (필요 ${cost.mp}, 남은 ${c.mp.cur})`);
  if (cost && cost.hp > 0 && cost.hp >= c.hp.cur) throw new Error(`HP가 모자라요. (필요 ${cost.hp}, 남은 ${c.hp.cur})`);
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
    note:
      [cost?.mp && `MP ${cost.mp} 소모 (${c.mp.cur} → ${c.mp.cur - cost.mp})`, cost?.hp && `HP ${cost.hp} 소모 (${c.hp.cur} → ${c.hp.cur - cost.hp})`]
        .filter(Boolean)
        .join(" · ") || undefined,
  };
  if (cost?.mp) await setGauge(ctx.cid, c.id, "mp", { ...c.mp, cur: c.mp.cur - cost.mp });
  if (cost?.hp) await setGauge(ctx.cid, c.id, "hp", { ...c.hp, cur: c.hp.cur - cost.hp });
  const cfg = c.reveal ?? REVEAL_DEFAULT;
  if (c.hidden && !isSkillRevealed(cfg, skill.id)) {
    // 공개 안 한 스킬: 모두에게는 이름만, GM 에게는 전체 카드
    const shown: ChatCard = { tag: "skill", title: skill.name, color: skill.color, glow: skill.glow, meta: skill.timing ? [`【${skill.timing}】`] : [], body: ["(효과는 비공개)"] };
    await sendMessage(ctx.cid, { uid: ctx.uid, speaker: speakerOf(c, ctx.uid), kind: "card", text: "", card: shown, diceColor: readDiceColor() });
    await sendMessage(ctx.cid, { uid: ctx.uid, speaker: speakerOf(c, ctx.uid), kind: "card", text: "", card: { ...card, note: `(GM만) ${card.note ?? ""}`.trim() }, secret: true }, [ctx.gmUid]);
    return card;
  }
  // 공개 스킬이라도 MP 를 안 열었으면 소모 기록은 가린다
  const pub = c.hidden && !cfg.mp ? { ...card, note: undefined } : card;
  await sendMessage(ctx.cid, { uid: ctx.uid, speaker: speakerOf(c, ctx.uid), kind: "card", text: "", card: pub, diceColor: readDiceColor() });
  return card;
}

// 카드 속에서 굴린 값들 (대미지·회복량 후보)
export function rolledTotals(card: ChatCard): { label: string; total: number }[] {
  const out: { label: string; total: number }[] = [];
  for (const seg of card.body) if (typeof seg !== "string") out.push({ label: seg.expr, total: seg.total });
  if (card.extra && typeof card.extra.result !== "string") out.push({ label: card.extra.result.expr, total: card.extra.result.total });
  return out;
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
  await sendMessage(ctx.cid, { uid: ctx.uid, speaker: speakerOf(c, ctx.uid), kind: "card", text: "", card, diceColor: readDiceColor() });
}

export { saveAr };
