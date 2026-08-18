import { CheatEnum, is_cheat_type } from "../defines/CheatType";
import { CMD } from "../defines/CMD";
import { Defines } from "../defines/defines";
import { Difficulty, is_difficulty } from "../defines/Difficulty";
import { EntityGroup } from "../defines/EntityGroup";
import { Ditto } from "../ditto/Instance";
import { is_fighter, is_weapon } from "../entity";
import type { World } from "../World";

export interface ICMDHandler { (ctx: CMDS): void; }

export class CMDS {
  private static readonly handlers = new Map<string, ICMDHandler>();
  private static inst: CMDS;
  static handler(key: string) {
    return this.handlers.get(key)
  }
  static register(key: string, handler: ICMDHandler) {
    this.handlers.set(key, handler);
  }
  static handle(world: World, cmds: string[]) {
    if (this.inst?.world !== world) this.inst = new CMDS(world);
    for (let i = 0; i < cmds.length; i++) {
      this.inst.set_cmd(cmds[i])
      this.handler(this.inst.words[0])?.(this.inst);
    }
  }
  readonly world: World;
  words: string[] = [];
  cmd: string = '';
  private constructor(world: World) {
    this.world = world;
  }
  set_cmd(cmd: string) {
    this.cmd = cmd;
    this.words = cmd.split(' ');
  }
  str(index: number): string | undefined {
    return this.words[index]
  }
  num(index: number) {
    const str = this.str(index);
    if (str == void 0) return void 0;
    return Number(str);
  }
  nums(index: number): number[] | undefined {
    const str = this.str(index);
    if (str == void 0) return void 0;
    return str.split(',').map(Number);
  }
}

CMDS.register(CMD.SET_DIFFICULTY, (ctx) => {
  const d = ctx.num(1);
  if (!is_difficulty(d)) return Ditto.warn(`SET_DIFFICULTY failed, must "SET_DIFFICULTY \${1|2|3|4}", got: ${ctx.cmd}`)
  ctx.world.dataset.difficulty = d;
})

CMDS.register(CMD.DEL_PUPPET, (ctx) => {
  const player_id = ctx.str(1);
  if (typeof player_id !== 'string') return Ditto.warn(`DEL_PUPPET failed, must "DEL_PUPPET \${playerId}", got: ${ctx.cmd}`)
  const entity = ctx.world.puppets.get(player_id);
  if (entity) ctx.world.del_entity(entity);
  else Ditto.warn('DEL_PUPPET failed, puppet not found.')
})

const cheat_code_handler = (ctx: CMDS) => {
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

CMDS.register(CheatEnum.LF2_NET, cheat_code_handler)
CMDS.register(CheatEnum.HERO_FT, cheat_code_handler)
CMDS.register(CheatEnum.GIM_INK, cheat_code_handler)
CMDS.register(CMD.F1, (c) => { c.world.paused = !c.world.paused; })
CMDS.register(CMD.F2, (c) => { c.world.set_paused(2); })
CMDS.register(CMD.F3, (c) => { c.world.set_fn_locked(1); })
CMDS.register(CMD.F4, (c) => { c.world.lfw.pop_ui_safe(); })
CMDS.register(CMD.F5, (c) => { c.world.dataset.playrate = c.world.dataset.playrate === 1 ? 1000 : 1; })
CMDS.register(CMD.F6, (c) => {
  if (c.world.fn_locked) return Ditto.debug(`F6 failed, Fn Locked.`)
  if (c.world.stage_limit) return Ditto.debug(`F6 failed, Stage Limited.`)
  c.world.add_count(CMD.F6, 1)
  c.world.dataset.infinity_mp = c.world.dataset.infinity_mp ? 0 : 1;
})
CMDS.register(CMD.F7, (c) => {
  if (c.world.fn_locked) return Ditto.debug(`F7 failed, Fn Locked.`)
  if (c.world.stage_limit) return Ditto.debug(`F7 failed, Stage Limited.`)
  c.world.add_count(CMD.F7, 1)
  for (const e of c.world.entities) {
    if (!is_fighter(e)) continue;
    e.hp = e.hp_r = e.hp_max;
    e.mp = e.mp_max;
  }
})
CMDS.register(CMD.F8, (c) => {
  if (c.world.fn_locked) return Ditto.debug(`F8 failed, Fn Locked.`)
  if (c.world.stage_limit) return Ditto.debug(`F8 failed, Stage Limited.`)
  c.world.add_count(CMD.F8, 1)
  const is_stage = c.world.stage.id !== Defines.VOID_STAGE.id
  const weapon_datas = c.world.lfw.datas.get_weapons_of_group(is_stage ? EntityGroup.StageWeapon : EntityGroup.VsWeapon)
  for (const wd of weapon_datas) c.world.lfw.entities.add(wd, 1);
})
CMDS.register(CMD.F9, (c) => {
  if (c.world.fn_locked) return Ditto.debug(`F9 failed, Fn Locked.`)
  if (c.world.stage_limit) return Ditto.debug(`F9 failed, Stage Limited.`)
  c.world.add_count(CMD.F9, 1)
  for (const e of c.world.entities) if (is_weapon(e)) e.hp = 0;
})
CMDS.register(CMD.F10, (c) => {
  if (c.world.fn_locked) return Ditto.debug(`F10 failed, Fn Locked.`)
  if (c.world.stage_limit) return Ditto.debug(`F10 failed, Stage Limited.`)
  c.world.add_count(CMD.F10, 1)
  c.world.stage.kill_all()
})

CMDS.register(CMD.CHANGE_BG, (c) => c.world.change_bg(c.str(1)));
CMDS.register(CMD.CHANGE_STAGE, (c) => c.world.change_stage(c.str(1)));
CMDS.register(CMD.KILL_ENEMIES, (c) => {
  if (c.world.stage_limit) return Ditto.debug(`KILL_ENEMIES failed, Stage Limited.`)
  c.world.stage.kill_all()
})
CMDS.register(CMD.KILL_BOSS, (c) => {
  if (c.world.stage_limit) return Ditto.debug(`KILL_BOSS failed, Stage Limited.`)
  c.world.stage.kill_boss()
})
CMDS.register(CMD.KILL_SOLIDERS, (c) => {
  if (c.world.stage_limit) return Ditto.debug(`KILL_SOLIDERS failed, Stage Limited.`)
  c.world.stage.kill_soliders()
})
CMDS.register(CMD.KILL_OTHERS, (c) => {
  if (c.world.stage_limit) return Ditto.debug(`KILL_OTHERS failed, Stage Limited.`)
  c.world.stage.kill_others()
})
CMDS.register(CMD.DIST_CAM, (c) => {
  const nums = c.nums(1);
  if (!nums) return c.world.camera.undest();
  const [x, y = 0] = nums;
  if (isNaN(x)) return Ditto.warn(`DIST_CAM failed, x got ${x}.`)
  if (isNaN(y)) return Ditto.warn(`DIST_CAM failed, y got ${y}.`)
  c.world.camera.dest(x, y);
})
CMDS.register(CMD.LOCK_CAM, (c) => {
  const nums = c.nums(1);
  if (!nums) return c.world.camera.unlock();
  const [x, y = 0] = nums;
  if (isNaN(x)) return Ditto.warn(`LOCK_CAM failed, x got ${x}.`)
  if (isNaN(y)) return Ditto.warn(`LOCK_CAM failed, y got ${y}.`)
  c.world.camera.lock(x, y);
})