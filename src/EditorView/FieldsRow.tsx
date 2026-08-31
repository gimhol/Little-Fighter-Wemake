import { Form } from "@/Component/Form";
import { Input, InputNumber } from "@/Component/Input";
import Select from "@/Component/Select";
import { Space } from "@/Component/Space";
import type { IField as IFieldInfo } from "@/LFW";
import { useCallback, useMemo } from "react";

export interface IFieldsRowProps<T extends object> {
  row: FieldKeysRow<T>,
  fields: Map<keyof T, IFieldInfo<Partial<T>>>,
  Form: Form<T>
}

/** 将位标志数值与多选数组互转的适配器 */
function BitFlagSelect(props: {
  value?: number;
  onChange?: (v: number) => void;
  options?: { value: any; label?: string; desc?: string }[];
  clearable?: boolean;
  title?: string;
}) {
  const { value, onChange, options = [], clearable, title } = props;

  /** 标记每个选项是否为原子值（不可由其他选项 OR 组合而成） */
  const atomicMask = useMemo(() => {
    const vals = options.map(o => Number(o.value));
    return options.map((_, i) => {
      const v = vals[i];
      let covered = 0;
      for (let j = 0; j < vals.length; j++) {
        if (j === i) continue;
        if ((vals[j] & ~v) === 0) covered |= vals[j];
      }
      return covered !== v;
    });
  }, [options]);

  /** 仅勾选原子选项中对应位已置1的项，复合值不自动勾选 */
  const arrayValue = useMemo(() => {
    if (value == null) return [];
    return options
      .filter((o, i) => atomicMask[i] && (value & Number(o.value)) === Number(o.value))
      .map(o => o.value);
  }, [value, options, atomicMask]);

  const onArrayChange = useCallback((v: number[] | undefined) => {
    onChange?.(v ? v.reduce((a, b) => a | b, 0) : 0);
  }, [onChange]);

  return (
    <Select
      multi
      clearable={clearable}
      title={title}
      options={options as any}
      value={arrayValue}
      onChange={onArrayChange}
      parse={(i: any) => [i.value, i.label, { title: i.desc }]} />
  );
}

/** 将 T | T[] 与多选数组互转的适配器（用于 array: 'auto' 字段） */
function AutoArraySelect(props: {
  value?: any;
  onChange?: (v: any) => void;
  options?: { value: any; label?: string; desc?: string }[];
  clearable?: boolean;
  title?: string;
}) {
  const { value, onChange, options = [], clearable, title } = props;

  /** 展示值：单值包装为数组，供多选渲染 */
  const arrayValue = useMemo(
    () => (value == null ? [] : Array.isArray(value) ? value : [value]),
    [value],
  );

  /** 变更值：空 → undefined；长度 1 归一化为单值；多值保留数组 */
  const onArrayChange = useCallback((v: any[] | undefined) => {
    if (!v || v.length === 0) onChange?.(undefined);
    else if (v.length === 1) onChange?.(v[0]);
    else onChange?.(v);
  }, [onChange]);

  return (
    <Select
      multi
      clearable={clearable}
      title={title}
      options={options}
      value={arrayValue}
      onChange={onArrayChange}
      parse={(i: any) => [i.value, i.label, { title: i.desc }]} />
  );
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
  } else if (type == 'int' || type == 'float') {
    return (
      <Form.Item name={key} label={label} >
        <InputNumber
          clearable={field.nullable == true}
          title={desc}
          precision={type == 'float' ? void 0 : 0}
          min={field.min}
          max={field.max}
          step={field.step} />
      </Form.Item>
    );
  } else if (type == 'string') {
    return (
      <Form.Item name={key} label={label}>
        <Input
          clearable={field.nullable == true}
          title={desc}
          maxLength={field.maxLength} />
      </Form.Item>
    );
  }
  return <></>;
}
