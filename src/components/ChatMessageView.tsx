"use client";

import type { RollResult } from "@/lib/dice";
import type { ChatMessage } from "@/lib/types";

export function ChatMessageView({
  message: m,
  grouped,
  canDelete,
  onDelete,
}: {
  message: ChatMessage;
  grouped: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const isPrivate = !!m.to || !!m.secret;
  const time = new Date(m.ts).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={`group relative rounded px-2 ${grouped ? "py-0.5" : "mt-2 pt-1.5 pb-0.5"} ${
        isPrivate ? "border-l-2 border-fumble bg-fumble/10" : "hover:bg-panel/60"
      }`}
    >
      {!grouped && m.kind !== "ooc" && (
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-accent">{m.speaker.name}</span>
          {m.to && <span className="text-xs text-fumble">→ {m.to.map((t) => t.name).join(", ")} (귓속말)</span>}
          {m.secret && <span className="text-xs text-fumble">GM에게만</span>}
          <span className="text-[10px] text-muted">{time}</span>
        </div>
      )}
      <Body m={m} />
      {canDelete && (
        <button
          onClick={onDelete}
          className="absolute top-1 right-1 hidden rounded px-1 text-xs text-muted hover:text-hp group-hover:block"
          aria-label="메시지 지우기"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function Body({ m }: { m: ChatMessage }) {
  switch (m.kind) {
    case "action":
      return <p className="whitespace-pre-wrap text-[15px] text-muted italic">{m.text}</p>;
    case "ooc":
      return (
        <p className="text-xs text-muted">
          ({m.speaker.name}: {m.text})
        </p>
      );
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.text} alt="" className="mt-1 max-h-80 max-w-full rounded border border-line" loading="lazy" />
      );
    case "roll":
      return m.roll ? <RollView r={m.roll} /> : null;
    case "system":
      return <p className="text-center text-xs text-muted">{m.text}</p>;
    default:
      return <p className="text-[15px] whitespace-pre-wrap">{m.text}</p>;
  }
}

function RollView({ r }: { r: RollResult }) {
  const crit = r.check?.critical;
  const fumble = r.check?.fumble;
  return (
    <div
      className={`mt-1 inline-block min-w-56 rounded-md border px-3 py-2 ${
        crit ? "border-crit bg-crit/10" : fumble ? "border-fumble bg-fumble/10" : "border-line bg-panel"
      }`}
    >
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
              className={`grid h-6 min-w-6 place-items-center rounded border px-1 font-mono text-xs ${
                g.sides === 6 && v === 6 && r.check
                  ? "border-crit text-crit"
                  : g.sides === 6 && v === 1 && r.check
                    ? "border-fumble text-fumble"
                    : "border-line"
              }`}
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
        <span className={`text-xl font-bold ${crit ? "text-crit" : fumble ? "text-fumble" : ""}`}>{r.total}</span>
        {crit && <span className="ml-1 rounded bg-crit px-1.5 text-xs font-bold text-accent-ink">크리티컬!</span>}
        {fumble && <span className="ml-1 rounded bg-fumble px-1.5 text-xs font-bold">펌블</span>}
      </div>
    </div>
  );
}
