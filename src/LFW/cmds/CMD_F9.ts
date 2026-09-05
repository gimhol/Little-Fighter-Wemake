import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { is_weapon } from "../entity";
import { CMDS } from "./CMDS";

const help = `Usage: F9

Remove all weapons / 清除所有武器`;

CMDS.register(CMD.F9, help, (c) => {
  if (c.world.fn_locked) return Ditto.debug(`F9 failed, Fn Locked.`)
  if (c.world.stage_limit) return Ditto.debug(`F9 failed, Stage Limited.`)
  c.world.add_count(CMD.F9, 1)
  for (const e of Array.from(c.world.entities)) if (is_weapon(e)) e.hp = 0;
})
