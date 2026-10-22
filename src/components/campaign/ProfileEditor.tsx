"use client";

import { useState } from "react";
import { ImageDrop } from "@/components/ImageDrop";
import { Modal } from "@/components/session/EditDialogs";
import { useSession } from "@/components/session/SessionContext";
import { createJournal, deleteJournal, patchJournal, type JournalEntry } from "@/lib/journal";

// 등장인물 프로필·지역 도감 항목 고치기 (저널 문서 하나 = 항목 하나)
//   draft.id 가 비어 있으면 새로 만든다
export type ProfileDraft = Omit<JournalEntry, "id" | "ownerUid" | "order" | "updatedAt"> & { id?: string; ownerUid?: string };

export function ProfileEditor({
  draft: initial,
  groups,
  onClose,
  onSaved,
}: {
  draft: ProfileDraft;
  groups: string[];
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const { cid, user, isGM, members, characters } = useSession();
  const [d, setD] = useState<ProfileDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const person = d.type === "person";
  const players = members.filter((m) => m.role === "player");
  const up = (patch: Partial<ProfileDraft>) => setD((x) => ({ ...x, ...patch }));

  async function save() {
    if (!d.title.trim()) return setError("이름을 적어 주세요.");
    setBusy(true);
    setError(null);
    try {
      const { id: existing, ownerUid: _owner, ...rest } = d;
      void _owner;
      const data = { ...rest, title: d.title.trim(), group: d.group?.trim() || undefined, subtitle: d.subtitle?.trim() || undefined };
      let id = existing;
      if (id) await patchJournal(cid, id, { ...data, image: data.image, charId: data.charId, bg: data.bg, quote: data.quote?.trim() || undefined });
      else id = await createJournal(cid, user.uid, d.type, data);
      onSaved?.(id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요.");
      setBusy(false);
    }
  }

  return (
    <Modal title={d.id ? `${d.title || "항목"} 고치기` : person ? "인물 프로필 만들기" : "지역 추가"} onClose={onClose} width={620}>
      <div className="grid gap-4 text-sm sm:grid-cols-[200px_1fr]">
        <div className="space-y-2">
          <ImageDrop
            user={user}
            kind={person ? "standing" : "background"}
            label={person ? "그림 (스탠딩·일러스트)" : "풍경 그림"}
            value={d.image}
            onChange={(v) => up({ image: v })}
            aspect={person ? "aspect-[3/4]" : "aspect-video"}
          />
          {person && <ImageDrop user={user} kind="background" label="프로필 배경 (선택)" value={d.bg} onChange={(v) => up({ bg: v })} aspect="aspect-video" />}
        </div>
        <div className="space-y-2.5">
          <label className="block">
            <span className="text-xs text-muted">{person ? "이름" : "지명"}</span>
            <input className="input mt-0.5 font-display font-bold" value={d.title} onChange={(e) => up({ title: e.target.value })} autoFocus />
          </label>
          <label className="block">
            <span className="text-xs text-muted">{person ? "칭호·소속 (이름 위에 작게)" : "한 줄 소개"}</span>
            <input className="input mt-0.5" value={d.subtitle ?? ""} onChange={(e) => up({ subtitle: e.target.value })} placeholder={person ? "제 3왕녀" : "안개에 잠긴 항구 도시"} />
          </label>
          <label className="block">
            <span className="text-xs text-muted">{person ? "묶음 (세력·소속)" : "묶음 (나라·권역)"}</span>
            <input className="input mt-0.5" value={d.group ?? ""} onChange={(e) => up({ group: e.target.value })} list="profile-groups" placeholder={person ? "왕도 사람들" : "에린딜 서부"} />
            <datalist id="profile-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          {person && (
            <label className="block">
              <span className="text-xs text-muted">대표 대사 한 줄 (프로필 위에 크게)</span>
              <input className="input mt-0.5" value={d.quote ?? ""} onChange={(e) => up({ quote: e.target.value })} placeholder="별은 다시 떠오를 거야." />
            </label>
          )}
          {person && isGM && (
            <label className="block">
              <span className="text-xs text-muted">캠페인 캐릭터와 연결 (그림·능력치를 함께 보여 줌)</span>
              <select className="input mt-0.5" value={d.charId ?? ""} onChange={(e) => up({ charId: e.target.value || undefined })}>
                <option value="">연결 안 함</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.sheet.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <label className="mt-3 block text-sm">
        <span className="text-xs text-muted"># 제목 · - 목록 · **굵게** · &gt; 인용</span>
        <textarea className="input mt-1 min-h-40 resize-y leading-relaxed" value={d.body} onChange={(e) => up({ body: e.target.value })} />
      </label>

      <div className="mt-3 rounded-md border border-line p-2 text-xs">
        <div className="mb-1 font-bold">누가 볼 수 있나</div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-1">
            <input type="radio" checked={!d.shared && d.viewers.length === 0} onChange={() => up({ shared: false, viewers: [] })} /> 🔒 {isGM ? "GM만 (아직 모르는 정보)" : "나만"}
          </label>
          {isGM && (
            <label className="flex items-center gap-1">
              <input type="radio" checked={!d.shared && d.viewers.length > 0} onChange={() => up({ shared: false, viewers: players.slice(0, 1).map((p) => p.uid) })} /> 👤 고른 플레이어
            </label>
          )}
          <label className="flex items-center gap-1">
            <input type="radio" checked={d.shared} onChange={() => up({ shared: true })} /> 🌐 모두
          </label>
        </div>
        {isGM && !d.shared && d.viewers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {players.map((p) => (
              <label key={p.uid} className="flex items-center gap-1 rounded border border-line px-2 py-0.5">
                <input
                  type="checkbox"
                  checked={d.viewers.includes(p.uid)}
                  onChange={(e) => up({ viewers: e.target.checked ? [...d.viewers, p.uid] : d.viewers.filter((x) => x !== p.uid) })}
                />
                {p.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-hp">{error}</p>}
      <div className="mt-3 flex gap-2">
        {d.id && (
          <button
            className="btn text-hp"
            disabled={busy}
            onClick={async () => {
              if (!confirm(`「${d.title}」을(를) 지울까요?`)) return;
              await deleteJournal(cid, d.id!);
              onClose();
            }}
          >
            <span>삭제</span>
          </button>
        )}
        <button className="btn ml-auto" onClick={onClose}>
          <span>취소</span>
        </button>
        <button className="btn-primary" disabled={busy} onClick={save}>
          <span>{busy ? "저장 중…" : "저장"}</span>
        </button>
      </div>
    </Modal>
  );
}
