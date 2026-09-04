import { CMD } from "../defines/CMD";
import { CMDS } from "./CMDS";

const help = `Usage: F5

Toggle turbo speed / 切换加速模式`;

CMDS.register(CMD.F5, help, (c) => { c.world.dataset.playrate = c.world.dataset.playrate === 1 ? 1000 : 1; })
