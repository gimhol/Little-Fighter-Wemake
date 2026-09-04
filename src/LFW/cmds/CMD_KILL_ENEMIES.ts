import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { CMDS } from "./CMDS";

const help = `Usage: KILL_ENEMIES

Kill all enemies / 杀死所有敌人`;

CMDS.register(CMD.KILL_ENEMIES, help, (c) => {
  if (c.world.stage_limit) return Ditto.debug(`KILL_ENEMIES failed, Stage Limited.`)
  c.world.stage.kill_all()
})
