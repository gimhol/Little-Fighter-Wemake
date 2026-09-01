import { type IFrameInfo, type IVector3, StateEnum, WeaponEnum } from "../defines";
import type { Entity } from "../entity/Entity";
import { ice_piece_opoints } from "./spawn_ice_piece";
import { StateBase_Proxy } from "./StateBase_Proxy";

export class State_Frozen extends StateBase_Proxy {
  constructor(state: StateEnum = StateEnum.Frozen) {
    super(state)
  }
  override enter(e: Entity, prev_frame: IFrameInfo): void {
    super.enter(e, prev_frame);
    if (e.catcher) e.catcher.drop_catching();
    if (e.holding?.base_type == WeaponEnum.Heavy) e.drop_holding();
    e.play_sound(["data/065.wav.mp3"]);
  }
  override leave(e: Entity, next_frame: IFrameInfo): void {
    super.leave(e, next_frame);
    e.play_sound(["data/066.wav.mp3"]);
    e.apply_opoints(ice_piece_opoints);
    super.leave?.(e, next_frame);
  }
  override on_landing(e: Entity, velocity: IVector3): void {
    const { on_landing } = e.frame;
    if (on_landing) {
      e.enter_frame(on_landing);
      return;
    }
    const { data: { indexes },
    } = e;
    const { y: vy } = velocity;
    if (vy <= e.world.dataset.cha_bc_tst_spd_y * 2) {
      e.enter_frame_by_id(indexes?.bouncing?.[-1][0]);
      e.set_velocity(null,e.world.dataset.cha_bc_spd)
      e.hp -= 10;
    }
  }
}
