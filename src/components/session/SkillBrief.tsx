"use client";

import type { ArSkill } from "@/lib/ar/types";
import { StyledText } from "../StyledText";

// 스킬을 고르면 아래에 보여 주는 설명 — 타이밍·대상·사정거리·코스트 + 효과
export function SkillBrief({ skill }: { skill: ArSkill }) {
  const meta = [
    skill.timing && `타이밍 ${skill.timing}`,
    skill.target && `대상 ${skill.target}`,
    skill.range && `사정 ${skill.range}`,
    skill.cost && skill.cost !== "-" && `코스트 ${skill.cost}`,
    skill.sl ? `SL ${skill.sl}${skill.slMax ? `/${skill.slMax}` : ""}` : "",
  ].filter(Boolean);
  return (
    <div className="w-full rounded-md border border-line bg-black/20 px-2 py-1.5 text-[11px] leading-relaxed">
      <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <b className="text-[12px]" style={skill.color ? { color: skill.color } : undefined}>
          《{skill.name}》
        </b>
        {meta.map((m) => (
          <span key={m as string} className="text-muted">
            {m}
          </span>
        ))}
      </div>
      {skill.effect ? (
        <div className="max-h-28 overflow-y-auto whitespace-pre-wrap">
          <StyledText text={skill.effect} />
        </div>
      ) : (
        <div className="text-muted">효과 설명이 없어요.</div>
      )}
    </div>
  );
}
