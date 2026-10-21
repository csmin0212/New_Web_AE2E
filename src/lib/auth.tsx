"use client";

import {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  useEffect(() => onAuthStateChanged(auth, (user) => setState({ user, loading: false })), []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

// 팝업이 막히면(모바일·인앱 브라우저 등) 페이지 이동 방식으로 다시 시도
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
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
