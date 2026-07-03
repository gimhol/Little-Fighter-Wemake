import { StateEnum, WeaponEnum } from "../defines";
import type { Entity } from "../entity/Entity";
import { is_weapon } from "../entity/type_check";
import { CharacterState_Base } from "./CharacterState_Base";

export class CharacterState_Walking extends CharacterState_Base {
  constructor(state: StateEnum = StateEnum.Walking) {
    super(state)
  }
  override update(e: Entity): void {
    super.update(e);
    const { UD, LR } = e.ctrl;
    if (!UD && !LR && !e.wait) {
      if (
        is_weapon(e.holding) &&
        e.holding?.base_type === WeaponEnum.Heavy
      ) {
        e.wait = e.frame.wait;
      } else {
        e.enter_frame_by_id(e.data.indexes?.default, true);
      }
    }

    if (e.hp <= 0) {
      e.enter_frame(e.get_sudden_death_frame());
    } else if (e.position.y > e.ground_y) {
      e.enter_frame_by_id(e.data.indexes?.in_the_skys?.[0]);
    }
  }
}