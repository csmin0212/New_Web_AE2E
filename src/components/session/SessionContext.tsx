"use client";

import type { User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { subscribeChat } from "@/lib/chat";
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
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({
  cid,
  user,
  campaign,
  members,
  characters,
  children,
}: Omit<Session, "isGM" | "scene" | "battle" | "messages"> & { children: ReactNode }) {
  const [scene, setScene] = useState<Scene>(DEFAULT_SCENE);
  const [battle, setBattle] = useState<Battle>(DEFAULT_BATTLE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => subscribeScene(cid, setScene), [cid]);
  useEffect(() => subscribeBattle(cid, setBattle), [cid]);
  useEffect(() => subscribeChat(cid, user.uid, setMessages), [cid, user.uid]);

  const value = useMemo<Session>(
    () => ({ cid, user, campaign, members, characters, isGM: campaign.gmUid === user.uid, scene, battle, messages }),
    [cid, user, campaign, members, characters, scene, battle, messages],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("SessionProvider 안에서만 쓸 수 있어요.");
  return s;
}
