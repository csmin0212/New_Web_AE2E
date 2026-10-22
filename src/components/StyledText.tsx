"use client";

import type { CSSProperties } from "react";
import { parseStyledText } from "@/lib/styledText";

// 꾸민 글씨 그리기 — Roll20 꾸밈([글자](#" style="…")), **굵게**, *기울임*
// 채팅 카드·시트·저널·인물·지역이 모두 이걸 쓴다
export function StyledText({ text }: { text: string }) {
  return (
    <>
      {parseStyledText(text).map((p, i) => {
        if (p.kind === "bold")
          return (
            <strong key={i} className="text-text">
              {p.text}
            </strong>
          );
        if (p.kind === "italic")
          return (
            <em key={i} className="text-muted">
              {p.text}
            </em>
          );
        if (p.kind === "styled") {
          const Tag = p.block ? "div" : "span";
          return (
            <Tag key={i} style={p.style as CSSProperties}>
              {p.text}
            </Tag>
          );
        }
        return <span key={i}>{p.text}</span>;
      })}
    </>
  );
}
