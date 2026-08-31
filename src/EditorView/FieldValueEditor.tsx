import { Input, InputNumber } from "@/Component/Input";
import Select from "@/Component/Select";
import { ObjectField } from "./ObjectField";

/** 单值编辑器：按字段类型分派（用于 map 的值） */
export function FieldValueEditor(props: {
  field: any;
  value?: any;
  onChange?: (v: any) => void;
}) {
  const { field, value, onChange } = props;
  const { type, array } = field;

  // 数组值：JSON 文本兜底编辑
  if (array && Array.isArray(value)) {
    return (
      <Input
        value={value == null ? '' : JSON.stringify(value)}
        onChange={v => {
          if (v.trim() === '') return onChange?.(undefined);
          try { onChange?.(JSON.parse(v)); } catch { /* 非法 JSON 时保留原值 */ }
        }} />
    );
  }
  if (type === 'int' || type === 'float' || type === 'flt' || type === 'num') {
    return <InputNumber value={value} onChange={onChange} />;
  }
  if (type === 'boolean' || type === 'bool') {
    return (
      <Select
        clearable
        options={[{ value: true, label: 'true' }, { value: false, label: 'false' }]}
        value={value}
        onChange={onChange}
        parse={(i: any) => [i.value, i.label]} />
    );
  }
  if (type === 'object' || type === 'obj') {
    return <ObjectField fields={field.fields} value={value} onChange={onChange} />;
  }
  return <Input value={value ?? ''} onChange={onChange} />;
}
