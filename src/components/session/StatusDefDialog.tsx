"use client";

import { ref, remove, set } from "firebase/database";
import { useState } from "react";
import { CLEAR_LABEL, type BsClear, type BsDef } from "@/lib/battleRules";
import { rtdb } from "@/lib/firebase";
import { Modal } from "./EditDialogs";
import { useSession } from "./SessionContext";

// GM: 상태 이상·버프 직접 만들기 (기본 BS 11종 밖의 것 — 서플리먼트 BS, 버프, 캠페인 전용 효과)
export function StatusDefDialog({ onClose }: { onClose: () => void }) {
  const { cid, battle } = useSession();
  const [d, setD] = useState<Omit<BsDef, "id">>({ label: "", color: "#4fa3c9", hint: "" });
  const custom = Object.entries(battle.statusDefs);

  async function save() {
    if (!d.label.trim()) return;
    const id = `x${Date.now().toString(36)}`;
    await set(ref(rtdb, `battle/${cid}/statusDefs/${id}`), JSON.parse(JSON.stringify({ ...d, label: d.label.trim() })));
    setD({ label: "", color: d.color, hint: "" });
  }

  return (
    <Modal title="상태 이상 · 버프 만들기" onClose={onClose} width={440}>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="block">
            <span className="text-xs text-muted">이름</span>
            <input className="input mt-0.5" value={d.label} placeholder="예: 마비, 공격력 상승" autoFocus onChange={(e) => setD({ ...d, label: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs text-muted">색</span>
            <input type="color" className="mt-0.5 h-8 w-12 cursor-pointer bg-transparent" value={d.color} onChange={(e) => setD({ ...d, color: e.target.value })} />
          </label>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={!!d.strength} onChange={(e) => setD({ ...d, strength: e.target.checked || undefined })} />
            강도가 있다 (걸 때 숫자를 묻는다)
          </label>
          <label className="flex items-center gap-1">
            풀리는 때
            <select className="input w-auto py-0 text-xs" value={d.clear ?? ""} onChange={(e) => setD({ ...d, clear: (e.target.value || undefined) as BsDef["clear"] })}>
              <option value="">직접 풀기 (액션·회복 스킬)</option>
              {(Object.keys(CLEAR_LABEL) as BsClear[]).map((k) => (
                <option key={k} value={k}>
                  {CLEAR_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-muted">효과 설명 (토큰에 마우스를 올리면 보여요)</span>
          <input className="input mt-0.5" value={d.hint} placeholder="메이저 액션 판정 −1D" onChange={(e) => setD({ ...d, hint: e.target.value })} />
        </label>
        <div className="flex justify-end">
          <button className="btn-primary" disabled={!d.label.trim()} onClick={save}>
            <span>+ 만들기</span>
          </button>
        </div>

        {custom.length > 0 && (
          <div className="border-t border-line pt-2">
            <div className="mb-1 text-xs font-bold">만든 상태</div>
            <ul className="space-y-1">
              {custom.map(([id, x]) => (
                <li key={id} className="flex items-center gap-2 text-xs">
                  <span className="h-3 w-3 rounded-full" style={{ background: x.color }} />
                  <b>{x.label}</b>
                  <span className="truncate text-muted">{x.hint}</span>
                  <button className="ml-auto text-muted hover:text-hp" onClick={() => remove(ref(rtdb, `battle/${cid}/statusDefs/${id}`))} aria-label={`${x.label} 지우기`}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
