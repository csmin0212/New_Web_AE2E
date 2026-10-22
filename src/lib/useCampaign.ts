"use client";

import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import type { Campaign, Character, Member } from "./types";

export type CampaignState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "ready"; campaign: Campaign; members: Member[]; characters: Character[] };

export function useCampaign(cid: string, uid: string | undefined): CampaignState {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const fail = () => setDenied(true);
    const unsubs = [
      onSnapshot(
        doc(db, "campaigns", cid),
        (snap) => (snap.exists() ? setCampaign({ id: snap.id, ...(snap.data() as Omit<Campaign, "id">) }) : fail()),
        fail,
      ),
      onSnapshot(
        collection(db, "campaigns", cid, "members"),
        (snap) => setMembers(snap.docs.map((d) => d.data() as Member)),
        fail,
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [cid, uid]);

  // 캐릭터: GM 은 전부, 플레이어는 공개(hidden == false)인 것만 (보안 규칙도 같은 조건으로 막는다)
  const gmUid = campaign?.gmUid;
  useEffect(() => {
    if (!uid || !gmUid) return;
    const col = collection(db, "campaigns", cid, "characters");
    const q = gmUid === uid ? col : query(col, where("hidden", "==", false));
    return onSnapshot(
      q,
      (snap) =>
        setCharacters(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Character, "id">) })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        ),
      () => setDenied(true),
    );
  }, [cid, uid, gmUid]);

  if (denied) return { status: "denied" };
  if (!campaign) return { status: "loading" };
  return { status: "ready", campaign, members, characters };
}
