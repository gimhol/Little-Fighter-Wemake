import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { CMDS } from "./CMDS";

const help = `Usage: KILL_OTHERS

Kill other entities / 杀死其他实体`;

CMDS.register(CMD.KILL_OTHERS, help, (c) => {
  if (c.world.stage_limit) return Ditto.debug(`KILL_OTHERS failed, Stage Limited.`)
  c.world.stage.kill_others()
})
