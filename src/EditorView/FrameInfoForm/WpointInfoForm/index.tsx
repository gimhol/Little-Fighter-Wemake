import { type ISpaceProps } from "@/Component/Space";
import { wpoint_info_fields, wpoint_info_new, type IWpointInfo } from "@/LFW";
import { FieldsForm } from "../../FieldsRow";

type Data = IWpointInfo;
const BASE_FIELD_KEYS: FieldKeysRow<Data>[] = [
  ['kind', 'x', 'y', 'z'],
  ['weaponact'],
  ['attacking', 'dvx', 'dvy', 'dvz'],
];

export interface IWpointInfoFormProps extends ISpaceProps {
  value?: Data;
  onChange?(value: Data): void;
}

export function WpointInfoForm(props: IWpointInfoFormProps) {
  return (
    <FieldsForm
      fields={wpoint_info_fields}
      rows={BASE_FIELD_KEYS}
      new_value={wpoint_info_new}
      rest_title="其他字段"
      {...props} />
  );
}
