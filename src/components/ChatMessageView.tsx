"use client";

import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import type { RollResult } from "@/lib/dice";
import type { InlineResult, Segment } from "@/lib/inline";
import { splitTitle } from "@/lib/stage";
import { parseStyledText } from "@/lib/styledText";
import type { ChatCard, ChatMessage } from "@/lib/types";

// 채팅이 하나 올 때마다 300개를 다시 그리지 않게, 내용이 같은 메시지는 건너뛴다
export const ChatMessageView = memo(function ChatMessageView({
  message: m,
  grouped,
  canDelete,
  onDelete,
  onShowOnStage,
}: {
  message: ChatMessage;
  grouped: boolean;
  canDelete: boolean;
  onDelete: (id: string) => void;
  onShowOnStage?: (url: string) => void;
}) {
  const isPrivate = !!m.to || !!m.secret;
  const time = new Date(m.ts).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const { title, name } = splitTitle(m.speaker.name);
  const face = m.speaker.avatar ?? m.speaker.image;
  const showHead = !grouped && m.kind !== "ooc" && m.kind !== "system";

  return (
    <div
      className={`group relative flex gap-2 rounded px-2 ${grouped ? "py-0.5" : "mt-2 pt-1.5 pb-0.5"} ${
        isPrivate ? "border-l-2 border-fumble bg-fumble/10" : "hover:bg-white/[.03]"
      }`}
    >
      <div className="w-8 shrink-0">
        {showHead &&
          (face ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={face} alt="" className="h-8 w-8 rounded-full border border-line object-cover object-top" />
          ) : (
            <div className="font-display grid h-8 w-8 place-items-center rounded-full border border-line bg-panel-2 text-xs text-accent">
              {m.speaker.narrator ? "❖" : name.slice(0, 1)}
            </div>
          ))}
      </div>
      <div className="min-w-0 flex-1">
        {showHead && (
          <div className="flex flex-wrap items-baseline gap-x-2">
            {title && <span className="text-[11px] text-muted">{title}</span>}
            <span className="font-display font-bold" style={{ color: m.speaker.color ?? "var(--accent)" }}>
              {m.speaker.narrator ? "GM" : name}
            </span>
            {m.to && <span className="text-xs text-fumble">→ {m.to.map((t) => t.name).join(", ")} (귓속말)</span>}
            {m.secret && <span className="text-xs text-fumble">GM에게만</span>}
            <span className="text-[10px] text-muted">{time}</span>
          </div>
        )}
        <Body m={m} />
        {m.kind === "image" && onShowOnStage && (
          <button className="btn mt-1 py-0.5 text-xs" onClick={() => onShowOnStage(m.text)}>
            <span>무대에 띄우기</span>
          </button>
        )}
      </div>
      {canDelete && (
        <button
          onClick={() => onDelete(m.id)}
          className="absolute top-1 right-1 hidden rounded px-1 text-xs text-muted group-hover:block hover:text-hp"
          aria-label="메시지 지우기"
        >
          ✕
        </button>
      )}
    </div>
  );
});

function Body({ m }: { m: ChatMessage }) {
  switch (m.kind) {
    case "action":
      return <p className="text-[14px] whitespace-pre-wrap text-muted italic">{m.text}</p>;
    case "ooc":
      return (
        <p className="text-xs text-muted">
          ({splitTitle(m.speaker.name).name}: {m.text})
        </p>
      );
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.text} alt="" className="mt-1 max-h-60 max-w-full rounded border border-line" loading="lazy" />
      );
    case "roll":
      return m.roll ? <RollView r={m.roll} color={m.diceColor} /> : null;
    case "card":
      return m.card ? <CardView card={m.card} color={m.diceColor} /> : null;
    case "system":
      return <p className="text-center text-xs text-muted">{m.text}</p>;
    default:
      return <p className={`text-[14px] whitespace-pre-wrap ${m.speaker.narrator ? "font-display text-text/90" : ""}`}>{m.text}</p>;
  }
}

// 주사위 굴림 카드 — 색은 테마(globals.css 의 .roll·.die), 굴린 사람이 고른 색이 있으면 그 색으로
export function RollView({ r, color }: { r: RollResult; color?: string }) {
  const crit = r.check?.critical;
  const fumble = r.check?.fumble;
  return (
    <div className={`roll ${crit ? "roll--crit" : fumble ? "roll--fumble" : ""}`} style={color ? ({ "--dc": color } as CSSProperties) : undefined}>
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>{r.label || (r.check ? "판정" : "굴림")}</span>
        <span className="font-mono">{r.expr}</span>
        {r.fateUsed ? <span className="text-fate">페이트 {r.fateUsed}</span> : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {r.groups.map((g, gi) =>
          g.results.map((v, i) => (
            <span
              key={`${gi}-${i}`}
              className={`die ${g.sides === 6 && v === 6 && r.check ? "die--six" : g.sides === 6 && v === 1 && r.check ? "die--one" : ""}`}
              title={g.sides === 6 ? "d6" : `d${g.sides}`}
            >
              {g.sign < 0 ? "-" : ""}
              {v}
            </span>
          )),
        )}
        {r.flat !== 0 && (
          <span className="font-mono text-xs text-muted">
            {r.flat > 0 ? "+" : ""}
            {r.flat}
          </span>
        )}
        <span className="mx-1 text-muted">=</span>
        <span className="roll-total">{r.total}</span>
        {crit && <span className="ml-1 rounded bg-crit px-1.5 text-xs font-bold text-black">크리티컬!</span>}
        {fumble && <span className="ml-1 rounded bg-fumble px-1.5 text-xs font-bold text-white">펌블</span>}
      </div>
    </div>
  );
}

// 스킬·아이템 카드 — Roll20 스킬 템플릿처럼
export function CardView({ card, color }: { card: ChatCard; color?: string }) {
  return (
    <div className="card-roll mt-1 max-w-md overflow-hidden rounded-md border border-line bg-panel" style={color ? ({ "--dc": color } as CSSProperties) : undefined}>
      <div className="card-roll__head border-b border-line px-3 py-1.5">
        <div className="text-[10px] tracking-widest text-muted">{card.tag === "skill" ? "SKILL" : card.tag === "item" ? "ITEM" : "ATTACK"}</div>
        <SkillName name={card.title} color={card.color} glow={card.glow} className="text-[15px]" />
      </div>
      {card.meta.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-line/60 px-3 py-1.5">
          {card.meta.map((m, i) => (
            <span key={i} className="rounded border border-line bg-panel-2 px-1.5 text-[11px] text-muted">
              {m}
            </span>
          ))}
        </div>
      )}
      {card.body.length > 0 && <RichText segments={card.body} className="px-3 py-2 text-[13px] leading-relaxed" />}
      {card.extra && (
        <div className="border-t border-line/60 px-3 py-1.5 text-xs">
          <span className="mr-2 text-muted">{card.extra.label}</span>
          <RichText segments={[card.extra.result]} className="inline" />
        </div>
      )}
      {card.note && <div className="border-t border-line/60 bg-accent/10 px-3 py-1 text-xs text-accent">{card.note}</div>}
    </div>
  );
}

// 시트에서 꾸민 스킬 이름 (글자색 + 빛 번짐)
export function SkillName({ name, color, glow, className = "" }: { name: string; color?: string; glow?: string; className?: string }) {
  return (
    <span
      className={`font-display font-bold ${className}`}
      style={{
        color: color ?? "var(--text)",
        textShadow: glow ? `0 0 2px ${glow}, 0 0 3px ${glow}, 0 0 10px ${glow}` : undefined,
      }}
    >
      {name}
    </span>
  );
}

// **굵게**, 줄바꿈, 굴린 값(강조)을 그린다
export function RichText({ segments, className = "" }: { segments: Segment[]; className?: string }) {
  return (
    <div className={`whitespace-pre-wrap ${className}`}>
      {segments.map((s, i) => (typeof s === "string" ? <StyledText key={i} text={s} /> : <RollChip key={i} r={s} />))}
    </div>
  );
}

// 스킬 설명 글씨 — Roll20 꾸밈([글자](#" style="…")), **굵게**, *기울임*
function StyledText({ text }: { text: string }) {
  return (
    <>
      {parseStyledText(text).map((p, i) => {
        if (p.kind === "bold")
          return (
            <strong key={i} className="text-text">
              {p.text}
            </strong>
          );
        if (p.kind === "italic")
          return (
            <em key={i} className="text-muted">
              {p.text}
            </em>
          );
        if (p.kind === "styled") {
          const Tag = p.block ? "div" : "span";
          return (
            <Tag key={i} style={p.style as CSSProperties}>
              {p.text}
            </Tag>
          );
        }
        return <span key={i}>{p.text}</span>;
      })}
    </>
  );
}

// 카드 속 굴림 결과 — 누르면 실제로 굴러간 주사위가 펼쳐지고, 다른 곳을 누르면 닫힌다
function RollChip({ r }: { r: InlineResult }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const dice = (r.dice ?? []).flatMap((d) => (d.results ?? []).map((v) => ({ v, sides: d.sides })));
  const diceSum = dice.reduce((a, d) => a + d.v, 0);
  const rest = r.total - diceSum;

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <span ref={box} className="relative inline-block">
      <button
        type="button"
        className="roll-chip mx-0.5 inline-flex items-baseline gap-1 rounded border px-1.5 font-bold"
        onClick={() => setOpen((o) => !o)}
        title="눌러서 주사위 보기"
        aria-expanded={open}
      >
        {r.total}
        <span className="text-[10px] font-normal text-muted">{r.expr}</span>
      </button>
      {open && (
        <span className="roll-pop" role="dialog" aria-label={`${r.expr} 주사위`}>
          <span className="mb-1 block text-[11px] text-muted">{r.expr}</span>
          {dice.length ? (
            <span className="flex max-w-64 flex-wrap gap-1">
              {dice.map((d, i) => (
                <span key={i} className="die" title={`d${d.sides}`}>
                  {d.v}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-xs text-muted">주사위 없이 계산만 했어요.</span>
          )}
          <span className="mt-1.5 flex items-baseline gap-1 text-xs text-muted">
            {dice.length > 0 && <span>주사위 {diceSum}</span>}
            {rest !== 0 && (
              <span>
                {rest > 0 ? "+" : ""}
                {rest}
              </span>
            )}
            <span>=</span>
            <b className="roll-total text-base">{r.total}</b>
          </span>
        </span>
      )}
    </span>
  );
}
