"use client";

import { useEffect, useMemo, useState } from "react";
import { PHASES } from "@/lib/scene";
import { computeStage, splitTitle, type Actor } from "@/lib/stage";
import type { ChatMessage } from "@/lib/types";
import { RollView } from "../ChatMessageView";
import { useSession } from "./SessionContext";
import "./stage.css";

const TYPE_MS = 28;
const FRESH_MS = 8000; // 이보다 오래된 대사는 타자기 없이 바로 보여준다
const ROLL_SHOW_MS = 5000;

// 대화 모드 무대 — 갈바테인식 비주얼노벨 연출
export function TalkStage() {
  const { scene, messages } = useSession();
  const view = useMemo(() => computeStage(messages, scene.cast, scene.autoCast), [messages, scene.cast, scene.autoCast]);
  const phase = PHASES.find((p) => p.id === scene.phase);
  const line = view.line;
  const typed = useTypewriter(line?.message ?? null);

  const bubbleActor = line?.kind === "bubble" && line.actorKey ? view.actors.find((a) => a.key === line.actorKey) : undefined;

  return (
    <div className="stage" onClick={typed.complete}>
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

      {!scene.cg && (
        <div className="stage__actors">
          {view.actors.map((a) => (
            <ActorView key={a.key} actor={a} speaking={view.speakingKey === a.key} anyoneSpeaking={!!view.speakingKey} />
          ))}
        </div>
      )}

      <div className="stage__topbar">
        <span className="stage__phase">{phase?.en}</span>
        {scene.place && <span className="stage__place">{scene.place}</span>}
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
        <SpeechBubble key={line.message.id} message={line.message} left={bubbleActor?.left} text={typed.text} done={typed.done} />
      )}

      <RollPopups messages={messages} />
    </div>
  );
}

function ActorView({ actor, speaking, anyoneSpeaking }: { actor: Actor; speaking: boolean; anyoneSpeaking: boolean }) {
  const back = anyoneSpeaking && !speaking;
  return (
    <div
      className={`stage__actor ${speaking ? "stage__actor--speaking" : ""} ${back ? "stage__actor--back" : ""}`}
      style={{ left: `${actor.left}%` }}
    >
      {actor.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={actor.image} alt={actor.name} draggable={false} />
      ) : (
        <div className="stage__silhouette">{splitTitle(actor.name).name.slice(0, 1)}</div>
      )}
    </div>
  );
}

function SpeechBubble({ message, left, text, done }: { message: ChatMessage; left?: number; text: string; done: boolean }) {
  const { title, name } = splitTitle(message.speaker.name);
  return (
    <div className={`stage__bubble ${left == null ? "stage__bubble--solo" : ""}`} style={{ left: `${left ?? 50}%` }}>
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
