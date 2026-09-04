import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { CMDS } from "./CMDS";

const help = `Usage: F10

Kill all enemies / 清除所有敌人`;

CMDS.register(CMD.F10, help, (c) => {
  if (c.world.fn_locked) return Ditto.debug(`F10 failed, Fn Locked.`)
  if (c.world.stage_limit) return Ditto.debug(`F10 failed, Stage Limited.`)
  c.world.add_count(CMD.F10, 1)
  c.world.stage.kill_all()
})
