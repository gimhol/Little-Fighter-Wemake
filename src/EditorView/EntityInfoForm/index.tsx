
import { Checkbox } from "@/Component/Checkbox";
import { Form } from "@/Component/Form";
import { armor_Info_new, drink_info_new, entity_info_fields } from "@/LFW";
import { entity_info_new, type IEntityInfo } from "@/LFW/defines";
import { useEffect, useMemo, useRef } from "react";
import { type ISpaceProps, Space } from "../../Component/Space";
import { FieldsRest, FieldsRow } from "../FieldsRow";
import { ArmorInfoForm } from "./ArmorInfoForm";
import { DrinkInfoForm } from "./DrinkInfoForm";

type Data = IEntityInfo;
const data_new = entity_info_new;
const ALL_FIELDS = entity_info_fields
const BASE_FIELD_KEYS: FieldKeysRow<Data>[] = [
  ['type', "group", 'name'],
  ['ce', 'weight'],
  ['jump_height', 'jump_distance', 'jump_distancez'],
  ['dash_height', 'dash_distance', 'dash_distancez'],
  ['rowing_height', 'rowing_distance'],
  ['bounce_y', 'bounce_x', 'bounce_z'],
  ['bounce_min_y', 'bounce_min_x', 'bounce_min_z'],
  ['fast_vy', 'fast_vx', 'fast_vz'],
]
export interface IEntityInfoFormProps extends ISpaceProps {
  value?: Data;
  onChange?(value: Data): void;
}
export function EntityInfoForm(props: IEntityInfoFormProps) {
  const { value: o_value, onChange, stretchs = true, direction = 'column', ..._p } = props;
  const i_value = useMemo(() => o_value ?? data_new(), [o_value])
  const ref_o_value = useRef(o_value);
  const [form, _Form] = Form.useForm<Data>(i_value);
  useEffect(() => {
    if (o_value == ref_o_value.current) return;
    form.resetFieldsValue(i_value)
  }, [i_value, o_value, form])

  return (
    <_Form form={form} onChange={(_, value) => onChange?.(value)}>
      <Space direction={direction} stretchs={stretchs} {..._p}>
        {BASE_FIELD_KEYS.map(v => <FieldsRow key={'' + v} row={v} fields={ALL_FIELDS} Form={_Form} />)}
        <Checkbox
          prefix='护甲'
          value={!!i_value.armor}
          onChange={v => {
            const o_value = { ...i_value };
            if (o_value.armor) delete o_value.armor;
            else o_value.armor = armor_Info_new();
            onChange?.(o_value)
          }} />
        {
          !i_value.armor ? null :
            <_Form.Item name='armor' label=''>
              <ArmorInfoForm />
            </_Form.Item>
        }
        <Checkbox
          prefix='饮料'
          value={!!i_value.drink}
          onChange={v => {
            const o_value = { ...i_value };
            if (o_value.drink) delete o_value.drink;
            else o_value.drink = drink_info_new();
            onChange?.(o_value)
          }} />
        {
          !i_value.drink ? null :
            <_Form.Item name='drink' label=''>
              <DrinkInfoForm />
            </_Form.Item>
        }
        <FieldsRest title="其他字段" rows={BASE_FIELD_KEYS} fields={ALL_FIELDS} Form={_Form} />
      </Space>
    </_Form>
  );
}

