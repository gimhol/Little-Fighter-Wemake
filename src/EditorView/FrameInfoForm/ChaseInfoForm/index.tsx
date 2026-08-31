import { type ISpaceProps } from "@/Component/Space";
import { chase_info_fields, chase_info_new, type IChaseInfo } from "@/LFW";
import { FieldsForm } from "../../FieldsRow";

type Data = IChaseInfo;
const BASE_FIELD_KEYS: FieldKeysRow<Data>[] = [
  ['stratedy', 'flag', 'lost'],
  ['oy'],
];

export interface IChaseInfoFormProps extends ISpaceProps {
  value?: Data;
  onChange?(value: Data): void;
}

export function ChaseInfoForm(props: IChaseInfoFormProps) {
  return (
    <FieldsForm
      fields={chase_info_fields}
      rows={BASE_FIELD_KEYS}
      new_value={chase_info_new}
      rest_title="其他字段"
      {...props} />
  );
}
