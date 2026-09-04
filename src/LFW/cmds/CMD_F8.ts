import { CMD } from "../defines/CMD";
import { Defines } from "../defines/defines";
import { EntityGroup } from "../defines/EntityGroup";
import { Ditto } from "../ditto/Instance";
import { CMDS } from "./CMDS";

const help = `Usage: F8

Spawn stage weapons / 生成场景武器`;

CMDS.register(CMD.F8, help, (c) => {
  if (c.world.fn_locked) return Ditto.debug(`F8 failed, Fn Locked.`)
  if (c.world.stage_limit) return Ditto.debug(`F8 failed, Stage Limited.`)
  c.world.add_count(CMD.F8, 1)
  const is_stage = c.world.stage.id !== Defines.VOID_STAGE.id
  const weapon_datas = c.world.lfw.datas.get_weapons_of_group(is_stage ? EntityGroup.StageWeapon : EntityGroup.VsWeapon)
  for (const wd of weapon_datas) c.world.lfw.entities.add(wd, 1);
})
