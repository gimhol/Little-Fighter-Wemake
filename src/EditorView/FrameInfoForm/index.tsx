import { Button } from "@/Component/Buttons/Button";
import { Checkbox } from "@/Component/Checkbox";
import { Form } from "@/Component/Form";
import Frame from "@/Component/Frame";
import { type ISpaceProps, Space } from "@/Component/Space";
import { bdy_info_new, bpoint_info_new, chase_info_new, cpoint_new, frame_info_fields, frame_info_new, type IBdyInfo, type IFrameInfo, type IItrInfo, type IOpointInfo, itr_info_new, opoint_info_new, wpoint_info_new } from "@/LFW";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FieldsRest, FieldsRow } from "../FieldsRow";
import { BdyInfoForm } from "./BdyInfoForm";
import { BpointInfoForm } from "./BpointInfoForm";
import { ChaseInfoForm } from "./ChaseInfoForm";
import { CpointInfoForm } from "./CpointInfoForm";
import { ItrInfoForm } from "./ItrInfoForm";
import { OpointInfoForm } from "./OpointInfoForm";
import { WpointInfoForm } from "./WpointInfoForm";
import Show from "@/Component/Show";

type Data = IFrameInfo;
const data_new = frame_info_new;
const ALL_FIELDS = frame_info_fields;
const BASE_FIELD_KEYS: FieldKeysRow<Data>[] = [
  ['id', 'name'],
  ['state', 'wait'],
  ['centerx', 'centery'],
  ['width', 'height'],
  ['invisible', 'no_shadow', 'jump_flag'],
  ['behavior', 'facing', 'landable'],
  ['dvx', 'dvy', 'dvz'],
  ['vxm', 'vym', 'vzm'],
  ['acc_x', 'acc_y', 'acc_z'],
  ['ctrl_x', 'ctrl_y', 'ctrl_z'],
];

const arrayItemRemoveBtn: CSSProperties = {
  position: 'absolute',
  right: -5,
  top: -5,
  zIndex: 1,
  padding: 0,
  minWidth: 16,
  minHeight: 16,
  borderRadius: `50%`,
};




const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

type ArrayItemChange<T> = (item: T, index: number) => void;
type ArrayItemRemove = (index: number) => void;
type ArrayItemAdd = () => void;

function makeArrayHandlers<T extends object>(
  i_value: Data,
  key: keyof Data,
  _new: () => T,
  onChange?: (value: Data) => void,
): { onItemChange: ArrayItemChange<T>; onItemRemove: ArrayItemRemove; onItemAdd: ArrayItemAdd } {
  const arr = (i_value[key] || []) as T[];
  return {
    onItemChange(item: T, index: number) {
      const next = [...arr];
      next[index] = item;
      onChange?.({ ...i_value, [key]: next.length ? next : undefined });
    },
    onItemRemove(index: number) {
      const next = [...arr];
      next.splice(index, 1);
      onChange?.({ ...i_value, [key]: next.length ? next : undefined });
    },
    onItemAdd() {
      const next = [...arr, _new()];
      onChange?.({ ...i_value, [key]: next });
    },
  };
}

export interface IFrameInfoFormProps extends ISpaceProps {
  value?: Data;
  onChange?(value: Data): void;
}

export function FrameInfoForm(props: IFrameInfoFormProps) {
  const { value: o_value, onChange, stretchs = true, direction = 'column', ..._p } = props;
  const i_value = useMemo<Data>(() => o_value ?? data_new(), [o_value]);
  const ref_o_value = useRef(o_value);
  const [form, _Form] = Form.useForm<Data>(i_value);

  useEffect(() => {
    if (o_value == ref_o_value.current) return;
    form.resetFieldsValue(i_value);
  }, [i_value, o_value, form]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = useCallback((key: string, value?: boolean) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      value = value ?? !next.has(key);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  const isCollapsed = useCallback((key: string) => collapsed.has(key), [collapsed]);

  return (
    <_Form form={form} onChange={(_, value) => onChange?.(value)}>
      <Space direction={direction} stretchs={stretchs} {..._p}>
        {BASE_FIELD_KEYS.map(v => <FieldsRow key={'' + v} row={v} fields={ALL_FIELDS} Form={_Form} />)}
        <Checkbox
          prefix='追踪'
          value={!!i_value.chase}
          onChange={v => {
            const o_value = { ...i_value };
            if (o_value.chase) delete o_value.chase;
            else o_value.chase = chase_info_new();
            onChange?.(o_value)
          }} />
        {
          !i_value.chase ? null :
            <_Form.Item name='chase' label=''>
              <ChaseInfoForm />
            </_Form.Item>
        }
        <Checkbox
          prefix='武器点'
          value={!!i_value.wpoint}
          onChange={v => {
            const o_value = { ...i_value };
            if (o_value.wpoint) delete o_value.wpoint;
            else o_value.wpoint = wpoint_info_new();
            onChange?.(o_value)
          }} />
        {
          !i_value.wpoint ? null :
            <_Form.Item name='wpoint' label=''>
              <WpointInfoForm />
            </_Form.Item>
        }
        <Checkbox
          prefix='流血点'
          value={!!i_value.bpoint}
          onChange={v => {
            const o_value = { ...i_value };
            if (o_value.bpoint) delete o_value.bpoint;
            else o_value.bpoint = bpoint_info_new();
            onChange?.(o_value)
          }} />
        {
          !i_value.bpoint ? null :
            <_Form.Item name='bpoint' label=''>
              <BpointInfoForm />
            </_Form.Item>
        }
        <Checkbox
          prefix='抓取点'
          value={!!i_value.cpoint}
          onChange={v => {
            const o_value = { ...i_value };
            if (o_value.cpoint) delete o_value.cpoint;
            else o_value.cpoint = cpoint_new();
            onChange?.(o_value)
          }} />
        {
          !i_value.cpoint ? null :
            <_Form.Item name='cpoint' label=''>
              <CpointInfoForm />
            </_Form.Item>
        }
        {/* --- 碰撞盒 (bdy) --- */}
        <Space direction='row'>
          <Button variants={['no_border']} onClick={() => toggleCollapse('bdy')}>
            <Show show={i_value.bdy?.length}>
              {isCollapsed('bdy') ? '▶' : '▼'}
            </Show>
            碰撞盒
            <Show show={i_value.bdy?.length}>
              ({i_value.bdy?.length})
            </Show>
          </Button>
          <Button variants={['no_border']} onClick={() => {
            const arr = [...(i_value.bdy || [])];
            arr.push(bdy_info_new());
            onChange?.({ ...i_value, bdy: arr });
            toggleCollapse('bdy', false)
          }}>+</Button>
        </Space>
        {isCollapsed('bdy') ? null : i_value.bdy?.map((item, index) => {
          const { onItemChange, onItemRemove } = makeArrayHandlers<IBdyInfo>(i_value, 'bdy', bdy_info_new, onChange);
          return (
            <_Form.Item key={index} label={`碰撞盒 ${index + 1}`}>
              <Frame>
                <Button style={arrayItemRemoveBtn} size='ss' onClick={() => onItemRemove(index)}>✕</Button>
                <BdyInfoForm value={item} onChange={v => onItemChange(v, index)} />
              </Frame>
            </_Form.Item>
          );
        })}
        {/* --- 攻击盒 (itr) --- */}
        <Space direction='row'>
          <Button variants={['no_border']}
            onClick={() => toggleCollapse('itr')}>
            <Show show={i_value.itr?.length}>
              {isCollapsed('itr') ? '▶' : '▼'}
            </Show>
            攻击盒
            <Show show={i_value.itr?.length}>
              ({i_value.itr?.length})
            </Show>
          </Button>
          <Button variants={['no_border']}
            onClick={() => {
              const arr = [...(i_value.itr || [])];
              arr.push(itr_info_new());
              onChange?.({ ...i_value, itr: arr });
              toggleCollapse('itr', false)
            }}>+</Button>
        </Space>
        {isCollapsed('itr') ? null : i_value.itr?.map((item, index) => {
          const { onItemChange, onItemRemove } = makeArrayHandlers<IItrInfo>(i_value, 'itr', itr_info_new, onChange);
          return (
            <_Form.Item key={index} label={`攻击盒 ${index + 1}`}>
              <Frame>
                <Button style={arrayItemRemoveBtn} size='ss' onClick={() => onItemRemove(index)}>✕</Button>
                <ItrInfoForm value={item} onChange={v => onItemChange(v, index)} />
              </Frame>
            </_Form.Item>
          );
        })}
        {/* --- 发射点 (opoint) --- */}
        <Space direction='row'>
          <Button
            variants={['no_border']}
            onClick={() => toggleCollapse('opoint')}>
            <Show show={i_value.opoint?.length}>
              {isCollapsed('opoint') ? '▶' : '▼'}
            </Show>
            发射点
            <Show show={i_value.opoint?.length}>
              ({i_value.opoint?.length})
            </Show>
          </Button>
          <Button variants={['no_border']} onClick={() => {
            const arr = [...(i_value.opoint || [])];
            arr.push(opoint_info_new());
            onChange?.({ ...i_value, opoint: arr });
            toggleCollapse('opoint', false)
          }}>+</Button>
        </Space>

        {isCollapsed('opoint') ? null : i_value.opoint?.map((item, index) => {
          const { onItemChange, onItemRemove } = makeArrayHandlers<IOpointInfo>(i_value, 'opoint', opoint_info_new, onChange);
          return (
            <_Form.Item key={index} label={`发射点 ${index + 1}`}>
              <Frame>
                <Button style={arrayItemRemoveBtn} size='ss' onClick={() => onItemRemove(index)}>✕</Button>
                <OpointInfoForm value={item} onChange={v => onItemChange(v, index)} />
              </Frame>
            </_Form.Item>
          );
        })}
        <FieldsRest title="其他字段" rows={BASE_FIELD_KEYS} fields={ALL_FIELDS} Form={_Form} />
      </Space>
    </_Form>
  );
}
