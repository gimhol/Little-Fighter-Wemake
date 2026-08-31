import { Form } from "@/Component/Form";
import { type ISpaceProps, Space } from "@/Component/Space";
import { chase_info_fields, chase_info_new, type IChaseInfo } from "@/LFW";
import { useEffect, useMemo, useRef } from "react";
import { FieldsRow } from "../../FieldsRow";

type Data = IChaseInfo;
const data_new = chase_info_new;
const ALL_FIELDS = chase_info_fields;
const BASE_FIELD_KEYS: FieldKeysRow<Data>[] = [
  ['stratedy', 'flag', 'lost'],
  ['oy'],
];

export interface IChaseInfoFormProps extends ISpaceProps {
  value?: Data;
  onChange?(value: Data): void;
}

export function ChaseInfoForm(props: IChaseInfoFormProps) {
  const { value: o_value, onChange, stretchs = true, direction = 'column', ..._p } = props;
  const i_value = useMemo<Data>(() => o_value ?? data_new(), [o_value]);
  const ref_o_value = useRef(o_value);
  const [form, _Form] = Form.useForm<Data>(i_value);

  useEffect(() => {
    if (o_value == ref_o_value.current) return;
    form.resetFieldsValue(i_value);
  }, [i_value, o_value, form]);

  return (
    <_Form form={form} onChange={(_, value) => onChange?.(value)}>
      <Space direction={direction} stretchs={stretchs} {..._p}>
        {BASE_FIELD_KEYS.map(v => <FieldsRow key={'' + v} row={v} fields={ALL_FIELDS} Form={_Form} />)}
      </Space>
    </_Form>
  );
}
