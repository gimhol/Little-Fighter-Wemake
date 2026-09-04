import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { CMDS } from "./CMDS";

const help = `Usage: F6

Toggle infinite MP / 无限 MP 开关`;

CMDS.register(CMD.F6, help, (c) => {
  if (c.world.fn_locked) return Ditto.debug(`F6 failed, Fn Locked.`)
  if (c.world.stage_limit) return Ditto.debug(`F6 failed, Stage Limited.`)
  c.world.add_count(CMD.F6, 1)
  c.world.dataset.infinity_mp = c.world.dataset.infinity_mp ? 0 : 1;
})
