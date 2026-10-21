"use client";

import type { User } from "firebase/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { deletePublicMessage, sendMessage, subscribeChat } from "@/lib/chat";
import { parseChatInput } from "@/lib/chatCommand";
import { roll } from "@/lib/dice";
import type { Campaign, Character, ChatMessage, Member, Speaker } from "@/lib/types";
import { ChatMessageView } from "./ChatMessageView";

type SpeakerOption = { key: string; speaker: Speaker };

const NPC_KEY = "trpg-vtt:npc-names";

export function ChatPanel({
  cid,
  user,
  campaign,
  members,
  characters,
}: {
  cid: string;
  user: User;
  campaign: Campaign;
  members: Member[];
  characters: Character[];
}) {
  const isGM = campaign.gmUid === user.uid;
  const me = members.find((m) => m.uid === user.uid);
  const myName = me?.name ?? user.displayName ?? "나";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [npcNames, setNpcNames] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`${NPC_KEY}:${cid}`) ?? "[]");
    } catch {
      return [];
    }
  });
  const [pickedSpeaker, setSpeakerKey] = useState<string | null>(null);
  const [newNpc, setNewNpc] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => subscribeChat(cid, user.uid, setMessages), [cid, user.uid]);

  useEffect(() => {
    const el = logRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const speakers: SpeakerOption[] = useMemo(() => {
    const opts: SpeakerOption[] = [{ key: "self", speaker: { name: isGM ? `${myName} (GM)` : myName, uid: user.uid } }];
    for (const c of characters) {
      if (isGM || c.ownerUid === user.uid) {
        opts.push({ key: `char:${c.id}`, speaker: { name: c.sheet.name, uid: user.uid, charId: c.id } });
      }
    }
    if (isGM) for (const n of npcNames) opts.push({ key: `npc:${n}`, speaker: { name: n, uid: user.uid } });
    return opts;
  }, [characters, isGM, myName, npcNames, user.uid]);

  // 아직 고르지 않았으면 플레이어는 자기 캐릭터로, GM은 GM으로 말한다
  const speakerKey =
    pickedSpeaker ?? (isGM ? "self" : (speakers.find((o) => o.key.startsWith("char:"))?.key ?? "self"));
  const speaker = (speakers.find((o) => o.key === speakerKey) ?? speakers[0]).speaker;

  function saveNpcs(list: string[]) {
    setNpcNames(list);
    try {
      localStorage.setItem(`${NPC_KEY}:${cid}`, JSON.stringify(list));
    } catch {}
  }

  // 귓속말 대상: 참가자 이름 또는 캐릭터 이름 (NPC면 GM에게)
  function resolveTarget(name: string): { uid: string; name: string } | null {
    const m = members.find((x) => x.name === name);
    if (m) return { uid: m.uid, name: m.name };
    const c = characters.find((x) => x.sheet.name === name);
    if (c) return { uid: c.ownerUid ?? campaign.gmUid, name: c.sheet.name };
    if (name.toUpperCase() === "GM") return { uid: campaign.gmUid, name: "GM" };
    return null;
  }

  async function submit() {
    const cmd = parseChatInput(text);
    if (!cmd) return;
    setError(null);
    if (cmd.type === "error") {
      setError(cmd.message);
      return;
    }
    // 보내는 동안 이어서 칠 수 있게 입력창은 바로 비우고, 실패하면 되돌린다
    const sent = text;
    setText("");
    const base = { uid: user.uid, speaker };
    try {
      switch (cmd.type) {
        case "say":
        case "action":
        case "ooc":
          await sendMessage(cid, { ...base, kind: cmd.type, text: cmd.text });
          break;
        case "image":
          await sendMessage(cid, { ...base, kind: "image", text: cmd.url });
          break;
        case "roll": {
          const result = roll(cmd.expr, { check: cmd.check, label: cmd.label || undefined });
          const secretTo = cmd.secret ? [campaign.gmUid] : undefined;
          await sendMessage(cid, { ...base, kind: "roll", text: "", roll: result, secret: cmd.secret || undefined }, secretTo);
          break;
        }
        case "whisper": {
          const target = resolveTarget(cmd.target);
          if (!target) {
            setText(sent);
            setError(`'${cmd.target}'을(를) 찾지 못했어요. 참가자나 캐릭터 이름을 적어주세요.`);
            return;
          }
          await sendMessage(cid, { ...base, kind: "say", text: cmd.text, to: [target] }, [target.uid]);
          break;
        }
      }
    } catch (e) {
      setText((cur) => cur || sent);
      setError(e instanceof Error ? e.message : "보내지 못했어요.");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={logRef}
        className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-4 py-3"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">아직 메시지가 없어요.</p>}
        {messages.map((m, i) => (
          <ChatMessageView
            key={m.id}
            message={m}
            grouped={i > 0 && sameSpeaker(messages[i - 1], m)}
            canDelete={isGM && !m.to && !m.secret}
            onDelete={() => deletePublicMessage(cid, m.id)}
          />
        ))}
      </div>

      <div className="border-t border-line bg-panel p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1 text-muted">
            화자
            <select className="input w-auto py-1" value={speakerKey} onChange={(e) => setSpeakerKey(e.target.value)}>
              {speakers.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.speaker.name}
                </option>
              ))}
            </select>
          </label>
          {isGM && (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                const n = newNpc.trim();
                if (!n) return;
                if (!npcNames.includes(n)) saveNpcs([...npcNames, n]);
                setSpeakerKey(`npc:${n}`);
                setNewNpc("");
              }}
            >
              <input className="input w-44 py-1" placeholder="[칭호] NPC 이름 추가" value={newNpc} onChange={(e) => setNewNpc(e.target.value)} />
              <button className="btn py-1">추가</button>
              {speakerKey.startsWith("npc:") && (
                <button
                  type="button"
                  className="btn py-1 text-muted"
                  onClick={() => {
                    saveNpcs(npcNames.filter((n) => `npc:${n}` !== speakerKey));
                    setSpeakerKey("self");
                  }}
                >
                  이 NPC 빼기
                </button>
              )}
            </form>
          )}
        </div>
        <div className="flex gap-2">
          <textarea
            className="input min-h-[42px] flex-1 resize-none"
            rows={1}
            placeholder={'대사 · @행동 · (잡담 · /c 2D+5 명중 · /w 이름 귓속말' + (isGM ? " · /gr 비밀 굴림" : "")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button className="btn-primary" onClick={submit} disabled={!text.trim()}>
            보내기
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-hp">{error}</p>}
      </div>
    </div>
  );
}

function sameSpeaker(a: ChatMessage, b: ChatMessage) {
  return (
    a.speaker.name === b.speaker.name &&
    a.uid === b.uid &&
    !a.to === !b.to &&
    !a.secret === !b.secret &&
    b.ts - a.ts < 5 * 60 * 1000
  );
}
