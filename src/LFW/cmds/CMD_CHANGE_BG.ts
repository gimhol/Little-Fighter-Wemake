import { CMD } from "../defines/CMD";
import { CMDS } from "./CMDS";

const help = `Usage: CHANGE_BG <bg_id>

Change the background / 切换背景`;

CMDS.register(CMD.CHANGE_BG, help, (c) => c.world.change_bg(c.str(1)));
