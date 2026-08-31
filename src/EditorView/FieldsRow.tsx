import { Form } from "@/Component/Form";
import { Input, InputNumber } from "@/Component/Input";
import Select from "@/Component/Select";
import { Space, type ISpaceProps } from "@/Component/Space";
import type { IField as IFieldInfo } from "@/LFW";
import { useEffect, useMemo, useRef } from "react";
import { AutoArraySelect } from "./AutoArraySelect";
import { BitFlagSelect } from "./BitFlagSelect";
import { MapField } from "./MapField";
import { ObjectField } from "./ObjectField";

export interface IFieldsRowProps<T extends object> {
  row: FieldKeysRow<T>,
  fields: Map<keyof T, IFieldInfo<Partial<T>>>,
  Form: Form<T>
}

export function FieldsRow<T extends object>(props: IFieldsRowProps<T>) {
  const { row, fields, Form } = props;

  
  if (Array.isArray(row)) {
    return (
      <Space vertical={false} item_props={{ style: { flex: 1 } }}>
        {row.map(v => <FieldsRow key={v.toString()} row={v} fields={fields} Form={Form} />)}
      </Space>
    );
  }
  const field = fields.get(row);
  if (!field) return null;
  const { key, title = key, type, options } = field;
  let label = title.toString();
  if (key != title) label += ` (${key.toString()})`;
  const desc = (field.desc ?? label).toString();
  if (options) {
    return (
      <Form.Item name={key} label={label} >
        {(field as any).bitFlag == true ?
          <BitFlagSelect
            clearable={field.nullable == true}
            title={desc}
            options={options} /> :
        field.array == true ?
          <Select
            multi
            clearable={field.nullable == true}
            title={desc}
            options={options}
            parse={i => [i.value, i.label, { title: i.desc }]} /> :
        field.array == 'auto' ?
          <AutoArraySelect
            clearable={field.nullable == true}
            title={desc}
            options={options} /> :
          <Select
            clearable={field.nullable == true}
            title={desc}
            options={options}
            parse={i => [i.value, i.label, { title: i.desc }]} />}
      </Form.Item>
    );
  } else if (type == 'int' || type == 'float' || type == 'flt' || type == 'num') {
    return (
      <Form.Item name={key} label={label} >
        <InputNumber
          clearable={field.nullable == true}
          title={desc}
          precision={type == 'float' || type == 'flt' || type == 'num' ? void 0 : 0}
          min={field.min}
          max={field.max}
          step={field.step} />
      </Form.Item>
    );
  } else if (type == 'string' || type == 'str') {
    return (
      <Form.Item name={key} label={label}>
        <Input
          clearable={field.nullable == true}
          title={desc}
          maxLength={field.maxLength} />
      </Form.Item>
    );
  } else if (type == 'object' || type == 'obj') {
    return (
      <Form.Item name={key} label={label}>
        <ObjectField fields={(field as any).fields} />
      </Form.Item>
    );
  } else if (type == 'map') {
    return (
      <Form.Item name={key} label={label}>
        <MapField valueField={(field as any).value} />
      </Form.Item>
    );
  }
  return <></>;
}

/** 计算未被 row 列表覆盖的字段 key（内部/运行时字段以 `__` 开头，不参与兜底） */
export function fields_rest<T extends object>(
  all: Map<keyof T, IFieldInfo<Partial<T>>>,
  rows: FieldKeysRow<T>[],
): (keyof T)[] {
  const covered = new Set<keyof T>();
  for (const r of rows) {
    if (Array.isArray(r)) for (const k of r) covered.add(k);
    else covered.add(r as keyof T);
  }
  return Array.from(all.keys()).filter(k => {
    if (String(k).startsWith('__')) return false;
    return !covered.has(k);
  });
}

/** 渲染未被 row 列表覆盖的字段（兜底，保证 fields Map 里新增的字段不“消失”） */
export function FieldsRest<T extends object>(props: {
  title?: string;
  rows: FieldKeysRow<T>[];
  fields: Map<keyof T, IFieldInfo<Partial<T>>>;
  Form: Form<T>;
}) {
  const { title, rows, fields, Form } = props;
  const rest = useMemo(() => fields_rest(fields, rows), [fields, rows]);
  if (!rest.length) return null;
  return (
    <Space direction="column" stretchs>
      {title ? <div style={{ fontWeight: 'bold', opacity: 0.55 }}>{title}</div> : null}
      {rest.map(k => <FieldsRow key={String(k)} row={k} fields={fields} Form={Form} />)}
    </Space>
  );
}

/** 通用字段表单外壳：统一 Form 样板，渲染 rows + 未覆盖字段兜底 */
export interface IFieldsFormProps<T extends object> extends ISpaceProps {
  value?: T;
  onChange?(value: T): void;
  /** 字段定义 Map */
  fields: Map<keyof T, IFieldInfo<Partial<T>>>;
  /** 自定义行分组 */
  rows?: FieldKeysRow<T>[];
  /** 数据工厂：value 为空时用于初始化 */
  new_value?: () => T;
  /** 未覆盖字段兜底区标题；不传则不渲染兜底区 */
  rest_title?: string;
}

export function FieldsForm<T extends object>(props: IFieldsFormProps<T>) {
  const {
    value: o_value,
    onChange,
    fields,
    rows = [],
    new_value,
    rest_title,
    stretchs = true,
    direction = 'column',
    ..._p
  } = props;
  const i_value = useMemo<T>(() => o_value ?? new_value?.() ?? ({} as T), [o_value, new_value]);
  const ref_o_value = useRef(o_value);
  const [form, _Form] = Form.useForm<T>(i_value);

  useEffect(() => {
    if (o_value == ref_o_value.current) return;
    form.resetFieldsValue(i_value);
  }, [i_value, o_value, form]);

  return (
    <_Form form={form} onChange={(_, value) => onChange?.(value)}>
      <Space direction={direction} stretchs={stretchs} {..._p}>
        {rows.map(v => <FieldsRow key={v.toString()} row={v} fields={fields} Form={_Form} />)}
        {rest_title != null ? (
          <FieldsRest title={rest_title} rows={rows} fields={fields} Form={_Form} />
        ) : null}
      </Space>
    </_Form>
  );
}
