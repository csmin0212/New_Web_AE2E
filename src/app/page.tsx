"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logOut, signInAsTestUser, signInWithGoogle, useAuth, USING_EMULATORS } from "@/lib/auth";
import { createCampaign, joinCampaign } from "@/lib/campaigns";
import { db } from "@/lib/firebase";
import type { Role } from "@/lib/types";

type MyCampaign = { id: string; name: string; role: Role };

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<MyCampaign[]>([]);
  const [newName, setNewName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "campaigns"), orderBy("joinedAt", "desc"));
    return onSnapshot(q, (snap) =>
      setCampaigns(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MyCampaign, "id">) }))),
    );
  }, [user]);

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setError(null);
    try {
      router.push(`/c/${await fn()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "문제가 생겼어요.");
      setBusy(false);
    }
  }

  if (loading) return <main className="grid min-h-screen place-items-center text-muted">불러오는 중…</main>;

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-sm rounded-xl border border-line bg-panel p-8 text-center">
          <h1 className="text-xl font-bold">TRPG 세션 툴</h1>
          <p className="mt-2 text-sm text-muted">아리안로드 2E 캠페인용</p>
          <button className="btn-primary mt-6 w-full" onClick={() => signInWithGoogle()}>
            구글로 로그인
          </button>
          {USING_EMULATORS && (
            <div className="mt-6 border-t border-line pt-4 text-left">
              <p className="text-xs text-muted">에뮬레이터 테스트 계정</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["GM 테스트", "플레이어A", "플레이어B"].map((n) => (
                  <button key={n} className="btn text-xs" onClick={() => signInAsTestUser(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">내 캠페인</h1>
        <div className="flex items-center gap-3 text-sm text-muted">
          {user.displayName}
          <button className="btn" onClick={() => logOut()}>
            로그아웃
          </button>
        </div>
      </header>

      <ul className="mt-6 space-y-2">
        {campaigns.length === 0 && <li className="text-sm text-muted">아직 참가한 캠페인이 없어요.</li>}
        {campaigns.map((c) => (
          <li key={c.id}>
            <Link
              href={`/c/${c.id}`}
              className="flex items-center justify-between rounded-lg border border-line bg-panel px-4 py-3 hover:border-accent/60"
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-muted">{c.role === "gm" ? "GM" : "플레이어"}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <form
          className="rounded-lg border border-line bg-panel p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) run(() => createCampaign(user, newName.trim()));
          }}
        >
          <h2 className="text-sm font-semibold">새 캠페인 (GM)</h2>
          <input className="input mt-3" placeholder="예: 이상동몽" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="btn-primary mt-3 w-full" disabled={busy || !newName.trim()}>
            만들기
          </button>
        </form>
        <form
          className="rounded-lg border border-line bg-panel p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) run(() => joinCampaign(user, code));
          }}
        >
          <h2 className="text-sm font-semibold">초대 코드로 참가</h2>
          <input
            className="input mt-3 uppercase tracking-widest"
            placeholder="ABC123"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn mt-3 w-full" disabled={busy || code.trim().length < 6}>
            참가하기
          </button>
        </form>
      </section>
      {error && <p className="mt-4 text-sm text-hp">{error}</p>}
    </main>
  );
}
