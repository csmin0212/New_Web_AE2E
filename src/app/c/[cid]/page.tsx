"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BattleStage } from "@/components/session/BattleStage";
import { ChatInput } from "@/components/session/ChatInput";
import { ChatLog } from "@/components/session/ChatLog";
import { DirectorPanel } from "@/components/session/DirectorPanel";
import { PartyBar } from "@/components/session/PartyBar";
import { PhaseCutin } from "@/components/session/PhaseCutin";
import { SessionProvider, useSession } from "@/components/session/SessionContext";
import { TalkStage } from "@/components/session/TalkStage";
import { ThemeRoot } from "@/components/session/ThemeRoot";
import { TopBar } from "@/components/session/TopBar";
import { signInWithGoogle, useAuth } from "@/lib/auth";
import { useCampaign } from "@/lib/useCampaign";

export default function CampaignPage() {
  const { cid } = useParams<{ cid: string }>();
  const { user, loading } = useAuth();
  const state = useCampaign(cid, user?.uid);

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

  return (
    <SessionProvider cid={cid} user={user} campaign={state.campaign} members={state.members} characters={state.characters}>
      <ThemeRoot>
        <SessionLayout />
      </ThemeRoot>
    </SessionProvider>
  );
}

//  ┌ 위 띠: 캠페인·모드 탭·테마·연출·기록 ─────────────────────┐
//  │ 무대 (대화: 비주얼노벨 / 전투: 그리드)      │ 기록 (접기 가능) │
//  └ 아래 띠: 파티 얼굴 + 화자 고르기·입력 ───────────────────┘
function SessionLayout() {
  const { scene, isGM } = useSession();
  const [director, setDirector] = useState(false);
  const [logOpen, setLogOpen] = useState(true);

  return (
    <div className="flex h-full flex-col">
      <TopBar directorOpen={director} onDirector={() => setDirector((v) => !v)} logOpen={logOpen} onLog={() => setLogOpen((v) => !v)} />
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          {scene.mode === "battle" ? <BattleStage /> : <TalkStage />}
          {isGM && director && <DirectorPanel onClose={() => setDirector(false)} />}
        </main>
        {logOpen && (
          <aside className="hidden w-[360px] shrink-0 border-l border-line bg-panel/85 backdrop-blur md:block">
            <ChatLog />
          </aside>
        )}
      </div>
      {/* 좁은 화면에서는 기록이 무대 아래로 */}
      {logOpen && (
        <div className="h-[34vh] border-t border-line bg-panel/90 md:hidden">
          <ChatLog />
        </div>
      )}
      <footer className="flex flex-col gap-2 border-t border-line bg-panel/90 px-3 py-2 backdrop-blur lg:flex-row lg:items-end">
        <PartyBar />
        <ChatInput />
      </footer>
      <PhaseCutin />
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center p-6 text-center text-muted">{children}</main>;
}
