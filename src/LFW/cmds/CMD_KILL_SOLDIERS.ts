import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { CMDS } from "./CMDS";

const help = `Usage: KILL_SOLDIERS

Kill all soliders / 杀死所有小兵`;

CMDS.register(CMD.KILL_SOLDIERS, help, (c) => {
  if (c.world.stage_limit) return Ditto.debug(`KILL_SOLDIERS failed, Stage Limited.`)
  c.world.stage.kill_soldiers()
})
