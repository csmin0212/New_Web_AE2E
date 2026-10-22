"use client";

import { useEffect, useRef } from "react";
import { clearStunOnTurn, processEffect, runCleanup, subscribeEffects, syncConditions } from "@/lib/battle";
import { useSession } from "./SessionContext";

// GM 화면에서만 도는 자동 처리 (화면에는 아무것도 그리지 않는다)
//   · 플레이어가 에너미·남의 캐릭터에게 보낸 대미지·회복 요청을 적용
//   · 에너미 토큰에 부상·전투불능 표시를 붙인다
//   · 라운드가 넘어가면 클린업 (BS 해제·독), 차례가 오면 스턴 해제
export function GmAutomation() {
  const { cid, user, campaign, battle, characters } = useSession();
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
