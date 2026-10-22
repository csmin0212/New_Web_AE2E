"use client";

import { useEffect } from "react";

// 화면이 깨졌을 때 — 새 배포 직후 옛 스크립트를 못 찾은 경우면 한 번 저절로 새로 고친다.
// 그 밖의 오류는 무엇이 문제인지 보여 준다 (알려 주면 고치기 쉽게).
const RELOAD_KEY = "vtt:auto-reloaded-at";

export function isStaleBuildError(e: { name?: string; message?: string }) {
  const m = `${e.name ?? ""} ${e.message ?? ""}`;
  return /ChunkLoadError|Loading (CSS )?chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(m);
}

export function ErrorScreen({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const stale = isStaleBuildError(error);

  useEffect(() => {
    console.error(error);
    if (!stale) return;
    // 1분 안에 이미 한 번 새로 고쳤으면 또 하지 않는다 (무한 새로 고침 방지)
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
      if (Date.now() - last < 60_000) return;
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {}
    window.location.reload();
  }, [error, stale]);

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#0d0b09", color: "#efe4cc", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <div style={{ fontSize: 34 }}>⚠</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "8px 0" }}>{stale ? "새 버전이 올라와서 다시 불러오는 중이에요" : "화면을 그리다가 문제가 생겼어요"}</h1>
        <p style={{ fontSize: 14, opacity: 0.75 }}>{stale ? "잠시만요. 저절로 새로 고쳐지지 않으면 아래 버튼을 눌러 주세요." : "새로 고치면 대부분 풀려요. 계속되면 아래 오류 내용을 알려 주세요."}</p>
        {!stale && (
          <pre style={{ marginTop: 12, padding: 10, borderRadius: 6, background: "#1d1610", fontSize: 12, textAlign: "left", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 160, overflow: "auto" }}>
            {error.message || "알 수 없는 오류"}
            {error.digest ? `\n(digest ${error.digest})` : ""}
          </pre>
        )}
        <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={() => window.location.reload()} style={{ padding: "8px 16px", borderRadius: 6, background: "#c9a45c", color: "#1a1206", fontWeight: 700, border: 0, cursor: "pointer" }}>
            새로 고침
          </button>
          {!stale && (
            <button onClick={retry} style={{ padding: "8px 16px", borderRadius: 6, background: "transparent", color: "#efe4cc", border: "1px solid #4a3a26", cursor: "pointer" }}>
              다시 시도
            </button>
          )}
          {/* 깨진 화면에서는 앱 안 이동 대신 완전히 새로 불러온다 */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ padding: "8px 16px", borderRadius: 6, color: "#efe4cc", border: "1px solid #4a3a26", textDecoration: "none" }}>
            홈으로
          </a>
        </div>
      </div>
    </main>
  );
}
