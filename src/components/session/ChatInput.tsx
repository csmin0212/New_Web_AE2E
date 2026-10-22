"use client";

import { useMemo, useState } from "react";
import { removeCharacter } from "@/lib/campaigns";
import { sendMessage } from "@/lib/chat";
import { parseChatInput } from "@/lib/chatCommand";
import { findKeywordCutin, triggerCutin } from "@/lib/fx";
import { roll } from "@/lib/dice";
import { removeNpc } from "@/lib/scene";
import { splitTitle } from "@/lib/stage";
import type { Speaker } from "@/lib/types";
import { faceOf, stageImageOf } from "@/lib/characterArt";
import { readDiceColor } from "@/lib/diceColor";
import { useContextMenu, type MenuItem } from "../ContextMenu";
import { DiceColorButton } from "./DiceColorButton";
import { CharacterEditDialog, NpcEditDialog } from "./EditDialogs";
import { openSheet } from "./PartyBar";
import { useSession } from "./SessionContext";
import { stageMenuItems } from "./stageMenu";

type SpeakerOption = { key: string; speaker: Speaker; face?: string };

// 화자 줄에서 숨긴 칩 (내 화면에서만, 지우지는 않음)
function useHiddenSpeakers(cid: string) {
  const storeKey = `vtt:hidden-speakers:${cid}`;
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storeKey) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  function set(next: string[]) {
    setHidden(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {}
  }
  return {
    hidden,
    hide: (k: string) => set([...hidden.filter((x) => x !== k), k]),
    show: (k: string) => set(hidden.filter((x) => x !== k)),
  };
}

// 아래 입력 띠 — 화자 고르기 + 대사·명령 입력
export function ChatInput() {
  const { cid, user, campaign, members, characters, scene, isGM } = useSession();
  const me = members.find((m) => m.uid === user.uid);
  const myName = me?.name ?? user.displayName ?? "나";
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const menu = useContextMenu();
  const { hidden, hide, show } = useHiddenSpeakers(cid);
  const [editChar, setEditChar] = useState<string | null>(null);
  const [editNpc, setEditNpc] = useState<string | null | undefined>(undefined); // null = 새로 만들기

  const options: SpeakerOption[] = useMemo(() => {
    const opts: SpeakerOption[] = [];
    if (isGM) opts.push({ key: "narrator", speaker: { name: "GM", uid: user.uid, narrator: true } });
    for (const c of characters) {
      if (!isGM && c.ownerUid !== user.uid) continue;
      opts.push({
        key: `char:${c.id}`,
        face: faceOf(c),
        speaker: { name: c.sheet.name, uid: user.uid, charId: c.id, image: stageImageOf(c), avatar: faceOf(c), color: c.color },
      });
    }
    if (isGM) {
      for (const [k, n] of Object.entries(scene.npcs)) {
        opts.push({ key: `npc:${k}`, face: n.image, speaker: { name: n.name, uid: user.uid, image: n.image, color: n.color } });
      }
    }
    if (!isGM) opts.push({ key: "self", speaker: { name: myName, uid: user.uid } });
    return opts;
  }, [characters, isGM, myName, scene.npcs, user.uid]);

  const visible = options.filter((o) => !hidden.includes(o.key) || o.key === picked);
  const current = options.find((o) => o.key === picked) ?? visible[0] ?? options[0];
  const speaker = current?.speaker ?? { name: myName, uid: user.uid };

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
        case "ooc": {
          await sendMessage(cid, { ...base, kind: cmd.type, text: cmd.text });
          // 대사에 컷인 키워드가 들어 있으면 자동 재생 (잡담은 제외)
          const hit = cmd.type !== "ooc" ? findKeywordCutin(cmd.text, scene.cutins) : null;
          if (hit) await triggerCutin(cid, user.uid, hit);
          break;
        }
        case "cutin": {
          const key = Object.entries(scene.cutins).find(([, c]) => c.name === cmd.name)?.[0];
          if (!key) {
            setText(sent);
            setError(`「${cmd.name}」 컷인이 없어요. 연출 → 컷인에서 이름을 확인하세요.`);
            return;
          }
          await triggerCutin(cid, user.uid, key);
          break;
        }
        case "image":
          await sendMessage(cid, { ...base, kind: "image", text: cmd.url });
          break;
        case "roll": {
          const result = roll(cmd.expr, { check: cmd.check, label: cmd.label || undefined });
          await sendMessage(
            cid,
            { ...base, kind: "roll", text: "", roll: result, secret: cmd.secret || undefined, diceColor: readDiceColor() },
            cmd.secret ? [campaign.gmUid] : undefined,
          );
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

  function chipMenu(o: SpeakerOption): MenuItem[] {
    const items: MenuItem[] = [{ title: o.speaker.narrator ? "GM 서술" : o.speaker.name }];
    const charId = o.key.startsWith("char:") ? o.key.slice(5) : null;
    const npcKey = o.key.startsWith("npc:") ? o.key.slice(4) : null;
    const who = { charId: charId ?? undefined, name: o.speaker.name, image: o.speaker.image };
    if (charId) {
      items.push({ label: "시트 열기", icon: "📜", onSelect: () => openSheet(charId) });
      items.push({ label: "고치기", hint: "그림·색·이름", icon: "✎", onSelect: () => setEditChar(charId) });
    }
    if (npcKey) items.push({ label: "고치기", hint: "그림·색·이름", icon: "✎", onSelect: () => setEditNpc(npcKey) });
    if (isGM && (charId || npcKey)) {
      items.push(...stageMenuItems(cid, scene, who));
    }
    if (!o.speaker.narrator && o.key !== "self") {
      items.push("sep", { label: "화자 줄에서 숨기기", hint: "내 화면만", icon: "◌", onSelect: () => hide(o.key) });
    }
    if (isGM && npcKey) {
      items.push({
        label: "NPC 화자 삭제",
        icon: "✕",
        danger: true,
        onSelect: () => {
          if (confirm(`NPC 화자 「${o.speaker.name}」을(를) 지울까요?`)) return removeNpc(cid, npcKey);
        },
      });
    }
    if (isGM && charId) {
      items.push({
        label: "캠페인에서 빼기",
        icon: "✕",
        danger: true,
        onSelect: () => {
          if (confirm(`${o.speaker.name}을(를) 캠페인에서 뺄까요? (보관함 원본은 그대로예요)`)) return removeCharacter(cid, charId);
        },
      });
    }
    return items;
  }

  function addMenu(): MenuItem[] {
    const items: MenuItem[] = [];
    if (isGM) items.push({ label: "NPC 화자 새로 만들기", icon: "＋", onSelect: () => setEditNpc(null) });
    const hiddenOpts = options.filter((o) => hidden.includes(o.key));
    if (hiddenOpts.length) {
      if (items.length) items.push("sep");
      items.push({ title: "숨긴 화자 다시 보이기" });
      for (const o of hiddenOpts) items.push({ label: o.speaker.name, icon: "◉", onSelect: () => show(o.key) });
    }
    return items;
  }
  const canAdd = isGM || options.some((o) => hidden.includes(o.key));
  const editingChar = characters.find((c) => c.id === editChar);

  return (
    <div className="min-w-0 flex-1">
      <div className="chip-row mb-1 items-center gap-1.5">
        {visible.map((o) => {
          const on = o.key === current?.key;
          const { name } = splitTitle(o.speaker.name);
          return (
            <button
              key={o.key}
              onClick={() => setPicked(o.key)}
              onContextMenu={(e) => menu.open(e, chipMenu(o))}
              className={`pop flex shrink-0 items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs ${
                on ? "border-accent bg-accent/20 text-text" : "border-line bg-panel/70 text-muted hover:text-text"
              }`}
              title={`${o.speaker.name} — 우클릭: 고치기·무대·숨기기`}
            >
              {o.face ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.face} alt="" className="h-6 w-6 rounded-full object-cover object-top" />
              ) : (
                <span className="font-display grid h-6 w-6 place-items-center rounded-full bg-panel-2 text-[11px] text-accent">
                  {o.speaker.narrator ? "❖" : name.slice(0, 1)}
                </span>
              )}
              {o.speaker.narrator ? "GM 서술" : name}
            </button>
          );
        })}
        {canAdd && (
          <button
            className="pop grid h-7 w-7 shrink-0 place-items-center rounded-full border border-dashed border-line bg-panel/70 text-sm text-muted hover:text-text"
            title={isGM ? "NPC 화자 추가 · 숨긴 화자 보이기" : "숨긴 화자 보이기"}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              menu.open({ clientX: r.left, clientY: r.top - 4 }, addMenu());
            }}
          >
            ＋
          </button>
        )}
      </div>
      {menu.node}
      {editingChar && <CharacterEditDialog character={editingChar} onClose={() => setEditChar(null)} />}
      {editNpc !== undefined && <NpcEditDialog npcKey={editNpc} onClose={() => setEditNpc(undefined)} />}
      <div className="flex gap-2">
        <button className="btn shrink-0 px-2.5" title="판정 굴림 입력" onClick={() => setText((t) => (t.startsWith("/") ? t : "/c 2D+"))}>
          <span>🎲</span>
        </button>
        <DiceColorButton />
        <textarea
          className="input min-h-[40px] flex-1 resize-none"
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
        <button className="btn-primary shrink-0" onClick={submit} disabled={!text.trim()}>
          <span>보내기</span>
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-hp">{error}</p>}
    </div>
  );
}
