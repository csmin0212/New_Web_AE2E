"use client";

import { useEffect, useState } from "react";
import { derive } from "@/lib/ar/derive";
import { deleteMap, loadMap, saveMap, snapshotMap, subscribeMaps, type BattleMap } from "@/lib/battleMaps";
import { setGauge } from "@/lib/campaigns";
import { addToken } from "@/lib/scene";
import { useSession } from "./SessionContext";

// 연출 패널 · 전투 준비 안 — 전투 맵 미리 세팅 + PC 한 번에 올리기
//   맵에는 크기·배경·지형·에너미 배치·PC 시작 자리가 들어간다. GM 만 보는 곳에 저장한다
export function BattleMapsBlock() {
  const { cid, battle, characters } = useSession();
  const [maps, setMaps] = useState<Record<string, BattleMap>>({});
  const [name, setName] = useState("");
  const [refill, setRefill] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => subscribeMaps(cid, setMaps), [cid]);

  const onGrid = new Set(Object.values(battle.tokens).map((t) => t.charId).filter(Boolean));
  const missingPcs = characters.filter((c) => c.kind === "pc" && !onGrid.has(c.id));

  async function addAllPcs() {
    const used = new Set(Object.values(battle.pos).map((p) => `${p.x},${p.y}`));
    for (const c of missingPcs) {
      let at = { x: 0, y: 0 };
      outer: for (let x = 0; x < battle.meta.cols; x++)
        for (let y = 0; y < battle.meta.rows; y++)
          if (!used.has(`${x},${y}`) && battle.terrain[`${x}_${y}`] !== "wall") {
            at = { x, y };
            break outer;
          }
      used.add(`${at.x},${at.y}`);
      const agi = c.sheet.stats.find((s) => s.key === "AGI")?.mod ?? 0;
      const per = c.sheet.stats.find((s) => s.key === "PER")?.mod ?? 0;
      await addToken(
        cid,
        { name: c.sheet.name, charId: c.id, ownerUid: c.ownerUid ?? undefined, side: "pc", init: c.ar ? derive(c.ar).action : agi + per },
        at,
      );
    }
    setMsg(`PC ${missingPcs.length}명을 올렸어요.`);
  }

  async function load(key: string) {
    const m = maps[key];
    if (!m || !confirm(`「${m.name}」 맵을 불러올까요? 지금 전장의 에너미·지형은 맵의 것으로 바뀌고, PC는 시작 자리로 옮겨져요.`)) return;
    await loadMap(cid, battle, m);
    // 맵에 놓인 에너미 HP 를 가득 채운다 (같은 에너미를 다시 쓸 때)
    if (refill) {
      for (const mt of Object.values(m.tokens ?? {})) {
        const c = mt.token.charId ? characters.find((x) => x.id === mt.token.charId) : undefined;
        if (c && c.hp.cur !== c.hp.max) await setGauge(cid, c.id, "hp", { ...c.hp, cur: c.hp.max });
      }
    }
    setMsg(`「${m.name}」을(를) 불러왔어요. 준비되면 전투 개시!`);
  }

  const list = Object.entries(maps).sort((a, b) => a[1].createdAt - b[1].createdAt);
  return (
    <div className="mt-3 space-y-2 rounded border border-line p-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-bold">전투 맵</span>
        <span className="text-[10px] text-muted">GM만 보여요</span>
        {missingPcs.length > 0 && (
          <button className="btn-primary ml-auto px-2 py-0.5 text-[11px]" onClick={addAllPcs} title="그리드에 없는 PC를 모두 올려요">
            <span>PC 전원 올리기 ({missingPcs.length})</span>
          </button>
        )}
      </div>
      {list.length === 0 && <p className="text-[11px] text-muted">전장을 꾸며 두고(에너미 배치·지형·배경) 아래에서 저장하면, 세션 중에 한 번에 불러올 수 있어요.</p>}
      <ul className="space-y-1">
        {list.map(([k, m]) => (
          <li key={k} className="flex items-center gap-1.5 rounded border border-line px-2 py-1">
            <span className="min-w-0 flex-1 truncate font-bold">{m.name}</span>
            <span className="shrink-0 text-[10px] text-muted">
              {m.cols}×{m.rows} · 적 {Object.keys(m.tokens ?? {}).length}
            </span>
            <button className="btn px-2 py-0 text-[11px]" onClick={() => load(k)}>
              <span>불러오기</span>
            </button>
            <button className="btn px-2 py-0 text-[11px]" title="지금 전장으로 덮어쓰기" onClick={() => confirm(`「${m.name}」을 지금 전장으로 덮어쓸까요?`) && saveMap(cid, snapshotMap(battle, m.name), k)}>
              <span>덮어쓰기</span>
            </button>
            <button className="text-muted hover:text-hp" onClick={() => confirm(`「${m.name}」 맵을 지울까요?`) && deleteMap(cid, k)} aria-label={`${m.name} 지우기`}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-1"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await saveMap(cid, snapshotMap(battle, name.trim()));
          setName("");
          setMsg("지금 전장을 맵으로 저장했어요.");
        }}
      >
        <input className="input py-1" placeholder="맵 이름 (예: 레드 리버 강변)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn shrink-0 text-xs" disabled={!name.trim()}>
          <span>지금 전장 저장</span>
        </button>
      </form>
      <label className="flex items-center gap-1.5 text-[11px] text-muted">
        <input type="checkbox" checked={refill} onChange={(e) => setRefill(e.target.checked)} />
        불러올 때 에너미 HP 가득 채우기
      </label>
      {msg && <p className="text-[11px] text-accent">{msg}</p>}
    </div>
  );
}
