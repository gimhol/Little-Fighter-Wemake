import { CMD } from "../defines/CMD";
import { CMDS } from "./CMDS";

const help = `Usage: F4

Popup the current UI / 弹出当前 UI`;

CMDS.register(CMD.F4, help, (c) => {
  const { layers: { all } } = c.world.lfw;
  for (let i = all.length - 1; i >= 0; --i) {
    const layer = all[i];
    if (!layer) continue;
    const { length } = layer.pages;
    if (length <= 1 && i == 0) continue;
    if (length <= 0) continue;
    layer.pop();
    break;
  }
})
