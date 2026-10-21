"use client";

import { useEffect, useRef, useState } from "react";

// 드래그로 너비를 바꾸는 패널. 크기는 이 브라우저에만 기억한다.
//   side="left"  → 패널 왼쪽 가장자리를 잡고 끈다 (오른쪽에 붙은 패널: 기록)
//   side="right" → 패널 오른쪽 가장자리를 잡고 끈다 (왼쪽에 붙은 패널: 연출, 시트)
export function useResizable(key: string, initial: number, min: number, max: number) {
  const storageKey = `trpg-vtt:size:${key}`;
  const [size, setSize] = useState(() => {
    try {
      const v = Number(localStorage.getItem(storageKey));
      return v >= min && v <= max ? v : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(size));
    } catch {}
  }, [storageKey, size]);
  return { size, setSize, min, max };
}

export function ResizeHandle({
  side,
  size,
  setSize,
  min,
  max,
  label,
}: {
  side: "left" | "right";
  size: number;
  setSize: (n: number) => void;
  min: number;
  max: number;
  label: string;
}) {
  const start = useRef<{ x: number; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x;
      const next = start.current.size + (side === "right" ? dx : -dx);
      setSize(Math.round(Math.min(max, Math.max(min, next))));
    };
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging, side, min, max, setSize]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`${label} 너비 조절`}
      aria-valuenow={size}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title="끌어서 너비 조절"
      onPointerDown={(e) => {
        e.preventDefault();
        start.current = { x: e.clientX, size };
        setDragging(true);
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 40 : 10;
        const grow = side === "right" ? "ArrowRight" : "ArrowLeft";
        const shrink = side === "right" ? "ArrowLeft" : "ArrowRight";
        if (e.key === grow) setSize(Math.min(max, size + step));
        if (e.key === shrink) setSize(Math.max(min, size - step));
      }}
      className={`group absolute inset-y-0 z-50 w-2 cursor-col-resize touch-none ${side === "right" ? "-right-1" : "-left-1"}`}
    >
      <div
        className={`mx-auto h-full w-0.5 transition ${dragging ? "bg-accent" : "bg-transparent group-hover:bg-accent/60 group-focus-visible:bg-accent"}`}
      />
    </div>
  );
}
