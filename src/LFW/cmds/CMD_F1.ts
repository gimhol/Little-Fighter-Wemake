import { CMD } from "../defines/CMD";
import { CMDS } from "./CMDS";

const help = `Usage: F1

Pause / Resume the game / 暂停或继续游戏`;

CMDS.register(CMD.F1, help, (c) => { c.world.paused = !c.world.paused; })
