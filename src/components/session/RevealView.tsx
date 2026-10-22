"use client";

import { CONDITION_LABEL } from "@/lib/battleRules";
import type { RevealDoc } from "@/lib/reveal";
import { StyledText } from "../StyledText";

// 플레이어가 보는 비공개 캐릭터의 「공개 정보」 카드 — GM 이 고른 것만 들어 있다
export function RevealView({ d }: { d: RevealDoc }) {
  const p = d.profile;
  const line = p ? [p.level != null && `Lv.${p.level}`, p.category, p.element, p.race, [p.mainClass, p.supportClass].filter(Boolean).join("/")].filter(Boolean).join(" · ") : "";
  return (
    <div className="panel space-y-3 p-3 text-sm">
      <div className="flex items-center gap-3">
        {d.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.image} alt="" className="h-14 w-14 rounded-full border border-line object-cover object-top" />
        ) : (
          <div className="font-display grid h-14 w-14 place-items-center rounded-full border border-line bg-panel-2 text-xl text-muted">?</div>
        )}
        <div className="min-w-0">
          <div className="font-display truncate text-lg font-bold" style={{ color: d.color }}>
            {d.name}
          </div>
          {line && <div className="text-xs text-muted">{line}</div>}
          {!line && <div className="text-xs text-muted">알려진 정보가 적어요</div>}
        </div>
      </div>

      {(d.hp || d.hpBar != null || d.cond !== undefined || d.mp) && (
        <div className="space-y-1 text-xs">
          {d.hp && <Bar label="HP" pct={(d.hp.cur / Math.max(1, d.hp.max)) * 100} text={`${d.hp.cur}/${d.hp.max}`} color="bg-hp" />}
          {!d.hp && d.hpBar != null && <Bar label="HP" pct={d.hpBar} text={`${d.hpBar}%`} color="bg-hp" />}
          {!d.hp && d.hpBar == null && d.cond !== undefined && (
            <div>
              <span className="text-muted">상태 </span>
              <b className={d.cond ? "text-hp" : ""}>{d.cond ? CONDITION_LABEL[d.cond] : "멀쩡해 보인다"}</b>
            </div>
          )}
          {d.mp && <Bar label="MP" pct={(d.mp.cur / Math.max(1, d.mp.max)) * 100} text={`${d.mp.cur}/${d.mp.max}`} color="bg-mp" />}
        </div>
      )}

      {d.stats && (
        <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
          {d.stats.map((s) => (
            <div key={s.label} className="rounded border border-line py-0.5">
              <div className="text-muted">{s.label}</div>
              <b>{s.value}</b>
            </div>
          ))}
        </div>
      )}

      {d.combat && (
        <div className="grid grid-cols-4 gap-1 text-[11px]">
          {(
            [
              ["명중", d.combat.hit],
              ["회피", d.combat.evasion],
              ["대미지", d.combat.damage],
              ["행동치", d.combat.action],
              ["이동력", d.combat.move],
              ["물방", d.combat.pdef],
              ["마방", d.combat.mdef],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded border border-line px-1.5 py-0.5">
              <span className="text-muted">{k} </span>
              <b>{v}</b>
            </div>
          ))}
        </div>
      )}

      {d.skills && d.skills.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-bold">알려진 스킬</div>
          {d.skills.map((s) => (
            <div key={s.id} className="rounded border border-line px-2 py-1.5 text-xs">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <b style={{ color: s.color }}>{s.name}</b>
                <span className="text-muted">{[s.timing && `【${s.timing}】`, s.target, s.range, s.cost && s.cost !== "-" && `코스트 ${s.cost}`].filter(Boolean).join(" · ")}</span>
              </div>
              {s.effect && (
                <div className="mt-0.5 whitespace-pre-wrap text-text/90">
                  <StyledText text={s.effect} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {d.drops && d.drops.length > 0 && (
        <div className="text-xs">
          <div className="font-bold">드롭품</div>
          {d.drops.map((x, i) => (
            <div key={i} className="text-muted">
              {x.range} · {x.name}
              {x.price ? ` (${x.price}G)` : ""}
            </div>
          ))}
        </div>
      )}

      {d.note && (
        <div className="rounded border border-accent/40 bg-accent/10 px-2 py-1.5 text-xs whitespace-pre-wrap">
          <StyledText text={d.note} />
        </div>
      )}
    </div>
  );
}

function Bar({ label, pct, text, color }: { label: string; pct: number; text: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-muted">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/40">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      <span className="w-16 text-right tabular-nums">{text}</span>
    </div>
  );
}
