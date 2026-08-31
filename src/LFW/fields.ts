export interface IBaseField<T extends object, V extends any = any> {
  /** 字段名 */
  key: keyof T;

  /** 序号 */
  order?: number;

  /** 标题 */
  title?: string;

  /** 描述 */
  desc?: string;

  /**
   * 数组形态：
   * - `true`：值必须是数组 T[]
   * - `false` / 缺省：值必须是单值 T
   * - `'auto'`：单值 T 或数组 T[] 皆可
   */
  array?: boolean | 'auto';

  /** 允许无此字段或允许此字符为null */
  nullable?: boolean;

  /** 选项，值必须符合之一 */
  options?: { value: V, label?: string, desc?: string }[]
}
export interface IIntField<T extends object> extends IBaseField<T, number> {
  type: 'int';
  min?: number;
  max?: number;
  step?: number;
  /** 该整数的不同位表示不同开关，配合options使用，UI将渲染为多选 */
  bitFlag?: boolean;
}
export interface IFltField<T extends object> extends IBaseField<T, number> {
  type: 'float' | 'flt' | 'num';
  min?: number;
  max?: number;
  step?: number;
}
export interface IStrField<T extends object> extends IBaseField<T, string> {
  type: 'string' | 'str';
  maxLength?: number;
}
export interface IBoolField<T extends object> extends IBaseField<T, boolean> {
  type: 'boolean' | 'bool'
}
export interface IObjField<T extends object, D extends object = object> extends IBaseField<T> {
  type: 'object' | 'obj',
  fields: Map<keyof D, IField<D>>
}
export interface IMapField<T extends object, D extends object = object> extends IBaseField<T> {
  type: 'map';
  /** 每个值的字段定义（键为任意字符串，值按此定义校验/编辑） */
  value: Omit<IField<D>, 'key'>;
}
export interface IAnyField<T extends object> extends IBaseField<T> {
  type: ''
}
export type IField<T extends object> = IAnyField<T> | IStrField<T> | IIntField<T> | IFltField<T> | IBoolField<T> | IObjField<T> | IMapField<T>
export type FieldType = IField<object>['type'];

type IRet<T extends object> = Omit<IField<T>, 'key' | 'order'>
type IArg<T extends object> = string | Omit<IField<T>, 'key' | 'type' | 'order'>
const { assign } = Object

function w<T extends object>(type: IField<T>['type'], ...args: IArg<T>[]): IRet<T> {
  const ret: IRet<T> = { type }
  let s: number = 0;
  for (let i = 0; i < args.length; i++) {
    const v = args[i];
    if (typeof v === 'string') {
      if (s == 0) ret.title = v;
      else if (s == 1) ret.desc = v;
      else ret.desc += '\n' + v;
      ++s;
    }
    if (typeof v === 'object') assign(ret, v);
  }
  return ret
}
export const str = assign(<T extends object>(...p: (string | Omit<IStrField<T>, 'key' | 'type'>)[]): IRet<T> => w('string', ...p), w('string'))
export const flt = assign(<T extends object>(...p: (string | Omit<IFltField<T>, 'key' | 'type'>)[]): IRet<T> => w('float', ...p), w('float'))
export const int = assign(<T extends object>(...p: (string | Omit<IIntField<T>, 'key' | 'type'>)[]): IRet<T> => w('int', ...p), w('int'))
export const bool = assign(<T extends object>(...p: (string | Omit<IBoolField<T>, 'key' | 'type'>)[]): IRet<T> => w('boolean', ...p), w('boolean'))
export const obj = assign(<T extends object, D extends object>(...p: (string | Omit<IObjField<T, D>, 'key' | 'type'>)[]): IRet<T> => w('object', ...p), w('object'))
export const map = assign(<T extends object, D extends object>(...p: (string | Omit<IMapField<T, D>, 'key' | 'type'>)[]): IRet<T> => w('map', ...p), w('map'))
export const any = assign(<T extends object>(...p: (string | Omit<IField<T>, 'key' | 'type'>)[]): IRet<T> => w('', ...p), w(''))

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
 * 生成的 Map 通常配合 `reorder_fields` / UI 表单渲染使用，
 * 以便按声明顺序稳定地展示与排序字段。
 *
 * @template T 目标对象类型（key 会被约束为 T 的字段）
 * @param source 字段定义对象：每个属性对应 T 的一个字段
 * @returns 字段名 → 字段信息的 Map
 */
export function fields<T extends object>(
  source: Required<{ [K in keyof T]: IRet<T> }>,
): Map<keyof T, IField<T>> {
  const ret = new Map<keyof T, IField<T>>();
  let order = 0;
  for (const k in source) {
    const key = k as keyof T;
    const value = assign({}, source[k], { key, order: order++ });
    ret.set(key, value as any);
  }
  return ret;
}

/** stupid? - Gim */
export function fields_map_2_fields_obj<T extends object>(map: Map<keyof T, IField<T>>): Required<{ [K in keyof T]: IRet<T> }> {
  const obj: any = {}
  for (const [k, v] of map) {
    obj[k] = v;
  }
  return obj;
}

export function reorder_fields<T extends {}>(obj: Partial<T>, fields_map: Map<keyof T, IField<Partial<T>>>) {
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

/** 校验单个字段值；path 用于错误定位（如 root.id、root.bdy[0].x） */
function _validate_value<T extends object>(
  value: unknown,
  field: IField<T>,
  path: string,
  errors: string[],
  warnings: string[],
): boolean {
  const { type, array, nullable } = field;

  // 缺失 / null：仅 nullable 时允许
  if (value === null || value === undefined) {
    if (nullable) return true;
    errors.push(`[validate_fields] ${path} 不允许为空（未声明 nullable），实际为 ${String(value)}`);
    return false;
  }

  // 数组：array === true 强制数组；array === 'auto' 时单值或数组皆可
  const isArray = Array.isArray(value);
  if (array === true && !isArray) {
    errors.push(`[validate_fields] ${path} 应为数组，实际为 ${JSON.stringify(value)}`);
    return false;
  }
  if (isArray && (array === true || array === 'auto')) {
    let ok = true;
    for (let i = 0; i < value.length; i++) {
      if (!_validate_value(value[i], { ...field, array: false } as IField<T>, `${path}[${i}]`, errors, warnings))
        ok = false;
    }
    return ok;
  }

  // 类型校验
  switch (type) {
    case 'int':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        errors.push(`[validate_fields] ${path} 应为整数，实际为 ${JSON.stringify(value)}`);
        return false;
      }
      if (field.min !== undefined && value < field.min) {
        errors.push(`[validate_fields] ${path} 不能小于 ${field.min}，实际为 ${value}`);
        return false;
      }
      if (field.max !== undefined && value > field.max) {
        errors.push(`[validate_fields] ${path} 不能大于 ${field.max}，实际为 ${value}`);
        return false;
      }
      break;

    case 'float':
    case 'flt':
    case 'num':
      if (typeof value !== 'number') {
        errors.push(`[validate_fields] ${path} 应为数字，实际为 ${JSON.stringify(value)}`);
        return false;
      }
      if (field.min !== undefined && value < field.min) {
        errors.push(`[validate_fields] ${path} 不能小于 ${field.min}，实际为 ${value}`);
        return false;
      }
      if (field.max !== undefined && value > field.max) {
        errors.push(`[validate_fields] ${path} 不能大于 ${field.max}，实际为 ${value}`);
        return false;
      }
      break;

    case 'string':
    case 'str':
      if (typeof value !== 'string') {
        errors.push(`[validate_fields] ${path} 应为字符串，实际为 ${JSON.stringify(value)}`);
        return false;
      }
      if (field.maxLength !== undefined && value.length > field.maxLength) {
        errors.push(`[validate_fields] ${path} 长度不能超过 ${field.maxLength}，实际为 ${value.length}`);
        return false;
      }
      break;

    case 'boolean':
    case 'bool':
      if (typeof value !== 'boolean') {
        errors.push(`[validate_fields] ${path} 应为布尔值，实际为 ${JSON.stringify(value)}`);
        return false;
      }
      break;

    case 'object':
    case 'obj':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push(`[validate_fields] ${path} 应为对象，实际为 ${JSON.stringify(value)}`);
        return false;
      }
      return _validate_obj(value as object, field.fields, path, errors, warnings);

    case 'map': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push(`[validate_fields] ${path} 应为对象（键值映射），实际为 ${JSON.stringify(value)}`);
        return false;
      }
      let ok = true;
      for (const k of Object.keys(value)) {
        if (!_validate_value((value as any)[k], field.value as IField<T>, `${path}.${k}`, errors, warnings))
          ok = false;
      }
      return ok;
    }

    case '':
    default:
      break;
  }

  // 选项白名单（bitFlag 为位组合值，不做白名单校验）
  if (field.options && !(field as IIntField<T>).bitFlag) {
    if (!field.options.some(o => o.value === value)) {
      errors.push(
        `[validate_fields] ${path} 必须为 [${field.options.map(o => JSON.stringify(o.value)).join(', ')}] 之一，实际为 ${JSON.stringify(value)}`,
      );
      return false;
    }
  }
  return true;
}

/** 按字段 Map 逐字段校验对象；未在 Map 中声明的字段会记入 warnings */
function _validate_obj<T extends object>(
  obj: object,
  map: Map<keyof T, IField<T>>,
  path: string,
  errors: string[],
  warnings: string[],
): boolean {
  let ok = true;
  for (const key of Object.keys(obj)) {
    if (!map.has(key as keyof T)) {
      warnings.push(`[validate_fields] ${path} 存在未知字段 "${String(key)}"（未在字段 Map 中声明）`);
    }
  }
  for (const [key, field] of map) {
    const value = (obj as any)[key];
    if (!_validate_value(value, field, `${path}.${String(key)}`, errors, warnings))
      ok = false;
  }
  return ok;
}

/**
 * 校验数据对象是否符合字段定义 Map。
 *
 * - 缺失字段 / null：仅在字段声明 `nullable: true` 时通过；
 * - `array: true`：值为数组，逐元素按字段类型校验；
 * - `options`：值必须为其中之一（`bitFlag` 字段除外，其值为位组合）；
 * - `min`/`max`（int/float）、`maxLength`（string）、嵌套 `object` 会递归校验；
 * - 对象中存在但未在 Map 中声明的字段会记入 warnings（不导致失败）。
 *
 * @param obj 待校验数据
 * @param map 字段定义 Map
 * @param errors 可选，用于收集错误信息（可复用同一数组）
 * @param warnings 可选，用于收集非致命告警（如未知字段）
 * @returns 通过时返回 true，并将类型收窄为 Partial<T>
 */
export function validate_fields<T extends object>(
  obj: unknown,
  map: Map<keyof T, IField<T>>,
  errors: string[] = [],
  warnings: string[] = [],
): obj is Partial<T> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    errors.push(`[validate_fields] 根值应为对象，实际为 ${JSON.stringify(obj)}`);
    return false;
  }
  return _validate_obj(obj as object, map, 'root', errors, warnings);
}

/**
 * 将 `T | T[] | null | undefined` 归一化为数组。
 *
 * 配合 `array: 'auto'` 字段使用，方便下游统一按数组消费。
 *
 * @param v 单值或数组（可为空）
 * @returns 数组；null/undefined 返回空数组
 */
export function as_array<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}
