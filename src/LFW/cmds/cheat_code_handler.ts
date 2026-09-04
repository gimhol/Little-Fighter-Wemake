import { is_cheat_type } from "../defines/CheatType";
import { Defines } from "../defines/defines";
import { Ditto } from "../ditto/Instance";
import type { CMDS } from "./CMDS";

export const cheat_code_handler = (ctx: CMDS) => {
  const cmd = ctx.str(0);
  if (!is_cheat_type(cmd)) return;
  const prev = ctx.world.dataset[cmd];
  const enabled = ctx.world.dataset[cmd] = ctx.num(1) ? 1 : 0;
  if (prev == enabled) return;
  const cheat = Defines.CheatInfos.get(cmd)
  if (!cheat) return;
  if (cheat.sound) ctx.world.lfw.sounds.play_with_load(cheat.sound);
  ctx.world.lfw.callbacks.call("on_cheat_changed", cmd, !!enabled);
}
