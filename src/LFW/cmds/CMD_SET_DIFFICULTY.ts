import { CMD } from "../defines/CMD";
import { is_difficulty } from "../defines/Difficulty";
import { Ditto } from "../ditto/Instance";
import { CMDS } from "./CMDS";

const help = `Usage: SET_DIFFICULTY <1|2|3|4>

Set the game difficulty / 设置游戏难度`;

CMDS.register(CMD.SET_DIFFICULTY, help, (ctx) => {
  const d = ctx.num(1);
  if (!is_difficulty(d)) return Ditto.warn(`SET_DIFFICULTY failed, must "SET_DIFFICULTY \${1|2|3|4}", got: ${ctx.cmd}`)
  ctx.world.dataset.difficulty = d;
})
