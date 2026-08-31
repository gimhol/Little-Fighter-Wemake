import Select from "@/Component/Select";
import { useMemo, useCallback } from "react";

/** 将位标志数值与多选数组互转的适配器 */
export function BitFlagSelect(props: {
  value?: number;
  onChange?: (v: number) => void;
  options?: { value: any; label?: string; desc?: string; }[];
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
