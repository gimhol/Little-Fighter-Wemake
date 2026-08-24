import { Defines, type IEntityData } from "../../defines";

export function make_fighter_data_jan(data: IEntityData) {
  if (data.base.files) {
    data.base.files['0'].variants = ['2']
    data.base.files['1'].variants = ['3']
  }
  return data;
}
