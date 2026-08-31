import { type ISpaceProps } from "@/Component/Space";
import { drink_Info_fields, drink_info_new, type IDrinkInfo } from "@/LFW";
import { FieldsForm } from "../../FieldsRow";

type Data = IDrinkInfo;
const BASE_FIELD_KEYS: FieldKeysRow<Data>[] = [
  ['hp_h_value', 'hp_h_ticks', 'hp_h_total'],
  ['hp_r_value', 'hp_r_ticks', 'hp_r_total'],
  ['mp_h_value', 'mp_h_ticks', 'mp_h_total'],
]
export interface IDrinkInfoFormProps extends ISpaceProps {
  value?: Data;
  onChange?(value: Data): void;
}
export function DrinkInfoForm(props: IDrinkInfoFormProps) {
  return (
    <FieldsForm
      fields={drink_Info_fields}
      rows={BASE_FIELD_KEYS}
      new_value={drink_info_new}
      rest_title="其他字段"
      {...props} />
  )
}