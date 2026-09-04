import { CMD } from "../defines/CMD";
import { CMDS } from "./CMDS";

const help = `Usage: F2

Step one frame (pauses first if running) / 单步执行（未暂停时先暂停）`;

CMDS.register(CMD.F2, help, (c) => { c.world.set_paused(2); })
