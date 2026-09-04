import { CheatEnum } from "../defines/CheatType";
import { CMDS } from "./CMDS";
import { cheat_code_handler } from "./cheat_code_handler";

const help = `Usage: GIM_INK <0|1>

Turn the cheat on/off / 开启或关闭作弊码`;

CMDS.register(CheatEnum.GIM_INK, help, cheat_code_handler)
