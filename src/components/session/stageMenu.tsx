import { findCast, putOnStage, stageKeyOf, takeOffStage, type Scene } from "@/lib/scene";
import type { MenuItem } from "../ContextMenu";

// 대화 무대에 넣고 빼기 메뉴 (GM) — 화자 칩·파티 칩·무대 위 인물 우클릭이 같이 쓴다
//   세우기: 고정 출연 (말하지 않아도 계속 서 있다)
//   내리기: 화면에서 사라지고, 말해도 자동으로 다시 오르지 않는다 (말풍선만)
export function stageMenuItems(cid: string, scene: Scene, who: { charId?: string; name: string; image?: string }): MenuItem[] {
  const pinned = !!findCast(scene, who);
  const off = !!scene.offstage[stageKeyOf(who)];
  const items: MenuItem[] = [];
  if (!pinned) items.push({ label: off ? "무대에 다시 세우기" : "무대에 계속 세우기", icon: "▲", onSelect: () => putOnStage(cid, scene, who) });
  if (!off) items.push({ label: "무대에서 내리기", hint: "말해도 안 오름", icon: "▼", onSelect: () => takeOffStage(cid, scene, who) });
  return items;
}
