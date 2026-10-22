"use client";

import { useState } from "react";
import { updateCharacter } from "@/lib/campaigns";
import { buildRevealDoc, HP_VIEW_LABEL, REVEAL_DEFAULT, REVEAL_IDENTIFIED, REVEAL_NOTHING, type HpView, type RevealConfig } from "@/lib/reveal";
import type { Character } from "@/lib/types";
import { Modal } from "./EditDialogs";
import { RevealView } from "./RevealView";
import { useSession } from "./SessionContext";

// GM: 이 캐릭터의 무엇을 플레이어에게 보여 줄지
//   시트 전부 공개 — 플레이어가 시트를 그대로 본다
//   골라서 공개   — 시트는 GM 만, 고른 항목만 담은 공개 본이 플레이어에게 간다
export function RevealDialog({ character: c, onClose }: { character: Character; onClose: () => void }) {
  const { cid } = useSession();
  const [hidden, setHidden] = useState(c.hidden ?? c.kind === "enemy");
  const [cfg, setCfg] = useState<RevealConfig>(c.reveal ?? REVEAL_DEFAULT);
  const [busy, setBusy] = useState(false);
  const skills = c.ar?.skills ?? [];
  const up = (patch: Partial<RevealConfig>) => setCfg((x) => ({ ...x, ...patch }));
  const picked = (id: string) => cfg.skills === "all" || (Array.isArray(cfg.skills) && cfg.skills.includes(id));

  async function save() {
    setBusy(true);
    try {
      await updateCharacter(cid, c.id, { hidden, reveal: JSON.parse(JSON.stringify(cfg)) as RevealConfig });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const check = (k: keyof RevealConfig, label: string, hint?: string) => (
    <label className="flex items-center gap-1.5" title={hint}>
      <input type="checkbox" checked={!!cfg[k]} onChange={(e) => up({ [k]: e.target.checked } as Partial<RevealConfig>)} />
      {label}
    </label>
  );

  return (
    <Modal title={`${c.sheet.name} · 플레이어에게 보여 줄 정보`} onClose={onClose} width={820}>
      <div className="grid gap-4 text-sm md:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <div className="flex overflow-hidden rounded-md border border-line">
            {(
              [
                [false, "시트 전부 공개", "플레이어가 시트를 그대로 봐요"],
                [true, "골라서 공개", "시트는 GM만, 고른 것만 보여요"],
              ] as const
            ).map(([v, label, hint]) => (
              <button key={label} className={`flex-1 px-3 py-2 text-left ${hidden === v ? "bg-accent text-accent-ink" : "bg-panel-2"}`} onClick={() => setHidden(v)}>
                <div className="font-bold">{label}</div>
                <div className={`text-[11px] ${hidden === v ? "opacity-80" : "text-muted"}`}>{hint}</div>
              </button>
            ))}
          </div>

          {hidden && (
            <>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <button className="btn-primary px-2 py-1 text-xs" onClick={() => setCfg({ ...REVEAL_IDENTIFIED, note: cfg.note })} title="아리안로드: 식별에 성공하면 데이터가 공개된다">
                  <span>🔍 에너미 식별 성공 — 전부</span>
                </button>
                <button className="btn px-2 py-1 text-xs" onClick={() => setCfg({ ...REVEAL_DEFAULT, note: cfg.note })}>
                  <span>기본 (이름·그림·상태)</span>
                </button>
                <button className="btn px-2 py-1 text-xs" onClick={() => setCfg({ ...REVEAL_NOTHING })}>
                  <span>아무것도 (존재도 숨김)</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded border border-line p-2 text-xs sm:grid-cols-3">
                {check("listed", "NPC 목록에 보이기", "꺼 두면 플레이어 목록에 아예 안 나와요 (전투 토큰은 따로)")}
                {check("name", "이름", "꺼 두면 「???」")}
                {check("image", "그림")}
                {check("profile", "레벨·분류·속성")}
                {check("stats", "능력치")}
                {check("combat", "전투 수치", "명중·회피·대미지·행동치·이동력·방어")}
                {check("mp", "MP")}
                {check("drops", "드롭품")}
                <label className="col-span-2 flex items-center gap-1.5 sm:col-span-1">
                  HP
                  <select className="input w-auto py-0 text-xs" value={cfg.hp} onChange={(e) => up({ hp: e.target.value as HpView })}>
                    {(Object.keys(HP_VIEW_LABEL) as HpView[]).map((k) => (
                      <option key={k} value={k}>
                        {HP_VIEW_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {skills.length > 0 && (
                <div className="rounded border border-line p-2 text-xs">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-bold">스킬</span>
                    <span className="text-muted">{cfg.skills === "all" ? "전부" : Array.isArray(cfg.skills) ? `${cfg.skills.length}개` : "없음"}</span>
                    <button className="btn ml-auto px-1.5 py-0 text-[11px]" onClick={() => up({ skills: "all" })}>
                      <span>전부</span>
                    </button>
                    <button className="btn px-1.5 py-0 text-[11px]" onClick={() => up({ skills: "none" })}>
                      <span>없음</span>
                    </button>
                  </div>
                  <div className="grid max-h-40 grid-cols-1 gap-0.5 overflow-y-auto sm:grid-cols-2">
                    {skills.map((s) => (
                      <label key={s.id} className="flex items-center gap-1.5 truncate">
                        <input
                          type="checkbox"
                          checked={picked(s.id)}
                          onChange={(e) => {
                            const cur = cfg.skills === "all" ? skills.map((x) => x.id) : Array.isArray(cfg.skills) ? cfg.skills : [];
                            const next = e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id);
                            up({ skills: next.length === skills.length ? "all" : next.length ? next : "none" });
                          }}
                        />
                        <span className="truncate" style={{ color: s.color }}>
                          {s.name}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-muted">공개 안 한 스킬을 쓰면 플레이어 채팅에는 스킬 이름만 보이고, 효과는 GM에게만 가요.</p>
                </div>
              )}

              <label className="block text-xs">
                <span className="text-muted">플레이어에게 보여 줄 메모 (식별로 알게 된 것, 소문 등)</span>
                <textarea className="input mt-0.5 min-h-16" value={cfg.note ?? ""} onChange={(e) => up({ note: e.target.value || undefined })} />
              </label>
            </>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={onClose}>
              <span>취소</span>
            </button>
            <button className="btn-primary" disabled={busy} onClick={save}>
              <span>{busy ? "저장 중…" : "저장 — 바로 적용"}</span>
            </button>
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs text-muted">플레이어 화면에 이렇게 보여요</div>
          {hidden ? (
            cfg.listed || cfg.name ? (
              <RevealView d={buildRevealDoc(c, cfg)} />
            ) : (
              <p className="rounded border border-dashed border-line p-3 text-xs text-muted">플레이어는 이 캐릭터가 있는지도 몰라요. (전투에 토큰을 올리면 토큰 이름·그림은 보여요)</p>
            )
          ) : (
            <p className="rounded border border-dashed border-line p-3 text-xs text-muted">시트 전체(HP·능력치·스킬 전부)를 플레이어가 봐요.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
