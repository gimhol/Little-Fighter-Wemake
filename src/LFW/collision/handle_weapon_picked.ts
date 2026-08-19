import type { Collision } from "./Collision";

export function handle_weapon_picked(collision: Collision): void {
  const { victim, attacker } = collision;
  attacker.pick(victim)
}
