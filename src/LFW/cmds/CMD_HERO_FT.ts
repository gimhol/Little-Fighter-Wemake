import { CheatEnum } from "../defines/CheatType";
import { CMDS } from "./CMDS";
import { cheat_code_handler } from "./cheat_code_handler";

const help = `Usage: HERO_FT <0|1>

Turn the cheat on/off / 开启或关闭作弊码`;

CMDS.register(CheatEnum.HERO_FT, help, cheat_code_handler)
