import { Form } from "@/Component/Form";
import { Space } from "@/Component/Space";
import { useMemo, useRef, useEffect } from "react";
import { FieldsRow } from "./FieldsRow";

/** 对象字段：以子表单递归渲染其 fields（用于 type: 'object'/'obj'） */
export function ObjectField(props: {
  value?: any;
  onChange?: (v: any) => void;
  fields: Map<any, any>;
}) {
  const { value, onChange, fields } = props;
  const seed = useMemo(() => value ?? {}, [value]);
  const [form, _Form] = Form.useForm(seed);
  const ref_value = useRef(seed);

  useEffect(() => {
    if (seed === ref_value.current) return;
    form.resetFieldsValue(seed);
    ref_value.current = seed;
  }, [seed, form]);

  const keys = useMemo(() => Array.from(fields.keys()), [fields]);

  return (
    <_Form
      form={form}
      onChange={(_, v) => {
        ref_value.current = v;
        onChange?.(v);
      }}>
      <Space direction="column" stretchs>
        {keys.map(k => (
          <FieldsRow key={String(k)} row={k as any} fields={fields as any} Form={_Form as any} />
        ))}
      </Space>
    </_Form>
  );
}
