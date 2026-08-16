import type { Collision } from "./Collision";

export function handle_itr_catch(c: Collision) {
  if (c.attacker.catching) return;
  if (c.victim.catcher) return;
  c.attacker.start_catch(c.victim, c.itr);
  c.victim.start_caught(c.attacker, c.itr);
}
