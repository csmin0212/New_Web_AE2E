"use client";

import { JOURNAL_TYPES, parseBody, splitBold, type JournalEntry } from "@/lib/journal";

// 핸드아웃·저널 읽기 화면 (저널 페이지와 보여주기 팝업이 같이 쓴다)
export function JournalView({ entry }: { entry: JournalEntry }) {
  const type = JOURNAL_TYPES.find((t) => t.id === entry.type);
  return (
    <article className="space-y-3">
      <header>
        <div className="font-latin text-[10px] text-accent">{entry.type.toUpperCase()}</div>
        <h1 className="font-display text-2xl leading-tight font-bold">{entry.title || "(제목 없음)"}</h1>
        <div className="mt-0.5 text-[11px] text-muted">{type?.label}</div>
      </header>
      {entry.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.image} alt="" className="max-h-[50vh] w-full rounded-md border border-line object-contain" />
      )}
      <div className="space-y-2 text-[15px] leading-relaxed">
        {parseBody(entry.body).map((b, i) => {
          const text = <Inline text={b.text} />;
          switch (b.kind) {
            case "h1":
              return (
                <h2 key={i} className="font-display border-b border-line pt-2 pb-1 text-lg font-bold text-accent">
                  {text}
                </h2>
              );
            case "h2":
              return (
                <h3 key={i} className="font-display pt-1 font-bold">
                  {text}
                </h3>
              );
            case "li":
              return (
                <div key={i} className="flex gap-2 pl-1">
                  <span className="text-accent">◆</span>
                  <span>{text}</span>
                </div>
              );
            case "quote":
              return (
                <blockquote key={i} className="border-l-2 border-accent/60 pl-3 text-muted italic">
                  {text}
                </blockquote>
              );
            case "hr":
              return <hr key={i} className="border-line" />;
            default:
              return (
                <p key={i} className="whitespace-pre-wrap">
                  {text}
                </p>
              );
          }
        })}
        {!entry.body.trim() && <p className="text-muted">내용이 비어 있어요.</p>}
      </div>
    </article>
  );
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((p, i) =>
        p.bold ? (
          <b key={i} className="text-accent">
            {p.text}
          </b>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
