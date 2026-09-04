import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { CMDS } from "./CMDS";

const help = `Usage: KILL_SOLIDERS

Kill all soliders / 杀死所有小兵`;

CMDS.register(CMD.KILL_SOLIDERS, help, (c) => {
  if (c.world.stage_limit) return Ditto.debug(`KILL_SOLIDERS failed, Stage Limited.`)
  c.world.stage.kill_soliders()
})
