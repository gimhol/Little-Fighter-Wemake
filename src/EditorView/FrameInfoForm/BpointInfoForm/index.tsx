import { type ISpaceProps } from "@/Component/Space";
import { bpoint_info_fields, bpoint_info_new, type IBpointInfo } from "@/LFW";
import { FieldsForm } from "../../FieldsRow";

type Data = IBpointInfo;
const BASE_FIELD_KEYS: FieldKeysRow<Data>[] = [
  ['x', 'y', 'z', 'r'],
];

export interface IBpointInfoFormProps extends ISpaceProps {
  value?: Data;
  onChange?(value: Data): void;
}

export function BpointInfoForm(props: IBpointInfoFormProps) {
  return (
    <FieldsForm
      fields={bpoint_info_fields}
      rows={BASE_FIELD_KEYS}
      new_value={bpoint_info_new}
      rest_title="其他字段"
      {...props} />
  );
}
