import { Input } from "@/Component/Input";
import { Space } from "@/Component/Space";
import { useState, useEffect } from "react";
import { FieldValueEditor } from "./FieldValueEditor";

/** 映射字段的单行：键 + 值编辑（失焦时提交键名） */
export function MapEntry(props: {
  entryKey: string;
  value?: any;
  valueField: any;
  onChangeKey: (k: string) => void;
  onChangeValue: (v: any) => void;
  onDelete: () => void;
}) {
  const { entryKey, value, valueField, onChangeKey, onChangeValue, onDelete } = props;
  const [key, setKey] = useState(entryKey);
  useEffect(() => setKey(entryKey), [entryKey]);
  return (
    <Space direction="row" stretchs={false} item_props={{ style: { flex: 1 } }}>
      <Input value={key} onChange={setKey} onBlur={() => onChangeKey(key.trim())} />
      <FieldValueEditor field={valueField} value={value} onChange={onChangeValue} />
      <button type="button" onClick={onDelete}>✕</button>
    </Space>
  );
}
