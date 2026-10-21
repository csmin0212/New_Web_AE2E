"use client";

import { useState, type ReactNode } from "react";
import { FX_DEFS, playLocalFx, triggerFx, type FxKind } from "@/lib/fxEvents";
import { useSession } from "./SessionContext";

type SectionComp = (p: { title: string; open?: boolean; children: ReactNode }) => ReactNode;

// 연출 패널 — 페르소나식 화면 연출 모음. 「미리보기」는 내 화면만, 「모두에게」는 전원 화면에
export function AnimationsSection({ Section }: { Section: SectionComp }) {
  const { cid, user } = useSession();
  const [texts, setTexts] = useState<Partial<Record<FxKind, { text: string; sub: string }>>>({});
  const [busy, setBusy] = useState<FxKind | null>(null);

  return (
    <Section title={`연출 모음 (${FX_DEFS.length})`}>
      <p className="text-[11px] text-muted">「자동」은 전투·굴림에 맞춰 저절로 나와요. 나머지는 GM이 눌러서 모두에게 띄워요. 화면을 누르면 건너뛰어요.</p>
      <ul className="mt-2 space-y-1.5">
        {FX_DEFS.map((d) => {
          const t = texts[d.kind] ?? { text: d.text, sub: d.sub ?? "" };
          const ev = { kind: d.kind, text: t.text, sub: t.sub || undefined };
          return (
            <li key={d.kind} className="rounded border border-line p-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold">{d.label}</span>
                {d.auto && <span className="rounded bg-accent/20 px-1 text-[10px] text-accent">자동</span>}
                <button className="btn ml-auto px-2 py-0.5 text-[11px]" onClick={() => playLocalFx(ev)} title="내 화면에서만 미리보기">
                  <span>▶ 미리보기</span>
                </button>
                {!d.auto && (
                  <button
                    className="btn-primary px-2 py-0.5 text-[11px]"
                    disabled={busy === d.kind}
                    onClick={async () => {
                      setBusy(d.kind);
                      try {
                        await triggerFx(cid, user.uid, ev);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    <span>모두에게</span>
                  </button>
                )}
              </div>
              <div className="mt-0.5 text-[10px] text-muted">{d.hint}</div>
              {!d.auto && (
                <div className="mt-1 flex gap-1">
                  <input className="input py-0.5 text-xs" value={t.text} onChange={(e) => setTexts({ ...texts, [d.kind]: { ...t, text: e.target.value } })} aria-label={`${d.label} 큰 글씨`} />
                  <input
                    className="input py-0.5 text-xs"
                    value={t.sub}
                    placeholder="작은 글씨"
                    onChange={(e) => setTexts({ ...texts, [d.kind]: { ...t, sub: e.target.value } })}
                    aria-label={`${d.label} 작은 글씨`}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
