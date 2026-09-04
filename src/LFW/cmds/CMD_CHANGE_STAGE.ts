import { CMD } from "../defines/CMD";
import { CMDS } from "./CMDS";

const help = `Usage: CHANGE_STAGE <stage_id>

Change the stage / 切换关卡`;

CMDS.register(CMD.CHANGE_STAGE, help, (c) => c.world.change_stage(c.str(1)));
