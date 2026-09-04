import { CMD } from "../defines/CMD";
import { CMDS } from "./CMDS";

const help = `Usage: F3

Lock / Unlock function keys / 锁定或解锁功能键`;

CMDS.register(CMD.F3, help, (c) => { c.world.set_fn_locked(1); })
