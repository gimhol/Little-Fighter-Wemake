import { Defines, EntityGroup, type IEntityData } from "../../defines";
import { ensure } from "../../utils";

export function make_fighter_data_firzen(data: IEntityData) {
  data.base.group = ensure(data.base.group, EntityGroup.Boss);
  data.base.mp_r_ratio = 2;
  data.base.ce = 2;

  return data;
}
