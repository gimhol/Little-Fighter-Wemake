import Select from "@/Component/Select";
import { useMemo, useCallback } from "react";

/** 将 T | T[] 与多选数组互转的适配器（用于 array: 'auto' 字段） */
export function AutoArraySelect(props: {
  value?: any;
  onChange?: (v: any) => void;
  options?: { value: any; label?: string; desc?: string; }[];
  clearable?: boolean;
  title?: string;
}) {
  const { value, onChange, options = [], clearable, title } = props;

  /** 展示值：单值包装为数组，供多选渲染 */
  const arrayValue = useMemo(
    () => (value == null ? [] : Array.isArray(value) ? value : [value]),
    [value]
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
