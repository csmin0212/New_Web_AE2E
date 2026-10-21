"use client";

import { useEffect, useRef } from "react";
import { processEffect, subscribeEffects, syncConditions } from "@/lib/battle";
import { useSession } from "./SessionContext";

// GM 화면에서만 도는 자동 처리 (화면에는 아무것도 그리지 않는다)
//   · 플레이어가 에너미·남의 캐릭터에게 보낸 대미지·회복 요청을 적용
//   · 에너미 토큰에 부상·전투불능 표시를 붙인다
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

  return null;
}
