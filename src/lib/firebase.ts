"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

// 역할 분담
// - Firestore: 캠페인·멤버·캐릭터(시트 사본 + 현재 HP/MP/페이트) — 양이 적고 구조가 있는 데이터
// - Realtime DB: 채팅·주사위 — 자주 쓰고 자주 읽는 데이터 (전송량 기준 과금이라 무료 한도에 유리)

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "1";
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-trpg-vtt";

const app = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "demo-key",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
      projectId,
      databaseURL:
        process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ??
        // 에뮬레이터는 database.rules.json 을 "<프로젝트ID>-default-rtdb" 이름공간에만 적용한다
        (useEmulators ? `http://127.0.0.1:9000?ns=${projectId}-default-rtdb` : undefined),
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });

// 로그인 유지: 브라우저를 껐다 켜도 그대로 (IndexedDB, 안 되면 localStorage)
function makeAuth(): Auth {
  if (typeof window === "undefined") return getAuth(app); // 서버 미리 그리기에는 브라우저 저장소가 없다
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(app); // 개발 중 핫 리로드로 이미 만들어져 있을 때
  }
}

export const auth = makeAuth();
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

if (useEmulators && !(globalThis as { __emu?: boolean }).__emu) {
  (globalThis as { __emu?: boolean }).__emu = true;
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectDatabaseEmulator(rtdb, "127.0.0.1", 9000);
}
