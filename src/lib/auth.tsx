"use client";

import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth } from "./firebase";

type AuthState = { user: User | null; loading: boolean };

const AuthContext = createContext<AuthState>({ user: null, loading: true });

// 마지막으로 쓴 구글 계정 — 다음에 들어올 때 "○○로 계속하기" 한 번이면 끝나게
const LAST_KEY = "trpg-vtt:last-account";
export type LastAccount = { email: string; name: string; photo?: string };

export function readLastAccount(): LastAccount | null {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) ?? "null") as LastAccount | null;
  } catch {
    return null;
  }
}
export function forgetLastAccount() {
  try {
    localStorage.removeItem(LAST_KEY);
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  useEffect(() => {
    getRedirectResult(auth).catch(() => {}); // 페이지 이동 방식 로그인에서 돌아온 경우
    return onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        try {
          localStorage.setItem(LAST_KEY, JSON.stringify({ email: user.email, name: user.displayName ?? user.email, photo: user.photoURL ?? undefined }));
        } catch {}
      }
      setState({ user, loading: false });
    });
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

// 팝업이 막히면(모바일·인앱 브라우저 등) 페이지 이동 방식으로 다시 시도
export async function signInWithGoogle(hint?: string) {
  const provider = new GoogleAuthProvider();
  // 계정을 알면 고르는 창을 건너뛴다. 모르면 매번 고르게 한다
  provider.setCustomParameters(hint ? { login_hint: hint } : { prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
      return;
    }
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
    throw e;
  }
}

// 에뮬레이터 전용: 팝업 없이 가짜 구글 계정으로 로그인 (여러 명 테스트용)
export const USING_EMULATORS = process.env.NEXT_PUBLIC_USE_EMULATORS === "1";

export async function signInAsTestUser(name: string) {
  if (!USING_EMULATORS) throw new Error("에뮬레이터 모드에서만 쓸 수 있어요.");
  const sub = `test-${encodeURIComponent(name)}`;
  const fakeIdToken = JSON.stringify({ sub, email: `${sub}@example.test`, email_verified: true, name });
  const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(fakeIdToken));
  if (cred.user.displayName !== name) await updateProfile(cred.user, { displayName: name });
  return cred;
}

export function logOut() {
  return signOut(auth);
}
