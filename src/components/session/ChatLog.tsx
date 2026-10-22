"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deletePublicMessage } from "@/lib/chat";
import { updateScene } from "@/lib/scene";
import type { ChatMessage } from "@/lib/types";
import { ChatMessageView } from "../ChatMessageView";
import { useSession } from "./SessionContext";

type Filter = "all" | "talk" | "roll" | "ooc";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "talk", label: "대화" },
  { id: "roll", label: "굴림" },
  { id: "ooc", label: "잡담" },
];

function pass(m: ChatMessage, f: Filter) {
  if (f === "all") return true;
  if (f === "roll") return m.kind === "roll";
  if (f === "ooc") return m.kind === "ooc";
  return m.kind === "say" || m.kind === "action" || m.kind === "image";
}

// 오른쪽 기록 패널 — 로그가 쌓이는 곳
export function ChatLog() {
  const { messages, isGM, cid } = useSession();
  const [filter, setFilter] = useState<Filter>("all");
  const shown = messages.filter((m) => pass(m, filter));
  const logRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = logRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [shown.length, filter]);

  const onDelete = useCallback((id: string) => deletePublicMessage(cid, id), [cid]);
  const onShowOnStage = useCallback((url: string) => updateScene(cid, { cg: url }), [cid]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-1 border-b border-line px-3 py-2">
        <h2 className="font-latin mr-auto text-xs text-accent">LOG</h2>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded px-2 py-0.5 text-xs transition ${filter === f.id ? "bg-accent text-accent-ink" : "text-muted hover:text-text"}`}
          >
            {f.label}
          </button>
        ))}
      </header>
      <div
        ref={logRef}
        className="min-h-0 flex-1 overflow-y-auto px-1 py-2"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {shown.length === 0 && <p className="py-10 text-center text-sm text-muted">아직 기록이 없어요.</p>}
        {shown.map((m, i) => (
          <ChatMessageView
            key={m.id}
            message={m}
            grouped={i > 0 && sameSpeaker(shown[i - 1], m)}
            canDelete={isGM && !m.to && !m.secret}
            onDelete={onDelete}
            onShowOnStage={isGM ? onShowOnStage : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function sameSpeaker(a: ChatMessage, b: ChatMessage) {
  return (
    a.speaker.name === b.speaker.name &&
    a.uid === b.uid &&
    !a.to === !b.to &&
    !a.secret === !b.secret &&
    a.kind !== "ooc" &&
    b.ts - a.ts < 5 * 60 * 1000
  );
}
