import { type ISpaceProps } from "@/Component/Space";
import { cpoint_info_fields, cpoint_new, type ICpoint } from "@/LFW";
import { FieldsForm } from "../../FieldsRow";

type Data = ICpoint;
const BASE_FIELD_KEYS: FieldKeysRow<Data>[] = [
  ['kind', 'x', 'y', 'z'],
  ['injury', 'decrease', 'shaking'],
  ['throwvx', 'throwvy', 'throwvz', 'throwinjury'],
  ['fronthurtact', 'backhurtact'],
  ['hurtable'],
];

export interface ICpointFormProps extends ISpaceProps {
  value?: Data;
  onChange?(value: Data): void;
}

export function CpointInfoForm(props: ICpointFormProps) {
  return (
    <FieldsForm
      fields={cpoint_info_fields}
      rows={BASE_FIELD_KEYS}
      new_value={cpoint_new}
      rest_title="其他字段"
      {...props} />
  );
}
