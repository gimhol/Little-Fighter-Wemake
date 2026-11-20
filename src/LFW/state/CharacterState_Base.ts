import { type IFrameInfo, WeaponEnum } from "../defines";
import { Entity } from "../entity/Entity";
import { State_Base } from "./State_Base";

export class CharacterState_Base extends State_Base {
  override update(e: Entity): void {
    super.update(e)
    e.handle_ground_velocity_decay();
  }
  override on_landing(e: Entity): void {
    const { on_landing } = e.frame;
    if (on_landing) {
      e.enter_frame(on_landing);
      return;
    }
    e.enter_frame_by_id(e.data.indexes?.landing_2);
  }
  override get_auto_frame(e: Entity): IFrameInfo | undefined {
    let fid: string | undefined;
    if (e.holding?.base_type === WeaponEnum.Heavy) {
      fid = e.data.indexes?.heavy_obj_walk;
    } else if (e.is_on_ground) {
      fid = e.data.indexes?.default;
    } else if (e.hp > 0) {
      fid = e.data.indexes?.in_the_skys?.[0];
    }
    if (!fid) return void 0;
    return e.data.frames[fid];
  }
}
