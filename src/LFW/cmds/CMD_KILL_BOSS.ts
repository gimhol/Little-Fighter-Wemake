import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { CMDS } from "./CMDS";

const help = `Usage: KILL_BOSS

Kill the boss / 杀死 Boss`;

CMDS.register(CMD.KILL_BOSS, help, (c) => {
  if (c.world.stage_limit) return Ditto.debug(`KILL_BOSS failed, Stage Limited.`)
  c.world.stage.kill_boss()
})
