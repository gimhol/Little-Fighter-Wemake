import type { Collision } from "../collision/Collision";
import { is_independent, WeaponEnum } from "../defines";
import { summary_mgr } from "../entity/SummaryMgr";

export function handle_weapon_is_picked(collision: Collision): void {
  const { victim, attacker } = collision;
  if (attacker.holding) return;
  if (victim.bearer) return;
  victim.bearer = attacker;
  attacker.holding = victim;
  victim.team = attacker.team;
  victim.follow_bearer()
  summary_mgr.get(attacker.id).picking_sum += 1
  if (!is_independent(attacker.team))
    summary_mgr.get(attacker.team).picking_sum += 1;
}
