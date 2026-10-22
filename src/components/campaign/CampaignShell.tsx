"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { LoginButton } from "@/components/LoginButton";
import { SessionProvider, useSession } from "@/components/session/SessionContext";
import { ThemeRoot } from "@/components/session/ThemeRoot";
import { useAuth } from "@/lib/auth";
import { useCampaign } from "@/lib/useCampaign";

// 세션 밖 캠페인 페이지(저널·등장인물·지역 도감)의 공통 틀 — 로그인 확인, 캠페인 테마, 위 띠 탭
export type CampaignTab = "journal" | "cast" | "atlas";

const TABS: { id: CampaignTab; label: string; en: string }[] = [
  { id: "journal", label: "핸드아웃·저널", en: "JOURNAL" },
  { id: "cast", label: "등장인물", en: "DRAMATIS PERSONAE" },
  { id: "atlas", label: "지역 도감", en: "ATLAS" },
];

export function CampaignShell({ active, children }: { active: CampaignTab; children: ReactNode }) {
  const { cid } = useParams<{ cid: string }>();
  const { user, loading } = useAuth();
  const state = useCampaign(cid, user?.uid);

  if (loading) return <Center>불러오는 중…</Center>;
  if (!user)
    return (
      <Center>
        <LoginButton className="w-72" />
      </Center>
    );
  if (state.status === "denied")
    return (
      <Center>
        <p>이 캠페인에 참가하지 않았거나 없는 캠페인이에요.</p>
        <Link href="/" className="btn mt-4">
          홈으로
        </Link>
      </Center>
    );
  if (state.status === "loading") return <Center>불러오는 중…</Center>;

  return (
    <SessionProvider cid={cid} user={user} campaign={state.campaign} members={state.members} characters={state.characters}>
      <ThemeRoot>
        <div className="flex h-dvh flex-col" style={{ background: "var(--art-page, none) center / cover fixed, var(--pattern), var(--bg)" }}>
          <ShellHeader active={active} />
          <div className="min-h-0 flex-1">{children}</div>
        </div>
      </ThemeRoot>
    </SessionProvider>
  );
}

function ShellHeader({ active }: { active: CampaignTab }) {
  const { cid, campaign } = useSession();
  const tab = TABS.find((t) => t.id === active)!;
  return (
    <header className="relative z-20 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-panel/90 px-3 py-2">
      <Link href={`/c/${cid}`} className="btn h-8 text-xs">
        <span>← 세션으로</span>
      </Link>
      <div className="leading-tight">
        <div className="font-display font-bold">{campaign.name}</div>
        <div className="font-latin text-[10px] text-accent">{tab.en}</div>
      </div>
      <nav className="ml-auto flex gap-1" aria-label="캠페인 자료">
        {TABS.map((t) => (
          <Link key={t.id} href={`/c/${cid}/${t.id}`} className={`${t.id === active ? "btn-primary" : "btn"} h-8 text-xs`} aria-current={t.id === active ? "page" : undefined}>
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <main className="grid min-h-screen place-items-center p-6 text-center text-muted">{children}</main>;
}
