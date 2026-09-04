import { CMD } from "../defines/CMD";
import { CMDS } from "./CMDS";

const help = `Usage: F4

Popup the current UI / 弹出当前 UI`;

CMDS.register(CMD.F4, help, (c) => { c.world.lfw.pop_ui_safe(); })
