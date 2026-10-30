import { CMD } from "../defines/CMD";
import { CMDS } from "./CMDS";

export const TURBO_PLAYRATE = 10;

const help = `Usage: F5

Toggle turbo speed (10x) / 切换加速模式（10 倍速）`;

CMDS.register(CMD.F5, help, (c) => { c.world.dataset.playrate = c.world.dataset.playrate === 1 ? TURBO_PLAYRATE : 1; })
