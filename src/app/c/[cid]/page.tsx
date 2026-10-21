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
import { ResizeHandle, useResizable } from "@/components/session/Resizable";
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
  const log = useResizable("log", 360, 260, 720);

  return (
    <div className="flex h-full flex-col">
      <TopBar directorOpen={director} onDirector={() => setDirector((v) => !v)} logOpen={logOpen} onLog={() => setLogOpen((v) => !v)} />
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          {scene.mode === "battle" ? <BattleStage /> : <TalkStage />}
          {isGM && director && <DirectorPanel onClose={() => setDirector(false)} />}
        </main>
        {logOpen && (
          <aside className="relative hidden shrink-0 border-l border-line bg-panel/85 md:block" style={{ width: log.size }}>
            <ResizeHandle side="left" label="기록" {...log} />
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
      {/* 위에 뜨는 시트 창이 무대에 가리지 않게 아래 띠를 무대보다 위 층에 둔다 (blur 는 쓰지 않음: 고정 위치 창을 이 띠 안에 가둬 버림) */}
      <footer className="relative z-20 flex flex-col gap-2 border-t border-line bg-panel px-3 py-2 lg:flex-row lg:items-end">
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
