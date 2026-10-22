"use client";

import type { User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { subscribeReveals } from "@/lib/campaigns";
import { subscribeChat } from "@/lib/chat";
import type { RevealDoc } from "@/lib/reveal";
import { DEFAULT_BATTLE, DEFAULT_SCENE, subscribeBattle, subscribeScene, type Battle, type Scene } from "@/lib/scene";
import type { Campaign, Character, ChatMessage, Member } from "@/lib/types";

type Session = {
  cid: string;
  user: User;
  campaign: Campaign;
  members: Member[];
  characters: Character[];
  isGM: boolean;
  scene: Scene;
  battle: Battle;
  messages: ChatMessage[];
  reveals: Record<string, RevealDoc>; // 비공개 캐릭터의 플레이어 공개 본 (charId → 공개 본)
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({
  cid,
  user,
  campaign,
  members,
  characters,
  children,
}: Omit<Session, "isGM" | "scene" | "battle" | "messages" | "reveals"> & { children: ReactNode }) {
  const [scene, setScene] = useState<Scene>(DEFAULT_SCENE);
  const [battle, setBattle] = useState<Battle>(DEFAULT_BATTLE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reveals, setReveals] = useState<Record<string, RevealDoc>>({});

  useEffect(() => subscribeScene(cid, setScene), [cid]);
  useEffect(() => subscribeBattle(cid, setBattle), [cid]);
  useEffect(() => subscribeChat(cid, user.uid, setMessages), [cid, user.uid]);
  useEffect(() => subscribeReveals(cid, setReveals), [cid]);

  const value = useMemo<Session>(
    () => ({ cid, user, campaign, members, characters, isGM: campaign.gmUid === user.uid, scene, battle, messages, reveals }),
    [cid, user, campaign, members, characters, scene, battle, messages, reveals],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("SessionProvider 안에서만 쓸 수 있어요.");
  return s;
}
