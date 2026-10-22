"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

// 맨 바깥(레이아웃)까지 깨졌을 때 — html·body 를 직접 그린다
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>
        <title>TRPG 세션 툴 — 오류</title>
        <ErrorScreen error={error} retry={unstable_retry} />
      </body>
    </html>
  );
}
