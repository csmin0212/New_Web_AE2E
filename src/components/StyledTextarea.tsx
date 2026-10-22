"use client";

import { useRef, useState, type CSSProperties } from "react";
import { styleToCss, loadMyStyles, PRESET_STYLES, saveMyStyles, SIZE_LABEL, wrapStyled, type TextStyle } from "@/lib/textStyle";
import { parseStyledText } from "@/lib/styledText";

// 꾸밀 수 있는 글 칸 — 글자를 드래그해서 고르고, 옵션을 정해 「적용」.
// 자주 쓰는 조합은 「내 스타일」로 저장해 두고 한 번에 적용한다.
export function StyledTextarea({
  value,
  onChange,
  className = "",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [st, setSt] = useState<TextStyle>({ bold: true, color: "#c0392b" });
  const [useColor, setUseColor] = useState(true);
  const [mine, setMine] = useState(() => (typeof window === "undefined" ? [] : loadMyStyles()));
  const [open, setOpen] = useState(false);

  const effective: TextStyle = { ...st, color: useColor ? st.color : undefined };

  // 고른 글자를 꾸밈으로 감싼다 (아무것도 안 골랐으면 "글자"를 넣는다)
  function apply(style: TextStyle) {
    const el = box.current;
    const a = el?.selectionStart ?? value.length;
    const b = el?.selectionEnd ?? value.length;
    const picked = value.slice(a, b) || "글자";
    const out = wrapStyled(picked, style);
    const next = value.slice(0, a) + out + value.slice(b);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(a, a + out.length);
    });
  }

  function saveMine() {
    const name = prompt("이 꾸밈의 이름 (예: 내 파워 제목)", "");
    if (!name?.trim()) return;
    const next = [...mine.filter((m) => m.name !== name.trim()), { name: name.trim(), style: effective }];
    setMine(next);
    saveMyStyles(next);
  }

  const chip = (name: string, style: TextStyle, onRemove?: () => void) => {
    const piece = parseStyledText(wrapStyled(name, style))[0];
    const css = piece && piece.kind === "styled" ? (piece.style as CSSProperties) : piece?.kind === "bold" ? { fontWeight: 700 } : {};
    return (
      <span key={name} className="group relative inline-flex">
        <button
          type="button"
          className="rounded border border-line bg-panel-2 px-1.5 py-0.5 text-[11px] hover:border-accent"
          title={`고른 글자에 「${name}」 적용`}
          onClick={() => apply(style)}
        >
          <span style={{ ...css, display: "inline", padding: css.background ? "0 4px" : undefined, fontSize: undefined, textAlign: undefined }}>{name}</span>
        </button>
        {onRemove && (
          <button type="button" className="absolute -top-1.5 -right-1.5 hidden h-3.5 w-3.5 place-items-center rounded-full bg-hp text-[9px] text-white group-hover:grid" onClick={onRemove} aria-label={`${name} 지우기`}>
            ×
          </button>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" className={`btn px-1.5 py-0 text-[11px] ${open ? "ring-1 ring-accent" : ""}`} onClick={() => setOpen((o) => !o)} title="글씨 꾸미기">
          <span>🎨 꾸미기</span>
        </button>
        {PRESET_STYLES.slice(0, open ? PRESET_STYLES.length : 4).map((p) => chip(p.name, p.style))}
        {mine.map((m) =>
          chip(m.name, m.style, () => {
            const next = mine.filter((x) => x.name !== m.name);
            setMine(next);
            saveMyStyles(next);
          }),
        )}
      </div>

      {open && (
        <div className="space-y-1.5 rounded-md border border-line bg-panel-2/60 p-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["bold", "굵게", "font-bold"],
                ["italic", "기울임", "italic"],
                ["underline", "밑줄", "underline"],
                ["center", "가운데 줄", ""],
                ["glow", "빛", ""],
              ] as const
            ).map(([k, label, cls]) => (
              <button
                key={k}
                type="button"
                className={`rounded border px-1.5 py-0.5 ${st[k] ? "border-accent bg-accent/20" : "border-line"} ${cls}`}
                onClick={() => setSt((s) => ({ ...s, [k]: !s[k] }))}
              >
                {label}
              </button>
            ))}
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={useColor} onChange={(e) => setUseColor(e.target.checked)} />
              글자색
              <input type="color" value={st.color ?? "#c0392b"} onChange={(e) => (setSt((s) => ({ ...s, color: e.target.value })), setUseColor(true))} className="h-5 w-7 cursor-pointer bg-transparent" />
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={!!st.bg} onChange={(e) => setSt((s) => ({ ...s, bg: e.target.checked ? "#8c2f22" : undefined }))} />
              띠 배경
              {st.bg && <input type="color" value={st.bg} onChange={(e) => setSt((s) => ({ ...s, bg: e.target.value }))} className="h-5 w-7 cursor-pointer bg-transparent" />}
            </label>
            <select className="input w-auto py-0 text-[11px]" value={st.size ?? "md"} onChange={(e) => setSt((s) => ({ ...s, size: e.target.value as TextStyle["size"] }))}>
              {(Object.keys(SIZE_LABEL) as (keyof typeof SIZE_LABEL)[]).map((k) => (
                <option key={k} value={k}>
                  {SIZE_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted">미리보기</span>
            <span className="rounded bg-panel px-2 py-0.5">
              {(() => {
                const p = parseStyledText(wrapStyled("이렇게 보여요", effective))[0];
                return p?.kind === "styled" ? <span style={{ ...(p.style as CSSProperties), display: "inline-block" }}>{p.text}</span> : p?.kind === "bold" ? <b>{p.text}</b> : "이렇게 보여요";
              })()}
            </span>
            <button type="button" className="btn-primary ml-auto px-2 py-0.5 text-[11px]" onClick={() => apply(effective)} disabled={!styleToCss(effective)}>
              <span>고른 글자에 적용</span>
            </button>
            <button type="button" className="btn px-2 py-0.5 text-[11px]" onClick={saveMine} disabled={!styleToCss(effective)} title="이 조합을 이름 붙여 저장 — 위 줄에 버튼으로 생겨요">
              <span>내 스타일로 저장</span>
            </button>
          </div>
          <p className="text-muted">글자를 드래그해서 고른 뒤 적용하세요. 아무것도 안 고르면 「글자」가 들어가요. 저장한 스타일은 이 브라우저에 남아요.</p>
        </div>
      )}

      <textarea ref={box} className={`input ${className}`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
