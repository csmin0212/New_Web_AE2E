import "server-only";

import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

// Firebase 로그인 토큰 검증 (firebase-admin 없이 jose 로).
// 에뮬레이터 토큰은 서명이 없으므로 에뮬레이터 모드에서만 서명 검사를 건너뛴다.

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export async function verifyIdToken(token: string): Promise<{ uid: string } | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId || !token) return null;

  try {
    if (process.env.NEXT_PUBLIC_USE_EMULATORS === "1" && process.env.NODE_ENV !== "production") {
      const claims = decodeJwt(token);
      return typeof claims.sub === "string" && claims.aud === projectId ? { uid: claims.sub } : null;
    }
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    return typeof payload.sub === "string" && payload.sub ? { uid: payload.sub } : null;
  } catch {
    return null;
  }
}
