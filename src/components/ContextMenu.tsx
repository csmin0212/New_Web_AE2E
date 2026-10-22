"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { portalRoot } from "./session/ThemeRoot";

// 우클릭 메뉴. 쓰는 쪽:
//   const menu = useContextMenu();
//   <button onContextMenu={(e) => menu.open(e, [{ label: "삭제", danger: true, onSelect: … }])} />
//   {menu.node}
// 손가락으로 쓰는 화면에서는 길게 누르면 브라우저가 contextmenu 를 보내 준다.

export type MenuItem =
  | { label: string; icon?: ReactNode; hint?: string; danger?: boolean; disabled?: boolean; onSelect: () => unknown }
  | { title: string }
  | "sep";

type OpenState = { x: number; y: number; items: MenuItem[] };

export function useContextMenu() {
  const [state, setState] = useState<OpenState | null>(null);
  const close = useCallback(() => setState(null), []);
  const open = useCallback((e: MouseEvent | { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuItem[]) => {
    e.preventDefault?.();
    if ("stopPropagation" in e && typeof e.stopPropagation === "function") e.stopPropagation();
    const list = items.filter(Boolean);
    if (list.length) setState({ x: e.clientX, y: e.clientY, items: list });
  }, []);
  const node = state ? <Menu state={state} onClose={close} /> : null;
  return { open, close, node, isOpen: !!state };
}

function Menu({ state, onClose }: { state: OpenState; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);

  // 화면 밖으로 나가지 않게 붙인다 (그리기 전에 바로 옮겨서 깜빡임이 없다)
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.max(6, Math.min(state.x, window.innerWidth - r.width - 6))}px`;
    el.style.top = `${state.y + r.height > window.innerHeight - 6 ? Math.max(6, state.y - r.height) : state.y}px`;
  }, [state]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={box}
      role="menu"
      className="panel z-[100] min-w-44 animate-rise-in py-1 text-sm shadow-2xl"
      // .panel 이 position: relative 를 주므로 fixed 는 인라인으로 (레이어 밖 CSS 가 유틸리티를 이긴다)
      style={{ position: "fixed", left: state.x, top: state.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {state.items.map((it, i) => {
        if (it === "sep") return <div key={i} className="my-1 border-t border-line" />;
        if ("title" in it)
          return (
            <div key={i} className="truncate px-3 pt-1 pb-0.5 text-[11px] font-bold text-muted">
              {it.title}
            </div>
          );
        return (
          <button
            key={i}
            role="menuitem"
            disabled={it.disabled}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-panel-2 disabled:opacity-40 ${
              it.danger ? "text-hp" : ""
            }`}
            onClick={() => {
              onClose();
              void it.onSelect();
            }}
          >
            <span className="w-4 shrink-0 text-center text-xs">{it.icon}</span>
            <span className="flex-1">{it.label}</span>
            {it.hint && <span className="text-[11px] text-muted">{it.hint}</span>}
          </button>
        );
      })}
    </div>,
    portalRoot(),
  );
}
