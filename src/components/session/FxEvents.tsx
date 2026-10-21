"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { fxDef, onLocalFx, subscribeFx, type FxEvent } from "@/lib/fxEvents";
import { splitTitle } from "@/lib/stage";
import { useSession } from "./SessionContext";
import "./fxevents.css";

const FRESH_MS = 6000; // 이보다 오래된 굴림·이벤트는 다시 틀지 않는다

// 화면 연출을 겹치지 않게 하나씩 튼다.
//   GM 이 보낸 것(fx/{cid}/event) + 내 화면이 알아서 트는 것(차례·라운드·크리티컬 …)
export function FxEvents() {
  const { cid, battle, messages, characters, user, isGM } = useSession();
  const [queue, setQueue] = useState<(FxEvent & { key: number })[]>([]);
  const seq = useRef(0);
  const push = (e: FxEvent) => setQueue((q) => [...q.slice(-4), { ...e, key: ++seq.current }]);

  // GM 이 보낸 연출 — 들어올 때 이미 있던 것은 건너뛴다
  const firstGm = useRef(true);
  useEffect(
    () =>
      subscribeFx(cid, (e) => {
        if (firstGm.current) {
          firstGm.current = false;
          return;
        }
        if (e) push({ ...e, at: Date.now() });
      }),
    [cid],
  );
  useEffect(() => onLocalFx(push), []);

  // ── 자동: 전투 개시·라운드·차례 ──
  const prevTurn = useRef<{ actor: string | null; round: number } | null>(null);
  const { actor, round } = battle.turn;
  useEffect(() => {
    if (!battle.loaded) return;
    const prev = prevTurn.current;
    prevTurn.current = { actor, round };
    if (!prev || !actor || actor === prev.actor) return;
    const t = battle.tokens[actor];
    if (!t) return;
    if (!prev.actor) push({ kind: "encounter", text: "ENCOUNTER", sub: "전투 개시", at: Date.now() });
    else if (round > prev.round) push({ kind: "round", text: `ROUND ${String(round).padStart(2, "0")}`, at: Date.now() });
    const c = t.charId ? characters.find((x) => x.id === t.charId) : undefined;
    const mine = !!t.ownerUid && t.ownerUid === user.uid;
    const enemy = t.side === "enemy";
    push({
      kind: "turn",
      text: mine ? "YOUR TURN" : enemy ? "ENEMY TURN" : `${splitTitle(t.name).name}`,
      sub: `${splitTitle(t.name).name}의 차례`,
      image: t.image ?? c?.portrait ?? c?.token,
      color: c?.color,
      mine,
      enemy,
      at: Date.now(),
    });
    // 토큰·캐릭터가 바뀔 때마다 다시 틀지 않게 차례·라운드만 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, round, battle.loaded]);

  // ── 자동: 크리티컬·펌블 (방금 굴린 판정만) ──
  const seenRoll = useRef<string | null>(null);
  const last = [...messages].reverse().find((m) => m.kind === "roll" && m.roll?.check);
  useEffect(() => {
    if (!last || last.id === seenRoll.current) return;
    const first = seenRoll.current === null;
    seenRoll.current = last.id;
    if (first || Date.now() - last.ts > FRESH_MS) return;
    if (last.secret && !isGM && last.uid !== user.uid) return;
    const face = last.speaker.avatar ?? last.speaker.image;
    if (last.roll!.check!.critical)
      push({ kind: "critical", text: "CRITICAL!", sub: `${splitTitle(last.speaker.name).name} · ${last.roll!.label ?? "판정"}`, image: face, color: last.speaker.color, at: Date.now() });
    else if (last.roll!.check!.fumble)
      push({ kind: "fumble", text: "FUMBLE…", sub: `${splitTitle(last.speaker.name).name} · ${last.roll!.label ?? "판정"}`, image: face, at: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.id]);

  const cur = queue[0];
  useEffect(() => {
    if (!cur) return;
    const t = window.setTimeout(() => setQueue((q) => q.slice(1)), fxDef(cur.kind).ms);
    return () => clearTimeout(t);
  }, [cur]);

  if (!cur) return null;
  return <FxView key={cur.key} e={cur} onSkip={() => setQueue((q) => q.slice(1))} />;
}

// 연출 하나 — 모양은 fxevents.css
export function FxView({ e, onSkip }: { e: FxEvent; onSkip?: () => void }) {
  const def = fxDef(e.kind);
  const style = { "--dur": `${def.ms}ms`, "--fx": e.color || undefined } as CSSProperties;
  const text = e.text ?? def.text;
  const sub = e.sub ?? def.sub;
  const letters = (s: string) =>
    [...s].map((ch, i) => (
      <span key={i} style={{ "--i": i } as CSSProperties}>
        {ch === " " ? " " : ch}
      </span>
    ));

  return (
    <div className={`fxe fxe--${e.kind} ${e.enemy ? "is-enemy" : ""} ${e.mine ? "is-mine" : ""}`} style={style} onClick={onSkip} aria-live="polite">
      {e.kind === "encounter" && (
        <>
          <div className="fxe-flash" />
          <div className="fxe-slash" />
          <div className="fxe-slash fxe-slash--2" />
          <div className="fxe-slash fxe-slash--3" />
          <div className="fxe-big">{text}</div>
          {sub && <div className="fxe-sub">{sub}</div>}
        </>
      )}
      {e.kind === "round" && (
        <>
          <div className="fxe-line fxe-line--l" />
          <div className="fxe-line fxe-line--r" />
          <div className="fxe-big">{text}</div>
        </>
      )}
      {e.kind === "turn" && (
        <div className="fxe-band">
          {e.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="fxe-face" src={e.image} alt="" />
          )}
          <div className="fxe-band-text">
            <div className="fxe-big">{text}</div>
            {sub && <div className="fxe-sub">{sub}</div>}
          </div>
        </div>
      )}
      {(e.kind === "critical" || e.kind === "allout") && (
        <>
          <div className="fxe-bars" />
          <div className="fxe-halftone" />
          {e.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="fxe-cut" src={e.image} alt="" />
          )}
          <div className="fxe-big">{letters(text)}</div>
          {sub && <div className="fxe-sub">{sub}</div>}
        </>
      )}
      {e.kind === "fumble" && (
        <>
          <div className="fxe-big">{letters(text)}</div>
          {sub && <div className="fxe-sub">{sub}</div>}
        </>
      )}
      {(e.kind === "victory" || e.kind === "levelup") && (
        <>
          <div className="fxe-rays" />
          <div className="fxe-sparkle" />
          <div className="fxe-big">{letters(text)}</div>
          {sub && <div className="fxe-sub">{sub}</div>}
        </>
      )}
      {e.kind === "defeat" && (
        <>
          <div className="fxe-crack" />
          <div className="fxe-big">{letters(text)}</div>
          {sub && <div className="fxe-sub">{sub}</div>}
        </>
      )}
      {e.kind === "warning" && (
        <>
          <div className="fxe-hazard fxe-hazard--top" />
          <div className="fxe-hazard fxe-hazard--bottom" />
          <div className="fxe-big">{text}</div>
          {sub && <div className="fxe-sub">{sub}</div>}
        </>
      )}
      {e.kind === "chapter" && (
        <>
          {sub && <div className="fxe-sub">{sub}</div>}
          <div className="fxe-rule" />
          <div className="fxe-big">{text}</div>
        </>
      )}
      {e.kind === "banner" && (
        <div className="fxe-band">
          <div className="fxe-band-text">
            <div className="fxe-big">{text}</div>
            {sub && <div className="fxe-sub">{sub}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
