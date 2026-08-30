import { Ditto } from "../ditto/Instance";
import type { Collision } from "./Collision";

export function handle_itr_catch(c: Collision) {
  if (c.attacker.catching) return;
  if (c.victim.catcher) return;

  const { itr, attacker, victim } = c;

  attacker.set_catch_time(attacker.catch_time_max);
  attacker.catching = victim;
  itr.catchingact && attacker.enter_frame(itr.catchingact);
  itr.catchingact || Ditto.warn(`[handle_itr_catch] catchingact got ${itr.catchingact}`);

  victim.catcher = c.attacker;
  victim.resting = 0;
  victim.fall_value = victim.fall_value_max;
  victim.defend_value = victim.defend_value_max;
  itr.caughtact && victim.enter_frame(itr.caughtact);
  itr.caughtact || Ditto.warn(`[handle_itr_catch] caughtact got ${itr.caughtact}`);
}
