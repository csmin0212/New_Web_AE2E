"use client";

import { useEffect, useRef } from "react";
import { clearStunOnTurn, processEffect, runCleanup, subscribeEffects, syncConditions } from "@/lib/battle";
import { deleteReveal, updateCharacter, writeReveal } from "@/lib/campaigns";
import { buildRevealDoc, REVEAL_DEFAULT, sameDoc } from "@/lib/reveal";
import { useSession } from "./SessionContext";

// GM 화면에서만 도는 자동 처리 (화면에는 아무것도 그리지 않는다)
//   · 플레이어가 에너미·남의 캐릭터에게 보낸 대미지·회복 요청을 적용
//   · 에너미 토큰에 부상·전투불능 표시를 붙인다
//   · 라운드가 넘어가면 클린업 (BS 해제·독), 차례가 오면 스턴 해제
//   · 비공개 캐릭터의 「플레이어 공개 본」을 만들고 HP 가 바뀌면 고친다
export function GmAutomation() {
  const { cid, user, campaign, battle, characters, reveals } = useSession();
  const busy = useRef(new Set<string>());

  useEffect(
    () =>
      subscribeEffects(cid, (list) => {
        for (const [id, req] of list) {
          if (busy.current.has(id)) continue;
          busy.current.add(id);
          processEffect({ cid, uid: user.uid, gmUid: campaign.gmUid }, id, req)
            .catch((e) => console.error("효과 적용 실패", e))
            .finally(() => busy.current.delete(id));
        }
      }),
    [cid, user.uid, campaign.gmUid],
  );

  useEffect(() => {
    syncConditions(cid, battle.tokens, characters)?.catch((e) => console.error("상태 표시 실패", e));
  }, [cid, battle.tokens, characters]);

  // 예전 캐릭터에는 공개 여부(hidden) 칸이 없다 → 채워 둔다 (에너미는 비공개, 나머지는 공개).
  // 이 칸이 있어야 플레이어 화면이 읽을 수 있다
  useEffect(() => {
    for (const c of characters) {
      if (typeof c.hidden !== "boolean") updateCharacter(cid, c.id, { hidden: c.kind === "enemy" }).catch(() => {});
    }
  }, [cid, characters]);

  // 공개 본 맞추기 — 비공개면 고른 항목만, 공개로 돌렸으면 지운다. 같으면 쓰지 않는다
  useEffect(() => {
    const ids = new Set(characters.map((c) => c.id));
    for (const c of characters) {
      if (c.hidden) {
        const next = buildRevealDoc(c, c.reveal ?? REVEAL_DEFAULT);
        if (!sameDoc(next, reveals[c.id])) writeReveal(cid, next).catch((e) => console.error("공개 본 쓰기 실패", e));
      } else if (reveals[c.id]) deleteReveal(cid, c.id).catch(() => {});
    }
    // 캠페인에서 빠진 캐릭터의 공개 본도 치운다
    for (const id of Object.keys(reveals)) if (!ids.has(id) && characters.length) deleteReveal(cid, id).catch(() => {});
  }, [cid, characters, reveals]);

  // 처음 본 값은 기준으로만 삼고, 그다음 바뀐 것에만 반응한다 (들어오자마자 지난 라운드를 다시 처리하지 않게)
  const seenRound = useRef<number | null>(null);
  const seenActor = useRef<string | null | undefined>(undefined);
  const { round, actor } = battle.turn;
  const loaded = !!battle.loaded;
  useEffect(() => {
    if (!loaded) return;
    const prev = seenRound.current;
    seenRound.current = round;
    if (prev != null && round > prev) {
      runCleanup({ cid, uid: user.uid, gmUid: campaign.gmUid }, round, battle).catch((e) => console.error("클린업 실패", e));
    }
    // battle 은 라운드가 바뀐 순간의 것만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, loaded, cid, user.uid, campaign.gmUid]);
  useEffect(() => {
    if (!loaded) return;
    const prev = seenActor.current;
    seenActor.current = actor;
    if (prev !== undefined && actor && actor !== prev) clearStunOnTurn(cid, actor, battle.tokens[actor]?.status).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, loaded, cid]);

  return null;
}
