import { Defines, StateEnum } from "../defines";
import { Entity } from "../entity/Entity";
import { min } from "../utils";
import { CharacterState_Base } from "./CharacterState_Base";

export class CharacterState_Drink extends CharacterState_Base {
  constructor(state: StateEnum = StateEnum.Drink) {
    super(state)
  }
  override update(e: Entity): void {
    super.update(e);
    const holding = e.holding;
    const drink = e.holding?.drink
    if (!holding || !drink) return;

    const { hp_h_empty, hp_r_empty, mp_h_empty } = drink
    if (!hp_h_empty && drink.hp_h_ticks.add()) {
      e.hp = min(e.hp_max, e.hp + drink.hp_h_value)
      drink.hp_h += drink.hp_h_value
    }
    if (!hp_r_empty && drink.hp_r_ticks.add()) {
      e.hp_r = min(e.hp_max, e.hp_r + drink.hp_r_value)
      drink.hp_r += drink.hp_r_value
    }
    if (!mp_h_empty && drink.mp_h_ticks.add()) {
      e.mp = min(e.mp_max, e.mp + drink.mp_h_value)
      drink.mp_h += drink.mp_h_value
    }
    if (hp_h_empty && hp_r_empty && mp_h_empty) {
      e.drop_holding();
      e.enter_frame(Defines.NEXT_FRAME_AUTO);
      
      holding.hp = holding.hp_r = 1;
      holding.lfw.mt.mark = `drink_drop`
      const vx = holding.lfw.mt.range(-6, 6) / 2;
      const vy = 6;
      holding.set_velocity(vx, vy, 0);
    }
  }
}
