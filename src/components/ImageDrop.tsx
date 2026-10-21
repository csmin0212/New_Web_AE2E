"use client";

import type { User } from "firebase/auth";
import { useRef, useState } from "react";
import { copyImage, isOwnImage, uploadImage, type ImageKind } from "@/lib/upload";

// 그림 칸 — 눌러서 고르기 · 끌어다 놓기 · Ctrl+V 붙여넣기 · 주소 붙여넣기.
// 올리면 내 저장소 주소가 자동으로 들어간다.
export function ImageDrop({
  user,
  kind,
  label,
  value,
  onChange,
  aspect = "aspect-square",
  className = "",
}: {
  user: User;
  kind: ImageKind;
  label: string;
  value?: string;
  onChange: (url: string | undefined) => void;
  aspect?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");

  async function take(fn: () => Promise<string>) {
    setBusy(true);
    setError(null);
    try {
      onChange(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : "그림을 올리지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  function fromFiles(files: FileList | null | undefined) {
    const f = files && Array.from(files).find((x) => x.type.startsWith("image/"));
    if (f) take(() => uploadImage(user, f, kind));
  }

  function fromText(text: string) {
    const t = text.trim();
    if (!/^https?:\/\//.test(t)) return false;
    // 다른 곳 주소는 내 저장소로 복사해 보고, 안 되면 주소 그대로
    take(async () => {
      if (isOwnImage(t)) return t;
      try {
        return await copyImage(user, t);
      } catch {
        return t;
      }
    });
    return true;
  }

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="flex gap-2">
          <button type="button" className="hover:text-text" onClick={() => setUrlOpen((v) => !v)}>
            주소
          </button>
          {value && (
            <button type="button" className="hover:text-hp" onClick={() => onChange(undefined)}>
              지우기
            </button>
          )}
        </span>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${label} — 눌러서 고르기, 끌어다 놓기, 붙여넣기`}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            input.current?.click();
          }
        }}
        onPaste={(e) => {
          if (e.clipboardData.files.length) {
            e.preventDefault();
            fromFiles(e.clipboardData.files);
          } else if (fromText(e.clipboardData.getData("text"))) {
            e.preventDefault();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) fromFiles(e.dataTransfer.files);
          else fromText(e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text"));
        }}
        className={`relative grid cursor-pointer place-items-center overflow-hidden rounded-md border-2 border-dashed transition ${aspect} ${
          over ? "border-accent bg-accent/10" : "border-line bg-panel-2 hover:border-accent/60"
        }`}
        style={{ backgroundImage: "repeating-conic-gradient(rgba(255,255,255,.04) 0 25%, transparent 0 50%)", backgroundSize: "16px 16px" }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="px-2 text-center text-[11px] leading-relaxed text-muted">
            눌러서 고르기
            <br />
            끌어다 놓기 · Ctrl+V
          </span>
        )}
        {busy && <span className="absolute inset-0 grid place-items-center bg-black/60 text-xs">올리는 중…</span>}
      </div>
      {urlOpen && (
        <form
          className="mt-1 flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (fromText(url)) {
              setUrl("");
              setUrlOpen(false);
            } else setError("https:// 로 시작하는 주소를 넣어 주세요.");
          }}
        >
          <input className="input py-0.5 text-xs" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn shrink-0 py-0.5 text-xs">
            <span>넣기</span>
          </button>
        </form>
      )}
      {error && <p className="mt-1 text-[11px] text-hp">{error}</p>}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => fromFiles(e.target.files)} />
    </div>
  );
}
