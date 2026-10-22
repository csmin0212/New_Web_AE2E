"use client";

import Link from "next/link";
import { useState } from "react";
import { PHASES, updateScene } from "@/lib/scene";
import { THEMES, type ThemeId } from "@/lib/themes";
import { useSession } from "./SessionContext";
import { useThemeControl } from "./ThemeRoot";

export function TopBar({
  directorOpen,
  onDirector,
  logOpen,
  onLog,
}: {
  directorOpen: boolean;
  onDirector: () => void;
  logOpen: boolean;
  onLog: () => void;
}) {
  const { campaign, scene, isGM, cid, members } = useSession();
  const { override, setOverride } = useThemeControl();
  const [copied, setCopied] = useState(false);
  const phase = PHASES.find((p) => p.id === scene.phase);

  return (
    <header className="relative z-30 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-panel/90 px-3 py-1.5 backdrop-blur">
      <Link href="/" className="text-muted hover:text-text" aria-label="홈으로">
        ←
      </Link>
      <div className="leading-tight">
        <div className="font-display text-base font-bold">{campaign.name}</div>
        <div className="font-latin text-[10px] text-accent">{phase?.en}</div>
      </div>

      {/* 대화 / 전투 탭 */}
      <nav className="ml-2 flex gap-1" aria-label="모드">
        {(["talk", "battle"] as const).map((m) => {
          const on = scene.mode === m;
          return (
            <button
              key={m}
              disabled={!isGM && !on}
              onClick={() => isGM && updateScene(cid, { mode: m })}
              className={`${on ? "btn-primary" : "btn"} min-w-16 disabled:opacity-30`}
              title={isGM ? undefined : "모드는 GM이 바꿔요"}
            >
              <span>{m === "talk" ? "대화" : "전투"}</span>
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        {isGM ? (
          // GM: 고르면 캠페인 테마가 바뀌어 모두의 화면에 적용된다
          <select
            className="input h-8 w-auto py-0 text-xs"
            value={scene.theme}
            onChange={(e) => {
              updateScene(cid, { theme: e.target.value as ThemeId });
              setOverride(null);
            }}
            aria-label="캠페인 테마"
            title="모두의 화면 테마를 바꿔요"
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                테마: {t.name} (모두에게)
              </option>
            ))}
          </select>
        ) : (
          // 플레이어: GM 테마를 따르거나, 내 화면에서만 다른 테마로
          <select
            className="input h-8 w-auto py-0 text-xs"
            value={override ?? ""}
            onChange={(e) => setOverride((e.target.value || null) as ThemeId | null)}
            aria-label="내 화면 테마"
            title="내 화면에서만 테마를 바꿔 봐요"
          >
            <option value="">테마: GM 설정 따르기</option>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (내 화면만)
              </option>
            ))}
          </select>
        )}
        <span className="hidden text-xs text-muted sm:inline">{members.length}명</span>
        {isGM && (
          <button
            className="btn h-8 text-xs"
            title="클릭해서 복사"
            onClick={() => {
              navigator.clipboard?.writeText(campaign.inviteCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <span>
              초대 <b className="tracking-widest text-accent">{campaign.inviteCode}</b>
              {copied && " ✓"}
            </span>
          </button>
        )}
        {isGM && (
          <button className={`${directorOpen ? "btn-primary" : "btn"} h-8 text-xs`} onClick={onDirector}>
            <span>연출</span>
          </button>
        )}
        <Link href={`/c/${cid}/journal`} target="_blank" className="btn h-8 text-xs" title="핸드아웃·저널·등장인물·지역 도감 (새 탭)">
          <span>자료 ↗</span>
        </Link>
        <button className={`${logOpen ? "btn-primary" : "btn"} h-8 text-xs`} onClick={onLog}>
          <span>기록</span>
        </button>
      </div>
    </header>
  );
}
