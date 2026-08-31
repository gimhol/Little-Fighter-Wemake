import { Input } from "@/Component/Input";
import { Space } from "@/Component/Space";
import { useState, useCallback } from "react";
import { MapEntry } from "./MapEntry";

/** 映射字段：动态键值编辑（用于 type: 'map'） */
export function MapField(props: {
  value?: any;
  onChange?: (v: any) => void;
  valueField: any;
}) {
  const { value, onChange, valueField } = props;
  const record: Record<string, any> = value ?? {};
  const [newKey, setNewKey] = useState('');

  const update = useCallback((next: Record<string, any>) => {
    onChange?.(next);
  }, [onChange]);

  const rename = useCallback((oldKey: string, newKey: string) => {
    if (!newKey || newKey === oldKey) return;
    const next: Record<string, any> = {};
    for (const k of Object.keys(record)) next[k === oldKey ? newKey : k] = record[k];
    update(next);
  }, [record, update]);

  return (
    <Space direction="column" stretchs>
      {Object.keys(record).map(k => (
        <MapEntry
          key={k}
          entryKey={k}
          value={record[k]}
          valueField={valueField}
          onChangeKey={nk => rename(k, nk)}
          onChangeValue={v => update({ ...record, [k]: v })}
          onDelete={() => { const n = { ...record }; delete n[k]; update(n); }} />
      ))}
      <Space direction="row" stretchs={false}>
        <Input value={newKey} onChange={setNewKey} placeholder="新键名" />
        <button
          type="button"
          onClick={() => {
            const k = newKey.trim();
            if (!k || k in record) return;
            update({ ...record, [k]: undefined });
            setNewKey('');
          }}>
          +
        </button>
      </Space>
    </Space>
  );
}
