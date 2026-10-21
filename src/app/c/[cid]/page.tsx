"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CharacterCard } from "@/components/CharacterCard";
import { ChatPanel } from "@/components/ChatPanel";
import { SheetImport } from "@/components/SheetImport";
import { signInWithGoogle, useAuth } from "@/lib/auth";
import { useCampaign } from "@/lib/useCampaign";

export default function CampaignPage() {
  const { cid } = useParams<{ cid: string }>();
  const { user, loading } = useAuth();
  const state = useCampaign(cid, user?.uid);
  const [showImport, setShowImport] = useState(false);
  const [copied, setCopied] = useState(false);

  if (loading) return <Center>불러오는 중…</Center>;
  if (!user) {
    return (
      <Center>
        <button className="btn-primary" onClick={() => signInWithGoogle()}>
          구글로 로그인
        </button>
      </Center>
    );
  }
  if (state.status === "denied") {
    return (
      <Center>
        <p>이 캠페인에 참가하지 않았거나 없는 캠페인이에요.</p>
        <Link href="/" className="btn mt-4">
          홈으로
        </Link>
      </Center>
    );
  }
  if (state.status === "loading") return <Center>불러오는 중…</Center>;

  const { campaign, members, characters } = state;
  const isGM = campaign.gmUid === user.uid;
  const pcs = characters.filter((c) => c.kind === "pc");
  const npcs = characters.filter((c) => c.kind === "npc");

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-2">
        <Link href="/" className="text-sm text-muted hover:text-text">
          ←
        </Link>
        <h1 className="font-bold">{campaign.name}</h1>
        <span className="text-xs text-muted">
          {isGM ? "GM" : "플레이어"} · 참가자 {members.length}명
        </span>
        <div className="ml-auto flex items-center gap-2">
          {isGM && (
            <>
              <button
                className="btn"
                title="클릭해서 복사"
                onClick={() => {
                  navigator.clipboard?.writeText(campaign.inviteCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                초대 코드 <b className="tracking-widest text-accent">{campaign.inviteCode}</b>
                {copied && <span className="text-xs text-muted">복사됨</span>}
              </button>
              <button className="btn-primary" onClick={() => setShowImport((v) => !v)}>
                시트 불러오기
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="max-h-[45vh] shrink-0 space-y-3 overflow-y-auto border-line p-3 lg:max-h-none lg:w-[380px] lg:border-r">
          {isGM && showImport && (
            <SheetImport cid={cid} user={user} members={members} nextOrder={characters.length} onDone={() => setShowImport(false)} />
          )}
          {characters.length === 0 && (
            <p className="p-4 text-center text-sm text-muted">
              {isGM ? "‘시트 불러오기’로 캐릭터를 추가하세요." : "GM이 캐릭터를 추가하면 여기에 보여요."}
            </p>
          )}
          {pcs.map((c) => (
            <CharacterCard key={c.id} cid={cid} user={user} character={c} isGM={isGM} members={members} />
          ))}
          {npcs.length > 0 && <h2 className="px-1 pt-2 text-xs font-semibold text-muted">NPC · 에너미</h2>}
          {npcs.map((c) => (
            <CharacterCard key={c.id} cid={cid} user={user} character={c} isGM={isGM} members={members} />
          ))}
        </aside>

        <main className="flex min-h-0 flex-1 flex-col">
          <ChatPanel cid={cid} user={user} campaign={campaign} members={members} characters={characters} />
        </main>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center p-6 text-center text-muted">{children}</main>;
}
