"use client";

import { useEffect, useState } from "react";
import { subscribeCutin, type CutinPlay, type CutinPreset, type TransitionState } from "@/lib/fx";
import { splitTitle } from "@/lib/stage";
import { useSession } from "./SessionContext";
import "./fx.css";

const FRESH_MS = 5000; // 화면을 연 뒤 이만큼 안에 시작된 연출만 재생 (들어오자마자 옛 연출이 뜨지 않게)

// 장면 전환 효과 — scene.transition 이 바뀌면 모두의 화면에서
export function TransitionOverlay() {
  const { scene } = useSession();
  const [openedAt] = useState(() => Date.now());
  const [seen, setSeen] = useState<number | null>(scene.transition?.at ?? null);
  const [playing, setPlaying] = useState<TransitionState | null>(null);

  const t = scene.transition;
  if (t && t.at !== seen) {
    setSeen(t.at);
    if (t.at > openedAt - FRESH_MS && t.type !== "cut") setPlaying(t);
  }

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setPlaying(null), playing.ms + 50);
    return () => clearTimeout(timer);
  }, [playing]);

  if (!playing) return null;
  return <div key={playing.at} className={`fx-layer tr-${playing.type}`} style={{ ["--fx-ms" as string]: `${playing.ms}ms` }} aria-hidden />;
}

// 컷인 — fx/{cid}/cutin 이 바뀌면 모두의 화면에서
export function CutinOverlay() {
  const { cid, scene } = useSession();
  const [openedAt] = useState(() => Date.now());
  const [play, setPlay] = useState<(CutinPlay & { preset: CutinPreset }) | null>(null);
  const [seen, setSeen] = useState<number | null>(null);
  const [last, setLast] = useState<CutinPlay | null>(null);

  useEffect(() => subscribeCutin(cid, setLast), [cid]);

  if (last && last.at !== seen) {
    setSeen(last.at);
    const preset = scene.cutins[last.key];
    if (preset && last.at > openedAt - FRESH_MS) setPlay({ ...last, preset });
  }

  useEffect(() => {
    if (!play) return;
    const timer = window.setTimeout(() => setPlay(null), play.preset.ms + 50);
    return () => clearTimeout(timer);
  }, [play]);

  if (!play) return null;
  return <CutinView key={play.at} preset={play.preset} />;
}

export function CutinView({ preset: c }: { preset: CutinPreset }) {
  const style = { ["--fx-ms" as string]: `${c.ms}ms`, ...(c.color ? { ["--ci-color" as string]: c.color } : {}) };
  const { title, name } = splitTitle(c.text ?? "");
  const art = c.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={c.image} alt="" className="ci-art" />
  ) : null;

  if (c.style === "band") {
    return (
      <div className="fx-layer ci ci-band" style={style} aria-live="polite">
        <div className="ci-stripe" />
        {art}
        <div className="ci-words">
          {c.sub && <div className="ci-sub text-sm sm:text-lg">{c.sub}</div>}
          {c.text && <div className="ci-text text-5xl sm:text-7xl">{c.text}</div>}
        </div>
      </div>
    );
  }
  if (c.style === "side") {
    return (
      <div className="fx-layer ci ci-side" style={style} aria-live="polite">
        {art}
        <div className="ci-words">
          {title && <div className="ci-sub mb-1 text-xs sm:text-sm">{title}</div>}
          {name && <div className="ci-plate ci-text text-3xl sm:text-5xl">{name}</div>}
          {c.sub && <div className="ci-text mt-3 text-lg sm:text-2xl">{c.sub}</div>}
        </div>
      </div>
    );
  }
  if (c.style === "flash") {
    return (
      <div className="fx-layer ci ci-flash" style={style} aria-live="polite">
        {art}
        <div className="ci-words">
          {c.text && <div className="ci-text text-5xl sm:text-8xl">{c.text}</div>}
          {c.sub && <div className="ci-sub mt-2 text-sm sm:text-lg">{c.sub}</div>}
        </div>
      </div>
    );
  }
  return (
    <div className="fx-layer ci ci-full" style={style} aria-live="polite">
      <div className="ci-frame">{art}</div>
      <div className="ci-words">
        <div>
          {c.text && <div className="ci-text text-xl sm:text-3xl">{c.text}</div>}
          {c.sub && <div className="ci-sub mt-1 text-xs sm:text-sm">{c.sub}</div>}
        </div>
      </div>
    </div>
  );
}
