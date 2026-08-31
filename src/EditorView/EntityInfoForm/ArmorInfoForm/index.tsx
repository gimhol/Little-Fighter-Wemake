import { type ISpaceProps } from "@/Component/Space";
import { armor_Info_fields, armor_Info_new, type IArmorInfo } from "@/LFW";
import { FieldsForm } from "../../FieldsRow";

type Data = IArmorInfo;
const BASE_FIELD_KEYS: FieldKeysRow<Data>[] = [
  ['type', 'toughness'],
  ['fireproof', 'antifreeze', 'toughness'],
  ['injury_ratio', 'shaking_ratio', 'motionless_ratio']
]

export interface IArmorInfoFormProps extends ISpaceProps {
  value?: Data;
  onChange?(value: Data): void;
}
export function ArmorInfoForm(props: IArmorInfoFormProps) {
  return (
    <FieldsForm
      fields={armor_Info_fields}
      rows={BASE_FIELD_KEYS}
      new_value={armor_Info_new}
      rest_title="其他字段"
      {...props} />
  )
}
