import { CMD, type GK } from "../defines";
import { Ditto } from "../ditto/Instance";
import { is_human_ctrl } from "../entity/type_check";
import { LFWKeyEvent } from "../ui/LFWKeyEvent";
import { CMDS } from "./CMDS";

const help = `Usage: KEY_EVENT --p=<player_id> --s=<0|1> --c=<key_code> --n=<game_key>

Replay one local keyboard event: 
the UI layers see it first 
(from the top layer down, the first enabled one takes it; pages declaring no key input are skipped), 
then every mounted key state gets it, 
and finally it reaches the given player's human controller 
(skipped while the stage disables control) 

重放一次本地键盘事件：先自顶向下派发给 UI 层
（第一个未禁用的层生效，不接收按键的页跳过），
再派发给所有已挂载的按键状态，
最后交给该玩家的真人控制器
（关卡禁用操作时跳过）

Options:
  --p    player id (required) / 玩家 id（必填）
  --s    1 = pressed, anything else is a release / 1 为按下，其余值算抬起
  --c    lowercase "KeyboardEvent.key", e.g. "a" / "arrowleft" (required) / 键名，取 "KeyboardEvent.key" 并小写（必填）
  --n    game key, one of L/R/U/D/a/j/d (required) / 游戏键名，L/R/U/D/a/j/d 之一（必填）`;

CMDS.register(CMD.KEY_EVENT, help, (c) => {
  const pid      /**/ = c.str_arg('--p')
  const state    /**/ = c.num_arg('--s')
  const key_code /**/ = c.str_arg('--c')
  const key_name /**/ = c.str_arg('--n')

  if (typeof pid != 'string') {
    return Ditto.warn(`KEY_EVENT failed, '--p' player id must be a string, got: ${c.cmd}`)
  }
  if (typeof key_code != 'string') {
    return Ditto.warn(`KEY_EVENT failed, '--c' key code must be a string, got: ${c.cmd}`)
  }
  if (typeof key_name != 'string') {
    return Ditto.warn(`KEY_EVENT failed, '--n' game key must be a string, got: ${c.cmd}`)
  }
  const { lfw: { layers, world, mounted_keys } } = c.world
  const e = new LFWKeyEvent(pid, state == 1, key_name as GK, key_code)
  for (let i = layers.length - 1; i >= 0; i--) {
    const ui = layers.at(i)?.ui;
    if (!ui || ui.disabled || ui.ignore_key) continue;
    if (e.pressed) ui.on_key_down(e)
    else ui.on_key_up(e)
    break;
  }

  const gk = e.game_key;
  const fn1 = e.pressed ? 'hit' : 'end';

  for (let i = 0; i < mounted_keys.length; i++) {
    const ks = mounted_keys[i];
    ks[gk][fn1]()
  }

  // WTF.
  if (world.stage.control_disabled) return;
  const fighter = world.puppets.get(e.player)
  if (!fighter) return;
  const { ctrl } = fighter
  if (!is_human_ctrl(ctrl)) return;

  if (e.pressed) ctrl.start(gk)
  else ctrl.end(gk)
})
