"use client";

import { useState } from "react";
import { clearTerrain, deleteTerrainDef, newTerrainId, saveTerrainDef, terrainDefsOf } from "@/lib/battleMaps";
import { DEFAULT_TERRAINS, TERRAIN_EFFECT_LABEL, type TerrainDef, type TerrainEffect } from "@/lib/terrain";
import { Modal } from "./EditDialogs";
import { useSession } from "./SessionContext";

// GM 이 지형을 칠할 때 그리드 위에 뜨는 팔레트. brush = 고른 지형 id, null = 지우개
export function TerrainPalette({ brush, onBrush }: { brush: string | null; onBrush: (id: string | null) => void }) {
  const { cid, battle } = useSession();
  const defs = terrainDefsOf(battle);
  const [editing, setEditing] = useState<{ id: string; def: TerrainDef } | null>(null);

  return (
    <div className="absolute top-12 left-2 z-20 w-48 rounded-md border border-line bg-panel/95 p-1.5 text-xs shadow-lg">
      <div className="mb-1 px-1 font-bold">지형 칠하기</div>
      <ul className="space-y-0.5">
        {Object.entries(defs).map(([id, d]) => (
          <li key={id} className="flex items-center gap-1">
            <button
              className={`flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left ${brush === id ? "bg-accent/25 ring-1 ring-accent" : "hover:bg-panel-2"}`}
              onClick={() => onBrush(id)}
              title={`${TERRAIN_EFFECT_LABEL[d.effect]}${d.amount ? ` ${d.amount}` : ""}${d.note ? ` — ${d.note}` : ""}`}
            >
              <span className="h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-black/40" style={{ background: d.color }} />
              <span className="truncate">{d.name}</span>
              {d.amount ? <span className="ml-auto text-[10px] text-muted">{d.effect === "heal" ? "+" : "−"}{d.amount}</span> : null}
            </button>
            <button className="px-1 text-muted hover:text-text" onClick={() => setEditing({ id, def: d })} aria-label={`${d.name} 고치기`}>
              ✎
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex flex-wrap gap-1 border-t border-line pt-1">
        <button className={`btn px-2 py-0.5 text-[11px] ${brush === null ? "ring-1 ring-accent" : ""}`} onClick={() => onBrush(null)}>
          <span>지우개</span>
        </button>
        <button className="btn px-2 py-0.5 text-[11px]" onClick={() => setEditing({ id: newTerrainId(), def: { name: "", color: "#c0392b", effect: "damage", amount: 10 } })}>
          <span>+ 새 지형</span>
        </button>
        <button
          className="btn px-2 py-0.5 text-[11px] text-hp"
          onClick={() => {
            if (confirm("칠한 지형을 모두 지울까요?")) clearTerrain(cid);
          }}
        >
          <span>전부 지우기</span>
        </button>
      </div>
      <p className="mt-1 px-1 text-[10px] leading-tight text-muted">칸을 누르거나 끌어서 칠해요. 피해·회복 지형은 라운드가 끝날 때(클린업) 그 위 유닛에게 자동으로 들어가요.</p>
      {editing && (
        <TerrainEditor
          id={editing.id}
          initial={editing.def}
          onClose={() => setEditing(null)}
          onSave={async (def) => {
            // 기본 지형만 쓰던 중이면, 고칠 때 기본 지형도 함께 저장해 둔다 (안 그러면 나머지가 사라져 보인다)
            if (!Object.keys(battle.terrainDefs).length) for (const [k, d] of Object.entries(DEFAULT_TERRAINS)) await saveTerrainDef(cid, k, d);
            await saveTerrainDef(cid, editing.id, def);
            setEditing(null);
          }}
          onDelete={
            defs[editing.id]
              ? async () => {
                  if (!Object.keys(battle.terrainDefs).length) for (const [k, d] of Object.entries(DEFAULT_TERRAINS)) if (k !== editing.id) await saveTerrainDef(cid, k, d);
                  await deleteTerrainDef(cid, editing.id);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function TerrainEditor({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  id: string;
  initial: TerrainDef;
  onClose: () => void;
  onSave: (d: TerrainDef) => void;
  onDelete?: () => void;
}) {
  const [d, setD] = useState<TerrainDef>(initial);
  const needsAmount = d.effect === "damage" || d.effect === "heal";
  return (
    <Modal title={initial.name ? `${initial.name} 고치기` : "새 지형"} onClose={onClose} width={380}>
      <div className="space-y-2.5 text-sm">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="block">
            <span className="text-xs text-muted">이름</span>
            <input className="input mt-0.5" value={d.name} placeholder="레드 리버" autoFocus onChange={(e) => setD({ ...d, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs text-muted">색</span>
            <input type="color" className="mt-0.5 h-8 w-12 cursor-pointer bg-transparent" value={d.color} onChange={(e) => setD({ ...d, color: e.target.value })} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-muted">효과</span>
          <select className="input mt-0.5" value={d.effect} onChange={(e) => setD({ ...d, effect: e.target.value as TerrainEffect })}>
            {(Object.keys(TERRAIN_EFFECT_LABEL) as TerrainEffect[]).map((k) => (
              <option key={k} value={k}>
                {TERRAIN_EFFECT_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        {needsAmount && (
          <label className="block">
            <span className="text-xs text-muted">{d.effect === "damage" ? "클린업마다 HP 로스 (방어 무시)" : "클린업마다 HP 회복"}</span>
            <input
              className="input mt-0.5 w-28"
              inputMode="numeric"
              value={d.amount ?? ""}
              onChange={(e) => setD({ ...d, amount: parseInt(e.target.value.replace(/\D/g, ""), 10) || undefined })}
            />
          </label>
        )}
        <label className="block">
          <span className="text-xs text-muted">설명 (칸에 올리면 보여요)</span>
          <input className="input mt-0.5" value={d.note ?? ""} placeholder="강을 건너면 [화염] 피해" onChange={(e) => setD({ ...d, note: e.target.value || undefined })} />
        </label>
        <div className="flex gap-2">
          {onDelete && (
            <button className="btn text-hp" onClick={onDelete}>
              <span>삭제</span>
            </button>
          )}
          <button className="btn ml-auto" onClick={onClose}>
            <span>취소</span>
          </button>
          <button className="btn-primary" disabled={!d.name.trim()} onClick={() => onSave({ ...d, name: d.name.trim() })}>
            <span>저장</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
