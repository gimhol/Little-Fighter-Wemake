import { StateEnum } from "../defines";
import { Entity } from "../entity/Entity";
import { is_fighter } from "../entity/type_check";
import { abs, round } from "../utils";
import { CharacterState_Base } from "./CharacterState_Base";

export class CharacterState_Teleport2FarthestAlly extends CharacterState_Base {
  constructor(state: StateEnum = StateEnum.TeleportToFarthestAlly) {
    super(state)
  }
  override enter(self: Entity): void {
    let _dis: number = -1;
    let _tar: Entity | undefined;
    for (const o of self.world.entities) {
      if (!is_fighter(o) || o === self || !o.is_ally(self)) continue;
      if (o.hp <= 0) continue;
      const dis =
        abs(o.position.x - self.position.x) +
        abs(o.position.z - self.position.z);
      if (dis > _dis) {
        _dis = dis;
        _tar = o;
      }
    }

    let x = self.position.x;
    let z = self.position.z;
    if (_tar) {
      x = round(_tar.position.x - self.facing * 60);
      z = round(_tar.position.z);
    }

    const [left, right, near, far] = self.world.get_bound(self);
    const pos = self.world.terrain.nearest_standable(x, z, left, right, near, far);
    if (!pos) return;
    self.set_position(pos.x, pos.y, pos.z)
  }
}
