export interface IBaseFieldInfo<T extends object> {
  key: keyof T;
  order?: number;
  title?: string;
  desc?: string;
  options?: { value: any, label?: string, desc?: string }[]
  array?: boolean;
  nullable?: boolean;
}

export interface IIntFieldInfo<T extends object> extends IBaseFieldInfo<T> {
  type: 'int';
  min?: number;
  max?: number;
  step?: number;
  /** 该整数的不同位表示不同开关，配合options使用，UI将渲染为多选 */
  bitFlag?: boolean;
  options?: { value: number, label?: string, desc?: string }[]
}
export interface IFltFieldInfo<T extends object> extends IBaseFieldInfo<T> {
  type: 'float';
  min?: number;
  max?: number;
  step?: number;
  options?: { value: number, label?: string, desc?: string }[]
}
export interface IStrFieldInfo<T extends object> extends IBaseFieldInfo<T> {
  type: 'string';
  maxLength?: number;
  options?: { value: string, label?: string, desc?: string }[]
}
export interface IAnyFieldInfo<T extends object> extends IBaseFieldInfo<T> {
  type: '' | 'boolean'
}
export type IFieldInfo<T extends object> = IAnyFieldInfo<T> | IStrFieldInfo<T> | IIntFieldInfo<T> | IFltFieldInfo<T>
export type FieldType = IFieldInfo<object>['type'];

type IRet<T extends object> = Omit<IFieldInfo<T>, 'key' | 'order'>
type IArg<T extends object> = string | Omit<IFieldInfo<T>, 'key' | 'type' | 'order'>
const { assign } = Object

function w<T extends object>(type: IFieldInfo<T>['type'], ...args: IArg<T>[]): IRet<T> {
  const ret: IRet<T> = { type }
  for (let i = 0; i < args.length; i++) {
    const v = args[i];
    if (i == 0 && typeof v === 'string') ret.title = v
    if (i == 0 && typeof v === 'object') assign(ret, v)
    if (i == 1 && typeof v === 'string') ret.desc = v
    if (i == 1 && typeof v === 'object') assign(ret, v)
    if (i > 1 && typeof v === 'object') assign(ret, v)
  }
  return ret
}
export const str = assign(<T extends object>(...p: (string | Omit<IStrFieldInfo<T>, 'key' | 'type'>)[]): IRet<T> => w('string', ...p), w('string'))
export const flt = assign(<T extends object>(...p: (string | Omit<IFltFieldInfo<T>, 'key' | 'type'>)[]): IRet<T> => w('float', ...p), w('float'))
export const int = assign(<T extends object>(...p: (string | Omit<IIntFieldInfo<T>, 'key' | 'type'>)[]): IRet<T> => w('int', ...p), w('int'))

export const any = assign(<T extends object>(...p: (string | Omit<IFieldInfo<T>, 'key' | 'type'>)[]): IRet<T> => w('', ...p), w(''))

/**
 * 将字段定义对象转换为字段信息 Map
 *
 * 输入一个以字段名为 key、字段定义为 value 的普通对象，
 * 输出以字段名（keyof T）为 key、IFieldInfo 为 value 的 Map。
 *
 * 转换时，每个字段信息会被补充上：
 * - `key`：字段名
 * - `order`：按对象键的声明顺序自增的序号（0, 1, 2, ...）
 *
 * 生成的 Map 通常配合 `reorder_keys` / UI 表单渲染使用，
 * 以便按声明顺序稳定地展示与排序字段。
 *
 * @template T 目标对象类型（key 会被约束为 T 的字段）
 * @param source 字段定义对象：每个属性对应 T 的一个字段
 * @returns 字段名 → 字段信息的 Map
 */
export function fields<T extends object>(
  source: Required<{ [K in keyof T]: IRet<T> }>,
): Map<keyof T, IFieldInfo<T>> {
  const ret = new Map<keyof T, IFieldInfo<T>>();
  let order = 0;
  for (const k in source) {
    const key = k as keyof T;
    const value = assign({}, source[k], { key, order: order++ });
    ret.set(key, value as any);
  }
  return ret;
}

/** stupid? - Gim */
export function fields_map_2_fields_obj<T extends object>(map: Map<keyof T, IFieldInfo<T>>): Required<{ [K in keyof T]: IRet<T> }> {
  const obj: any = {}
  for (const [k, v] of map) {
    obj[k] = v;
  }
  return obj;
}


export function reorder_keys<T extends {}>(obj: Partial<T>, fields_map: Map<keyof T, IFieldInfo<Partial<T>>>) {
  const all_keys = new Set(Object.keys(obj));
  const known_keys = [...all_keys].filter(k => fields_map.get(k as any)?.order !== undefined);
  known_keys.sort((a, b) => (fields_map.get(a as any)?.order ?? 0) - (fields_map.get(b as any)?.order ?? 0));
  const kvs: [any, any][] = [];
  for (const key of known_keys) {
    const value = (obj as any)[key];
    delete (obj as any)[key];
    all_keys.delete(key);
    kvs.push([key, value]);
  }
  for (const key of all_keys) {
    const value = (obj as any)[key];
    delete (obj as any)[key];
    kvs.push([key, value]);
  }
  for (const [k, v] of kvs) {
    (obj as any)[k] = v;
  }
}
