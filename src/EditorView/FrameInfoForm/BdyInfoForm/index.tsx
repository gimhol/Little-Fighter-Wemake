import { type ISpaceProps } from "@/Component/Space";
import { bdy_info_fields, bdy_info_new, type IBdyInfo } from "@/LFW";
import { FieldsForm } from "../../FieldsRow";

type Data = IBdyInfo;
const BASE_FIELD_KEYS: FieldKeysRow<Data>[] = [
  ['kind', 'hit_flag'],
  ['x', 'y', 'w', 'h'],
  ['z', 'l'],
  ['prefab_id'],
  ['test', 'code'],
];

export interface IBdyInfoFormProps extends ISpaceProps {
  value?: Data;
  onChange?(value: Data): void;
}

export function BdyInfoForm(props: IBdyInfoFormProps) {
  return (
    <FieldsForm
      fields={bdy_info_fields}
      rows={BASE_FIELD_KEYS}
      new_value={bdy_info_new}
      rest_title="其他字段"
      {...props} />
  );
}
