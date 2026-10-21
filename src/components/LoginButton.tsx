"use client";

import { useState } from "react";
import { forgetLastAccount, readLastAccount, signInWithGoogle, type LastAccount } from "@/lib/auth";

// 로그인 버튼 — 전에 쓴 계정이 있으면 "○○로 계속하기" 한 번으로 들어온다
export function LoginButton({ className = "" }: { className?: string }) {
  const [last, setLast] = useState<LastAccount | null>(() => (typeof window === "undefined" ? null : readLastAccount()));
  const [error, setError] = useState<string | null>(null);

  async function go(hint?: string) {
    setError(null);
    try {
      await signInWithGoogle(hint);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인하지 못했어요.");
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {last ? (
        <>
          <button className="btn-primary w-full justify-start gap-3 py-2" onClick={() => go(last.email)}>
            {last.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={last.photo} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-black/20">{last.name.slice(0, 1)}</span>
            )}
            <span className="min-w-0 text-left leading-tight">
              <span className="block truncate">{last.name}(으)로 계속하기</span>
              <span className="block truncate text-[11px] font-normal opacity-75">{last.email}</span>
            </span>
          </button>
          <button
            className="w-full text-center text-xs text-muted hover:text-text"
            onClick={() => {
              forgetLastAccount();
              setLast(null);
              go();
            }}
          >
            다른 구글 계정으로 로그인
          </button>
        </>
      ) : (
        <button className="btn-primary w-full" onClick={() => go()}>
          <span>구글로 로그인</span>
        </button>
      )}
      {error && <p className="text-xs text-hp">{error}</p>}
    </div>
  );
}
