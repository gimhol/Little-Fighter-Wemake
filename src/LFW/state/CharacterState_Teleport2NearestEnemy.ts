import { StateEnum } from "../defines";
import { Entity } from "../entity/Entity";
import { is_fighter } from "../entity/type_check";
import { abs, round } from "../utils/math/base";
import { CharacterState_Base } from "./CharacterState_Base";

export class CharacterState_Teleport2NearestEnemy extends CharacterState_Base {
  constructor(state: StateEnum = StateEnum.TeleportToNearestEnemy) {
    super(state)
  }
  override enter(m: Entity): void {
    let _dis: number = -1;
    let _tar: Entity | undefined;
    for (const o of m.world.entities) {
      if (!is_fighter(o) || o === m || o.is_ally(m)) continue;
      if (o.hp <= 0) continue;
      const dis =
        abs(o.position.x - m.position.x) +
        abs(o.position.z - o.position.z);
      if (_dis < 0 || dis < _dis) {
        _dis = dis;
        _tar = o;
      }
    }
    let { x, z } = m.position
    if (_tar) {
      x = round(_tar.position.x - m.facing * 120);
      z = round(_tar.position.z);
    }
    const seg = m.world.ground.segment(x, z);
    const y = m.world.ground.y(seg, x, z);
    m.set_position(x, y, z)
  }
}
