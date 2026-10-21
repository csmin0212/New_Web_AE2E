"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useImageShape } from "@/lib/imageShape";
import { PHASES, updateScene, type TalkView } from "@/lib/scene";
import { computeStage, splitTitle, type Actor } from "@/lib/stage";
import type { ChatMessage } from "@/lib/types";
import { RollView } from "../ChatMessageView";
import { useSession } from "./SessionContext";
import "./stage.css";

const TYPE_MS = 28;
const FRESH_MS = 8000; // 이보다 오래된 대사는 타자기 없이 바로 보여준다
const ROLL_SHOW_MS = 5000;
const SCALE_MIN = 0.5;
const SCALE_MAX = 1.3;

// 대화 모드 무대 — 갈바테인식 비주얼노벨 연출
//   대화 집중: 인물을 크게 세운다 (오려 낸 스탠딩은 그대로, 배경 있는 그림은 액자로)
//   배경 모드: 인물은 내리고 배경을 살린다. 말하는 사람 얼굴만 말풍선 옆에
export function TalkStage() {
  const { scene, messages, isGM } = useSession();
  const view = useMemo(() => computeStage(messages, scene.cast, scene.autoCast), [messages, scene.cast, scene.autoCast]);
  const phase = PHASES.find((p) => p.id === scene.phase);
  const line = view.line;
  const typed = useTypewriter(line?.message ?? null);
  const focus = scene.talkView !== "scene";
  const scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, scene.actorScale || 1));

  const bubbleActor = focus && line?.kind === "bubble" && line.actorKey ? view.actors.find((a) => a.key === line.actorKey) : undefined;

  return (
    <div className="stage" data-view={focus ? "focus" : "scene"} style={{ "--st-scale": scale } as CSSProperties} onClick={typed.complete}>
      <div className="stage__band">
        {scene.background ? (
          <div key={scene.background} className="stage__bg" style={{ backgroundImage: `url("${scene.background}")` }} />
        ) : (
          <div className="stage__bg stage__bg--empty" />
        )}
        <div className="stage__vignette" />
        {scene.cg && (
          <div key={scene.cg} className="stage__cg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={scene.cg} alt="" />
          </div>
        )}
      </div>

      {focus && !scene.cg && (
        <div className="stage__actors">
          {view.actors.map((a) => (
            <ActorView key={a.key} actor={a} speaking={view.speakingKey === a.key} anyoneSpeaking={!!view.speakingKey} />
          ))}
        </div>
      )}

      <div className="stage__topbar">
        <span className="stage__phase">{phase?.en}</span>
        {scene.place && <span className="stage__place">{scene.place}</span>}
        {isGM && <StageControls view={focus ? "focus" : "scene"} scale={scale} />}
      </div>

      <div className="stage__bottombar">
        {line?.kind === "narration" && (
          <p key={line.message.id} className={`stage__narration ${line.message.kind === "action" ? "stage__narration--action" : ""}`}>
            {line.message.kind === "action" && <small>{splitTitle(line.message.speaker.name).name}</small>}
            {typed.text}
          </p>
        )}
      </div>

      {line?.kind === "bubble" && (
        <SpeechBubble
          key={line.message.id}
          message={line.message}
          left={bubbleActor?.left}
          face={focus ? undefined : (line.message.speaker.avatar ?? line.message.speaker.image)}
          text={typed.text}
          done={typed.done}
        />
      )}

      <RollPopups messages={messages} />
    </div>
  );
}

// GM 만: 무대 위 띠 오른쪽에 보기 전환 + 인물 크기
function StageControls({ view, scale }: { view: TalkView; scale: number }) {
  const { cid } = useSession();
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? scale;
  const commit = () => {
    if (draft != null && draft !== scale) updateScene(cid, { actorScale: draft });
    setDraft(null);
  };
  return (
    <div className="stage__controls" onClick={(e) => e.stopPropagation()}>
      <div className="stage__seg" role="group" aria-label="무대 보기">
        {(
          [
            ["focus", "대화 집중", "인물을 크게 세워요"],
            ["scene", "배경 모드", "배경을 살리고 말하는 사람 얼굴만"],
          ] as const
        ).map(([v, label, hint]) => (
          <button key={v} className={view === v ? "on" : ""} title={hint} onClick={() => updateScene(cid, { talkView: v })}>
            {label}
          </button>
        ))}
      </div>
      {view === "focus" && (
        <label className="stage__scale" title="무대 인물 크기 (모두의 화면)">
          <span>인물</span>
          <input
            type="range"
            min={SCALE_MIN}
            max={SCALE_MAX}
            step={0.05}
            value={shown}
            onChange={(e) => setDraft(parseFloat(e.target.value))}
            onPointerUp={commit}
            onKeyUp={commit}
            onBlur={commit}
          />
          <b>{Math.round(shown * 100)}%</b>
        </label>
      )}
    </div>
  );
}

function ActorView({ actor, speaking, anyoneSpeaking }: { actor: Actor; speaking: boolean; anyoneSpeaking: boolean }) {
  const back = anyoneSpeaking && !speaking;
  const shape = useImageShape(actor.image);
  const card = shape?.kind === "card";
  return (
    <div
      className={`stage__actor ${card ? "stage__actor--card" : ""} ${speaking ? "stage__actor--speaking" : ""} ${back ? "stage__actor--back" : ""}`}
      style={{ left: `${actor.left}%`, visibility: actor.image && !shape ? "hidden" : undefined }}
    >
      {actor.image ? (
        card ? (
          // 배경이 있는 그림 — 액자에 담는다 (너무 납작하거나 길쭉하면 잘라서 맞춘다)
          <div className="stage__card" style={{ aspectRatio: Math.min(1, Math.max(0.62, shape.ratio)) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={actor.image} alt={actor.name} draggable={false} />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={actor.image} alt={actor.name} draggable={false} />
        )
      ) : (
        <div className="stage__silhouette">{splitTitle(actor.name).name.slice(0, 1)}</div>
      )}
    </div>
  );
}

function SpeechBubble({ message, left, face, text, done }: { message: ChatMessage; left?: number; face?: string; text: string; done: boolean }) {
  const { title, name } = splitTitle(message.speaker.name);
  return (
    <div className={`stage__bubble ${left == null ? "stage__bubble--solo" : ""} ${face ? "stage__bubble--face" : ""}`} style={{ left: `${left ?? 50}%` }}>
      {face && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="stage__face" src={face} alt="" draggable={false} />
      )}
      <div className="stage__tag">
        {title && <em>{title}</em>}
        <span>{name}</span>
      </div>
      <p className="stage__text">{text}</p>
      {done && (
        <span className="stage__next" aria-hidden>
          ▼
        </span>
      )}
    </div>
  );
}

// 새로 들어온 대사만 한 글자씩. 무대를 누르면 바로 끝까지.
function useTypewriter(message: ChatMessage | null) {
  const full = message?.text ?? "";
  const [openedAt] = useState(() => Date.now());
  const [state, setState] = useState<{ id: string | null; shown: number }>({ id: null, shown: 0 });
  const id = message?.id ?? null;

  // 메시지가 바뀌면 처음부터. 화면을 열기 전에 있던 대사는 전부 보인 상태로.
  if (state.id !== id) {
    const fresh = message ? message.ts > openedAt - FRESH_MS / 4 : false;
    setState({ id, shown: fresh ? 0 : full.length });
  }

  useEffect(() => {
    if (state.shown >= full.length) return;
    const t = window.setTimeout(() => setState((s) => ({ ...s, shown: s.shown + 1 })), TYPE_MS);
    return () => clearTimeout(t);
  }, [state.shown, full.length]);

  return {
    text: full.slice(0, state.shown),
    done: state.shown >= full.length,
    complete: () => setState((s) => ({ ...s, shown: full.length })),
  };
}

export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// 방금 굴린 주사위를 무대 오른쪽 위에 잠깐 띄운다
function RollPopups({ messages }: { messages: ChatMessage[] }) {
  const now = useNow(500);
  const recent = messages.filter((m) => m.kind === "roll" && m.roll && now - m.ts < ROLL_SHOW_MS && now - m.ts > -2000);

  return (
    <div className="stage__rolls">
      {recent.slice(-3).map((m) => (
        <div key={m.id} className="stage__roll">
          <div className="mb-1 text-right text-xs font-bold text-white drop-shadow">{splitTitle(m.speaker.name).name}</div>
          <RollView r={m.roll!} />
        </div>
      ))}
    </div>
  );
}
