
import { type IFrameInfo, type IVector3, StateEnum } from "../defines";
import type { Entity } from "../entity/Entity";
import { abs } from "../utils/math";
import { CharacterState_Base } from "./CharacterState_Base";

export class CharacterState_Burning extends CharacterState_Base {
  constructor() {
    super(StateEnum.Burning)
  }
  override enter(e: Entity, prev_frame: IFrameInfo): void {
    super.update(e);
    e.bounced = false;
    if (e.catcher) e.catcher.drop_catching()
  }
  override update(e: Entity): void {
    super.update(e);
    const vx = e.velocity.x
    if (vx) e.facing = vx > 0 ? -1 : 1;
  }
  override leave(e: Entity, next_frame: IFrameInfo): void {
    super.leave(e, next_frame);
    e.bounced = false;
  }
  override on_landing(e: Entity, velocity: IVector3): void {
    const { on_landing } = e.frame;
    if (on_landing) {
      e.enter_frame(on_landing);
      return;
    }
    const { y: vy, x: vx } = velocity;
    const {
      data: { indexes },
    } = e;
    if (
      !e.bounced && (
        vy <= e.world.dataset.cha_bc_tst_spd_y ||
        abs(vx) > e.world.dataset.cha_bc_tst_spd_x
      )
    ) {
      e.enter_frame_by_id(indexes?.bouncing?.[-1][1]);
      e.set_velocity_y(e.world.dataset.cha_bc_spd)
      e.bounced = true;
    } else {
      e.enter_frame_by_id(indexes?.lying?.[-1]);
    }
  }
}

