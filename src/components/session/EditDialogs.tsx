"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { removeCharacter, renameCharacter, updateCharacter } from "@/lib/campaigns";
import { removeNpc, saveNpc, updateNpc, type NpcPreset } from "@/lib/scene";
import type { Character } from "@/lib/types";
import { ImageDrop } from "../ImageDrop";
import { useSession } from "./SessionContext";

export const KIND_LABEL: Record<Character["kind"], string> = { pc: "PC", npc: "NPC", enemy: "에너미" };

// 가운데 뜨는 작은 창
export function Modal({ title, onClose, children, width = 460 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/55 p-3" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel max-h-[calc(100dvh-24px)] w-full animate-rise-in overflow-y-auto p-4 shadow-2xl" style={{ maxWidth: width }} role="dialog" aria-label={title}>
        <div className="mb-3 flex items-center">
          <h2 className="font-display text-base font-bold">{title}</h2>
          <button className="ml-auto text-muted hover:text-text" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// 캠페인에 들어 있는 캐릭터 고치기 — GM 은 전부, 주인은 그림·색만
export function CharacterEditDialog({ character: c, onClose }: { character: Character; onClose: () => void }) {
  const { cid, user, isGM, members } = useSession();
  const [name, setName] = useState(c.sheet.name);
  const [kind, setKind] = useState(c.kind);
  const [ownerUid, setOwnerUid] = useState(c.ownerUid ?? "");
  const [color, setColor] = useState(c.color ?? "#c9a45c");
  const [portrait, setPortrait] = useState(c.portrait);
  const [standing, setStanding] = useState(c.standing);
  const [token, setToken] = useState(c.token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (isGM && name.trim() && name.trim() !== c.sheet.name) await renameCharacter(cid, c, name.trim());
      await updateCharacter(cid, c.id, {
        portrait,
        standing,
        token,
        color,
        ...(isGM ? { kind, ownerUid: kind === "pc" ? ownerUid || null : null } : {}),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요.");
      setBusy(false);
    }
  }

  return (
    <Modal title={`${c.sheet.name} 고치기`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        {isGM && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="block">
              <span className="text-xs text-muted">이름 (「[칭호] 이름」 가능)</span>
              <input className="input mt-0.5" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-muted">종류</span>
              <select className="input mt-0.5" value={kind} onChange={(e) => setKind(e.target.value as Character["kind"])}>
                <option value="pc">PC</option>
                <option value="npc">NPC (모두 볼 수 있음)</option>
                <option value="enemy">에너미 (GM만 볼 수 있음)</option>
              </select>
            </label>
          </div>
        )}
        {isGM && kind === "pc" && (
          <label className="block">
            <span className="text-xs text-muted">담당 플레이어</span>
            <select className="input mt-0.5" value={ownerUid} onChange={(e) => setOwnerUid(e.target.value)}>
              <option value="">담당 없음</option>
              {members
                .filter((m) => m.role === "player")
                .map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-3 gap-2">
          <ImageDrop user={user} kind="portrait" label="얼굴" value={portrait} onChange={setPortrait} />
          <ImageDrop user={user} kind="standing" label="스탠딩" value={standing} onChange={setStanding} aspect="aspect-[3/4]" />
          <ImageDrop user={user} kind="token" label="토큰" value={token} onChange={setToken} />
        </div>
        <label className="flex items-center gap-2">
          <span className="text-xs text-muted">이름표 색</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-10 cursor-pointer bg-transparent" />
        </label>
        {error && <p className="text-xs text-hp">{error}</p>}
        <div className="flex gap-2">
          {isGM && (
            <button
              className="btn text-hp"
              disabled={busy}
              onClick={async () => {
                if (!confirm(`${c.sheet.name}을(를) 캠페인에서 뺄까요? (보관함 원본은 그대로예요)`)) return;
                await removeCharacter(cid, c.id);
                onClose();
              }}
            >
              <span>캠페인에서 빼기</span>
            </button>
          )}
          <button className="btn ml-auto" onClick={onClose}>
            <span>취소</span>
          </button>
          <button className="btn-primary" disabled={busy} onClick={save}>
            <span>{busy ? "저장 중…" : "저장"}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

// NPC 화자 (시트 없이 말만 하는 인물) 만들기·고치기
export function NpcEditDialog({ npcKey, onClose }: { npcKey: string | null; onClose: () => void }) {
  const { cid, user, scene } = useSession();
  const orig: NpcPreset | undefined = npcKey ? scene.npcs[npcKey] : undefined;
  const [name, setName] = useState(orig?.name ?? "");
  const [image, setImage] = useState(orig?.image);
  const [color, setColor] = useState(orig?.color ?? "#c9a45c");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const npc: NpcPreset = { name: name.trim(), image, color };
    if (npcKey) await updateNpc(cid, npcKey, npc);
    else await saveNpc(cid, npc);
    onClose();
  }

  return (
    <Modal title={orig ? `${orig.name} 고치기` : "NPC 화자 추가"} onClose={onClose} width={380}>
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="text-xs text-muted">이름 (「[칭호] 이름」 가능)</span>
          <input
            className="input mt-0.5"
            autoFocus
            placeholder="[제 3왕녀] 앤드리아"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && save()}
          />
        </label>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <ImageDrop user={user} kind="standing" label="스탠딩 (선택)" value={image} onChange={setImage} aspect="aspect-[3/4]" className="w-32" />
          <label className="flex items-center gap-2">
            <span className="text-xs text-muted">이름표 색</span>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-10 cursor-pointer bg-transparent" />
          </label>
        </div>
        <div className="flex gap-2">
          {npcKey && (
            <button
              className="btn text-hp"
              onClick={async () => {
                await removeNpc(cid, npcKey);
                onClose();
              }}
            >
              <span>삭제</span>
            </button>
          )}
          <button className="btn ml-auto" onClick={onClose}>
            <span>취소</span>
          </button>
          <button className="btn-primary" disabled={busy || !name.trim()} onClick={save}>
            <span>{npcKey ? "저장" : "추가"}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
