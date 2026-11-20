import { StateEnum } from "../defines/StateEnum";
import { WeaponEnum } from "../defines/WeaponType";
import { Entity } from "../entity/Entity";
import { CharacterState_Base } from "./CharacterState_Base";

export class CharacterState_Injured extends CharacterState_Base {
  constructor(state: StateEnum = StateEnum.Injured) {
    super(state);
  }
  override enter(e: Entity): void {
    super.enter?.(e);
    const holding = e.holding
    if (holding?.base_type === WeaponEnum.Heavy) {
      e.drop_holding()
      holding.team = e.team;
    }
  }
}
