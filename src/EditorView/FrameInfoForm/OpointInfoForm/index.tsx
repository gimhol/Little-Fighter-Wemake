import { type ISpaceProps } from "@/Component/Space";
import { opoint_info_fields, opoint_info_new, type IOpointInfo } from "@/LFW";
import { FieldsForm } from "../../FieldsRow";

type Data = IOpointInfo;
const BASE_FIELD_KEYS: FieldKeysRow<Data>[] = [
  ['kind', 'x', 'y', 'z'],
  ['oid'],
  ['dvx', 'dvy', 'dvz'],
  ['max_hp', 'hp', 'max_mp', 'mp'],
  ['speedz', 'spreading'],
  ['interval', 'interval_id', 'interval_mode'],
  ['delay', 'motionless', 'unimportant'],
  ['inherit_speed_x', 'inherit_speed_y', 'inherit_speed_z'],
];

export interface IOpointInfoFormProps extends ISpaceProps {
  value?: Data;
  onChange?(value: Data): void;
}

export function OpointInfoForm(props: IOpointInfoFormProps) {
  return (
    <FieldsForm
      fields={opoint_info_fields}
      rows={BASE_FIELD_KEYS}
      new_value={opoint_info_new}
      rest_title="其他字段"
      {...props} />
  );
}
