"use client";

import { useEffect, useState } from "react";
import { PHASES } from "@/lib/scene";
import { useSession } from "./SessionContext";

const PLAY_MS = 2800;
const RECENT_MS = 4000; // 막 바뀐 페이즈만 연출 (들어오자마자 옛 컷인이 뜨지 않게)

// 페이즈가 바뀌면 모두의 화면에 컷인
export function PhaseCutin() {
  const { scene } = useSession();
  const [openedAt] = useState(() => Date.now());
  const [seen, setSeen] = useState(scene.phaseAt);
  const [playing, setPlaying] = useState<{ at: number; phase: string } | null>(null);

  // 화면을 연 뒤에 바뀐 페이즈만 (서버 시각 오차를 조금 봐준다)
  if (scene.phaseAt !== seen) {
    setSeen(scene.phaseAt);
    if (scene.phaseAt && scene.phaseAt > openedAt - RECENT_MS) setPlaying({ at: scene.phaseAt, phase: scene.phase });
  }

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setPlaying(null), PLAY_MS);
    return () => clearTimeout(t);
  }, [playing]);

  if (!playing) return null;
  const p = PHASES.find((x) => x.id === playing.phase);
  if (!p) return null;

  return (
    <div
      key={playing.at}
      className="pointer-events-none fixed inset-0 z-50 grid place-items-center"
      style={{ animation: `cutin-fade ${PLAY_MS}ms ease both`, background: "rgba(0,0,0,.55)" }}
      aria-live="polite"
    >
      <div
        className="absolute inset-x-[-10%] top-1/2 h-40 -translate-y-1/2"
        style={{
          background: "linear-gradient(90deg, transparent, var(--accent) 12%, var(--accent) 88%, transparent)",
          opacity: 0.92,
          animation: `cutin-band ${PLAY_MS}ms cubic-bezier(.7,0,.2,1) both`,
        }}
      />
      <div
        className="absolute inset-x-[-10%] top-1/2 h-px -translate-y-[88px]"
        style={{ background: "var(--st-outline)", animation: `cutin-band ${PLAY_MS}ms cubic-bezier(.7,0,.2,1) 60ms both` }}
      />
      <div
        className="absolute inset-x-[-10%] top-1/2 h-px translate-y-[88px]"
        style={{ background: "var(--st-outline)", animation: `cutin-band ${PLAY_MS}ms cubic-bezier(.7,0,.2,1) 120ms both` }}
      />
      <div className="relative text-center" style={{ color: "var(--accent-ink)" }}>
        <div className="font-latin text-5xl font-bold sm:text-7xl" style={{ animation: `cutin-text ${PLAY_MS}ms ease both` }}>
          {p.en}
        </div>
        <div className="font-display mt-2 text-lg tracking-[0.4em] sm:text-2xl" style={{ animation: `cutin-text ${PLAY_MS}ms ease 100ms both` }}>
          ❖ {p.ko} ❖
        </div>
      </div>
    </div>
  );
}
