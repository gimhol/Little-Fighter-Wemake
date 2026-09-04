import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { is_fighter } from "../entity";
import { CMDS } from "./CMDS";

const help = `Usage: F7

Restore all fighters' HP and MP / 全员 HP/MP 回满`;

CMDS.register(CMD.F7, help, (c) => {
  if (c.world.fn_locked) return Ditto.debug(`F7 failed, Fn Locked.`)
  if (c.world.stage_limit) return Ditto.debug(`F7 failed, Stage Limited.`)
  c.world.add_count(CMD.F7, 1)
  for (const e of c.world.entities) {
    if (!is_fighter(e)) continue;
    e.hp = e.hp_r = e.hp_max;
    e.mp = e.mp_max;
  }
})
