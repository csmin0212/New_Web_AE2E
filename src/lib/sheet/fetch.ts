import "server-only";

import { SignJWT, importPKCS8 } from "jose";
import { isCharacterSheetGrid, parseCsv, parseSheetGrid, type ParsedSheet } from "./parse";

// 시트 읽기 순서:
// 1) 서비스 계정(GOOGLE_SERVICE_ACCOUNT_JSON)이 있으면 Sheets API — 비공개 시트도 읽힘
// 2) 없거나 실패하면 공개 CSV(gviz) — 시트가 "링크가 있는 모든 사용자 보기"여야 함

type ServiceAccount = { client_email: string; private_key: string };

let tokenCache: { token: string; expiresAt: number } | null = null;

function credentials(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

async function accessToken(): Promise<string | null> {
  const sa = credentials();
  if (!sa) return null;

  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt - 60 > now) return tokenCache.token;

  const key = await importPKCS8(sa.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/spreadsheets.readonly" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  tokenCache = { token: data.access_token, expiresAt: now + (data.expires_in ?? 3600) };
  return tokenCache.token;
}

function quoteSheet(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

async function fetchByApi(sheetId: string, tab: string): Promise<string[][] | null> {
  const token = await accessToken();
  if (!token) return null;
  // 스킬란(B65:D104, B144:D181)까지 포함해야 하므로 181행까지 읽는다
  const range = `${quoteSheet(tab)}!A1:AK181`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

class SheetError extends Error {}

async function fetchByCsv(sheetId: string, tab: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  if (!res.ok) throw new SheetError("시트를 불러오지 못했어요. 시트 ID를 확인해주세요.");
  const text = await res.text();
  if (/google\.visualization\.Query|"status":"error"/.test(text)) {
    throw new SheetError(`'${tab}' 탭을 찾지 못했어요. 시트 하단의 탭 이름과 똑같이 입력해주세요.`);
  }
  if (/^\s*<(!doctype|html)/i.test(text)) {
    throw new SheetError("시트가 비공개예요. '링크가 있는 모든 사용자 보기'로 공유하거나 서비스 계정을 설정해주세요.");
  }
  return parseCsv(text);
}

export async function fetchCharacterSheet(sheetId: string, tab: string): Promise<ParsedSheet> {
  const apiGrid = await fetchByApi(sheetId, tab).catch(() => null);
  if (apiGrid && isCharacterSheetGrid(apiGrid)) return parseSheetGrid(apiGrid, tab, sheetId);

  const csvGrid = await fetchByCsv(sheetId, tab);
  if (!isCharacterSheetGrid(csvGrid)) {
    throw new SheetError(`'${tab}' 탭에서 캐릭터 정보를 찾지 못했어요. 탭 이름을 확인해주세요.`);
  }
  return parseSheetGrid(csvGrid, tab, sheetId);
}

export { SheetError };
