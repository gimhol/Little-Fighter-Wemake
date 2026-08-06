import { EntityEnum } from "../defines";
import type { Entity } from "../entity/Entity";
import { State_Base } from "./State_Base";
export class State_TransformTo8XXX extends State_Base {
  override leave(e: Entity): void {
    if (typeof this.state !== "number") return;
    const oid = "" + (this.state - 8000);
    const data = e.lfw.datas.find(oid);
    const old_data = e.data
    if (data) e.transform(data);
    e.enter_frame(e.find_auto_frame());
    const new_type = e.data.type
    if (old_data.type !== new_type && new_type === EntityEnum.Fighter) {
      e.world.callbacks.call("on_fighter_add", e) // so stupid
    }
  }
}
