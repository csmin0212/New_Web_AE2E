"use client";

import { doc, runTransaction as runFsTransaction } from "firebase/firestore";
import { onValue, push, ref, runTransaction, set, update } from "firebase/database";
import { derive } from "./ar/derive";
import {
  cleanup,
  clearAt,
  stackStatus,
  statusDefs,
  type BsClear,
  CONDITION_LABEL,
  DAMAGE_LABEL,
  EFFECT_LABEL,
  computeEffect,
  conditionOf,
  type DamageType,
  type EffectKind,
  type EffectResult,
  type StatusMap,
  type StatusPick,
  type TurnState,
} from "./battleRules";
import { sendMessage } from "./chat";
import type { Battle } from "./scene";
import { DEFAULT_TERRAINS, terrainEffectAt } from "./terrain";
import { publicName } from "./reveal";
import { db, rtdb } from "./firebase";
import type { Character } from "./types";

// 전투 차례와 대미지 적용 (Realtime DB · Firestore)
//   battle/{cid}/turn             { actor, round, acted } — GM 또는 지금 차례인 토큰 주인이 넘긴다
//   battle/{cid}/effects/{id}     플레이어가 직접 못 고치는 대상(에너미·남의 캐릭터)에게 보내는 요청.
//                                 GM 화면이 받아서 적용하고 지운다 → 에너미 HP 는 끝까지 GM 만 안다

// 새 전투를 시작하면 「클린업 한 라운드」 기록도 비운다 (안 비우면 지난 전투의 라운드 번호 때문에 클린업을 건너뛴다)
export function beginBattle(cid: string, t: TurnState) {
  return update(ref(rtdb, `battle/${cid}`), JSON.parse(JSON.stringify({ "meta/cleanedRound": null, turn: { actor: t.actor, round: t.round, acted: t.acted, phase: t.phase } })));
}

export function setTurn(cid: string, t: TurnState) {
  return set(ref(rtdb, `battle/${cid}/turn`), JSON.parse(JSON.stringify({ actor: t.actor, round: t.round, acted: t.acted, phase: t.phase })));
}

export type EffectTarget = { tid?: string; charId: string; name: string };
export type { StatusPick };

export type EffectRequest = {
  uid: string;
  from: string; // 쓴 캐릭터 이름 (기록용)
  source?: string; // 스킬·공격 이름
  kind: EffectKind | "status"; // status = BS 부여 (statuses 에 여러 개)
  statusId?: string; // (예전 요청) 하나만
  statusLabel?: string;
  statuses?: StatusPick[];
  amount: number;
  dmgType?: DamageType;
  targets: EffectTarget[];
  at: number;
};

export function subscribeEffects(cid: string, cb: (list: [string, EffectRequest][]) => void) {
  return onValue(ref(rtdb, `battle/${cid}/effects`), (snap) => {
    const v = (snap.val() ?? {}) as Record<string, EffectRequest>;
    cb(Object.entries(v).sort((a, b) => a[1].at - b[1].at));
  });
}

// 요청 하나를 내가 처리하겠다고 가져온다 (GM 창이 여러 개 열려 있어도 한 번만 적용되게)
export async function claimEffect(cid: string, id: string): Promise<boolean> {
  const r = await runTransaction(ref(rtdb, `battle/${cid}/effects/${id}`), (cur) => (cur == null ? undefined : null), { applyLocally: false });
  return r.committed;
}

// 캐릭터 하나에 효과를 적용한다 (읽고 쓰는 사이에 다른 대미지가 끼어도 안전하게 트랜잭션)
export async function applyToCharacter(
  cid: string,
  charId: string,
  e: { kind: EffectKind; amount: number; dmgType?: DamageType },
): Promise<{ result: EffectResult; character: Character }> {
  const dref = doc(db, "campaigns", cid, "characters", charId);
  return runFsTransaction(db, async (tx) => {
    const snap = await tx.get(dref);
    if (!snap.exists()) throw new Error("캐릭터를 찾지 못했어요.");
    const c = { id: snap.id, ...(snap.data() as Omit<Character, "id">) };
    const d = c.ar ? derive(c.ar) : { pdef: 0, mdef: 0 };
    const result = computeEffect({ hp: c.hp, mp: c.mp }, d, e);
    tx.update(dref, { [result.key]: { cur: result.after, max: result.max } });
    return { result, character: c };
  });
}

function describe(target: Character, r: EffectResult, e: { kind: EffectKind; amount: number; dmgType?: DamageType }, hidden: boolean): string {
  const name = publicName(target);
  if (e.kind === "damage") {
    const type = DAMAGE_LABEL[e.dmgType ?? "physical"];
    if (hidden) {
      const cond = conditionOf({ cur: r.after, max: r.max });
      return `⚔ ${name}에게 ${type} 대미지 ${r.dealt}${cond === "down" ? ` — ${CONDITION_LABEL.down}!` : ""}`;
    }
    const cut = r.reduced ? ` (${e.amount} − ${e.dmgType === "magic" ? "마방" : "물방"} ${r.reduced})` : "";
    return `⚔ ${name} ${type} 대미지 ${r.dealt}${cut} · HP ${r.before} → ${r.after}${r.after <= 0 ? " 전투불능!" : ""}`;
  }
  const key = r.key.toUpperCase();
  if (hidden) return `✚ ${name} ${EFFECT_LABEL[e.kind]} ${r.dealt}`;
  return `✚ ${name} ${EFFECT_LABEL[e.kind]} ${r.dealt} · ${key} ${r.before} → ${r.after}`;
}

// 적용하고 채팅에 결과를 남긴다. 에너미는 모두에게 깎인 양만, GM 에게는 남은 HP 까지
export async function applyAndReport(
  ctx: { cid: string; uid: string; gmUid: string },
  target: EffectTarget,
  e: { kind: EffectKind; amount: number; dmgType?: DamageType; from: string; source?: string },
) {
  const { result, character } = await applyToCharacter(ctx.cid, target.charId, e);
  const hidden = character.kind === "enemy";
  const speaker = { name: e.from, uid: ctx.uid };
  const head = e.source ? `【${e.source}】 ` : "";
  await sendMessage(ctx.cid, { uid: ctx.uid, speaker, kind: "system", text: head + describe(character, result, e, hidden) });
  if (hidden) {
    await sendMessage(
      ctx.cid,
      { uid: ctx.uid, speaker, kind: "system", text: `(GM) ${character.sheet.name} HP ${result.before} → ${result.after}/${result.max}` },
      [ctx.gmUid],
    );
  }
  return { result, character };
}

// 대상마다: 내가 고칠 수 있으면 바로, 아니면 GM 에게 요청
export async function sendEffect(
  ctx: { cid: string; uid: string; gmUid: string; isGM: boolean; characters: Character[] },
  targets: EffectTarget[],
  e: { kind: EffectKind; amount: number; dmgType?: DamageType; from: string; source?: string },
): Promise<{ direct: number; queued: number }> {
  const queued: EffectTarget[] = [];
  let direct = 0;
  for (const t of targets) {
    const c = ctx.characters.find((x) => x.id === t.charId);
    if (ctx.isGM || (c && c.ownerUid === ctx.uid)) {
      await applyAndReport(ctx, t, e);
      direct++;
    } else queued.push(t);
  }
  if (queued.length) {
    const req: EffectRequest = { uid: ctx.uid, from: e.from, source: e.source, kind: e.kind, amount: e.amount, dmgType: e.dmgType, targets: queued, at: Date.now() };
    await push(ref(rtdb, `battle/${ctx.cid}/effects`), JSON.parse(JSON.stringify(req)));
  }
  return { direct, queued: queued.length };
}

// GM 화면: 들어온 요청을 처리한다
export async function processEffect(ctx: { cid: string; uid: string; gmUid: string }, id: string, req: EffectRequest) {
  if (!(await claimEffect(ctx.cid, id))) return;
  if (req.kind === "status") {
    const list = req.statuses ?? (req.statusId ? [{ id: req.statusId, label: req.statusLabel ?? req.statusId, strength: req.amount, stack: req.amount > 1 }] : []);
    for (const t of req.targets ?? []) if (t.tid && list.length) await giveStatus(ctx, t, list, req.from, req.source);
    return;
  }
  for (const t of req.targets ?? []) {
    try {
      await applyAndReport(ctx, t, { kind: req.kind, amount: req.amount, dmgType: req.dmgType, from: req.from, source: req.source });
    } catch (e) {
      await sendMessage(
        ctx.cid,
        { uid: ctx.uid, speaker: { name: req.from, uid: ctx.uid }, kind: "system", text: `(GM) ${t.name}에게 적용하지 못했어요: ${e instanceof Error ? e.message : e}` },
        [ctx.gmUid],
      );
    }
  }
}

// BS 걸기 — 토큰에 바로 쓰고 채팅에 남긴다. 이미 걸려 있으면 강도는 높은 쪽 (트랜잭션)
async function giveStatus(ctx: { cid: string; uid: string }, t: EffectTarget, list: StatusPick[], from: string, source?: string) {
  const got: string[] = [];
  for (const st of list) {
    let after = 0;
    await runTransaction(ref(rtdb, `battle/${ctx.cid}/tokens/${t.tid}/status/${st.id}`), (cur: number | null) => {
      after = stackStatus(cur ?? undefined, st.strength, st.stack);
      return after;
    });
    got.push(`${st.label}${st.stack ? ` ${after}` : ""}`);
  }
  await sendMessage(ctx.cid, {
    uid: ctx.uid,
    speaker: { name: from, uid: ctx.uid },
    kind: "system",
    text: `${source ? `【${source}】 ` : ""}☠ ${t.name}에게 ${got.join(" · ")}`,
  });
}

// 대상마다: 내가 고칠 수 있는 토큰(GM·주인)이면 바로, 아니면 GM 에게 요청
export async function sendStatus(
  ctx: { cid: string; uid: string; isGM: boolean; tokens: Record<string, { ownerUid?: string }> },
  targets: EffectTarget[],
  list: StatusPick[],
  from: string,
  source?: string,
): Promise<{ direct: number; queued: number }> {
  const queued: EffectTarget[] = [];
  let direct = 0;
  if (!list.length) return { direct, queued: 0 };
  for (const t of targets) {
    if (!t.tid) continue;
    if (ctx.isGM || ctx.tokens[t.tid]?.ownerUid === ctx.uid) {
      await giveStatus(ctx, t, list, from, source);
      direct++;
    } else queued.push(t);
  }
  if (queued.length) {
    const req: EffectRequest = { uid: ctx.uid, from, source, kind: "status", statuses: list, amount: 0, targets: queued, at: Date.now() };
    await push(ref(rtdb, `battle/${ctx.cid}/effects`), JSON.parse(JSON.stringify(req)));
  }
  return { direct, queued: queued.length };
}

// 에너미 토큰에 숫자 없는 상태(부상·전투불능)를 붙인다 — GM 화면에서만 돈다
export function syncConditions(cid: string, tokens: Record<string, { charId?: string; cond?: string }>, characters: Character[]) {
  const patch: Record<string, string | null> = {};
  for (const [tid, t] of Object.entries(tokens)) {
    const c = t.charId ? characters.find((x) => x.id === t.charId) : undefined;
    if (!c) continue;
    const cond = c.kind === "enemy" ? conditionOf(c.hp) : null;
    if ((t.cond ?? null) !== cond) patch[`battle/${cid}/tokens/${tid}/cond`] = cond;
  }
  if (Object.keys(patch).length) return update(ref(rtdb), patch);
}

// 클린업 프로세스 (GM 화면, 라운드마다 한 번만)
//   맵 기믹, 저절로 풀리는 BS 해제, 독은 강도×5 HP 로스 (방어 무시)
export async function runCleanup(
  ctx: { cid: string; uid: string; gmUid: string },
  round: number,
  b: Pick<Battle, "tokens" | "pos" | "terrain" | "terrainDefs" | "statusDefs">,
) {
  const sDefs = statusDefs(b.statusDefs);
  const tokens = b.tokens;
  const defs = Object.keys(b.terrainDefs).length ? b.terrainDefs : DEFAULT_TERRAINS;
  const claim = await runTransaction(ref(rtdb, `battle/${ctx.cid}/meta/cleanedRound`), (cur) => ((cur ?? 0) >= round ? undefined : round));
  if (!claim.committed) return;
  const lines: string[] = [];
  // 맵 기믹: 피해·회복 지형 위에 선 유닛
  for (const [tid, t] of Object.entries(tokens)) {
    const pos = b.pos[tid];
    if (!pos || !t.charId) continue;
    const fx = terrainEffectAt(pos, t.size ?? 1, b.terrain, defs);
    if (fx)
      await applyAndReport(ctx, { tid, charId: t.charId, name: t.name }, {
        kind: fx.kind === "damage" ? "damage" : "heal",
        amount: fx.amount,
        dmgType: fx.kind === "damage" ? "pierce" : undefined,
        from: fx.name,
        source: "지형",
      });
  }
  for (const [tid, t] of Object.entries(tokens)) {
    if (!t.status) continue;
    const { next, poison } = cleanup(t.status, sDefs);
    const cleared = Object.keys(t.status).filter((k) => !(k in next));
    if (cleared.length) {
      await set(ref(rtdb, `battle/${ctx.cid}/tokens/${tid}/status`), Object.keys(next).length ? next : null);
      lines.push(`${t.name}: ${cleared.map((k) => sDefs.find((b) => b.id === k)?.label ?? k).join("·")} 해제`);
    }
    if (poison > 0 && t.charId) {
      await applyAndReport(ctx, { tid, charId: t.charId, name: t.name }, { kind: "damage", amount: poison, dmgType: "pierce", from: "독", source: "클린업" });
    }
  }
  await sendMessage(ctx.cid, {
    uid: ctx.uid,
    speaker: { name: "클린업", uid: ctx.uid },
    kind: "system",
    text: `🌙 라운드 ${round} 클린업${lines.length ? " — " + lines.join(" / ") : ""}`,
  });
}

const WHEN_TEXT: Record<Exclude<BsClear, "cleanup">, string> = {
  "setup-end": "셋업 끝",
  "own-turn": "차례 시작",
  "turn-end": "메인 프로세스 끝",
  "battle-end": "전투 종료",
};

// 정해진 때가 온 유닛들의 BS 를 푼다 (tids 가 없으면 전원) — GM 화면
export async function clearStatusAt(
  ctx: { cid: string; uid: string },
  b: Pick<Battle, "tokens" | "statusDefs">,
  when: Exclude<BsClear, "cleanup">,
  tids?: string[],
) {
  const sDefs = statusDefs(b.statusDefs);
  const lines: string[] = [];
  for (const tid of tids ?? Object.keys(b.tokens)) {
    const t = b.tokens[tid];
    if (!t?.status) continue;
    const { next, cleared } = clearAt(t.status, when, sDefs);
    if (!cleared.length) continue;
    await set(ref(rtdb, `battle/${ctx.cid}/tokens/${tid}/status`), Object.keys(next).length ? next : null);
    lines.push(`${t.name}: ${cleared.map((k) => sDefs.find((d) => d.id === k)?.label ?? k).join("·")}`);
  }
  if (lines.length)
    await sendMessage(ctx.cid, { uid: ctx.uid, speaker: { name: "BS", uid: ctx.uid }, kind: "system", text: `✦ ${WHEN_TEXT[when]} — ${lines.join(" / ")} 해제` });
}

// 직접 풀기 (마이너·무브 액션, 회복 스킬 …) — GM 또는 토큰 주인
export async function removeStatus(ctx: { cid: string; uid: string }, tid: string, name: string, status: StatusMap, id: string, label: string, how?: string) {
  const next = { ...status };
  delete next[id];
  await set(ref(rtdb, `battle/${ctx.cid}/tokens/${tid}/status`), Object.keys(next).length ? next : null);
  await sendMessage(ctx.cid, { uid: ctx.uid, speaker: { name, uid: ctx.uid }, kind: "system", text: `✦ ${name}: ${label} 해제${how ? ` (${how})` : ""}` });
}
