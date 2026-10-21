"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fetchJournal, subscribeShow, type JournalEntry } from "@/lib/journal";
import { JournalView } from "../JournalView";
import { Modal } from "./EditDialogs";
import { useSession } from "./SessionContext";

// GM 이 저널에서 ‘보여주기’를 누르면 모두의 세션 화면에 핸드아웃이 뜬다
export function HandoutPopup() {
  const { cid } = useSession();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const seen = useRef<number | null>(null);

  useEffect(
    () =>
      subscribeShow(cid, (s) => {
        // 들어올 때 이미 있던 값은 지나간 것 — 그다음에 바뀐 것만 띄운다
        if (seen.current === null) {
          seen.current = s?.at ?? 0;
          return;
        }
        if (!s || s.at === seen.current) return;
        seen.current = s.at;
        fetchJournal(cid, s.id)
          .then((e) => e && setEntry(e))
          .catch(() => {});
      }),
    [cid],
  );

  if (!entry) return null;
  return (
    <Modal title="📣 핸드아웃" onClose={() => setEntry(null)} width={640}>
      <JournalView entry={entry} />
      <div className="mt-4 flex justify-end gap-2">
        <Link href={`/c/${cid}/journal#${entry.id}`} target="_blank" className="btn text-xs">
          <span>저널에서 열기 ↗</span>
        </Link>
        <button className="btn-primary text-xs" onClick={() => setEntry(null)}>
          <span>확인</span>
        </button>
      </div>
    </Modal>
  );
}
