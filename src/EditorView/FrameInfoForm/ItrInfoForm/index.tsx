import { type ISpaceProps } from "@/Component/Space";
import { itr_info_fields, itr_info_new, type IItrInfo } from "@/LFW";
import { FieldsForm } from "../../FieldsRow";

type Data = IItrInfo;
const BASE_FIELD_KEYS: FieldKeysRow<Data>[] = [
  ['kind', 'effect', 'injury'],
  ['x', 'y', 'w', 'h'],
  ['z', 'l', 'bdefend'],
  ['dvx', 'dvy', 'dvz'],
  ['fall', 'vrest', 'arest'],
  ['motionless', 'shaking'],
  ['hit_flag'],
  ['test', 'code'],
  ['prefab_id'],
];

export interface IItrInfoFormProps extends ISpaceProps {
  value?: Data;
  onChange?(value: Data): void;
}

export function ItrInfoForm(props: IItrInfoFormProps) {
  return (
    <FieldsForm
      fields={itr_info_fields}
      rows={BASE_FIELD_KEYS}
      new_value={itr_info_new}
      rest_title="其他字段"
      {...props} />
  );
}
