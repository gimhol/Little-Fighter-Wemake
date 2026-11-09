import type { Unsafe } from "../utils";

type BaseType = 'string' | 'number' | 'boolean'

/**
 * `$val:` 解析所需的最小值查找作用域
 *
 * - `values` / `template_values`：值表
 * - `parent`：沿父链向上查找
 *
 * `UINode` 与 cook 阶段的 `ICookedUIInfo` 都天然满足该结构；
 * 解析逻辑不再依赖“已 cook 的 UI 数据”这个具体类型。
 */
export interface IUIValueScope {
  values?: { [x in string]?: any };
  template_values?: { [x in string]?: any };
  parent?: IUIValueScope;
}
export type Cls<T> = new (...args: any[]) => T

export interface ITypeJudger<C = unknown> {
  readonly _$_judger: true;
  run(v: any): v is C;
}
/** @deprecated 如有条件，应当更精确的确认内部数据 */
export function unsafe_is_object<T extends unknown>() {
  return judger<T>((v: any): v is T => {
    return typeof v === 'object' && !Array.isArray(v);
  });
}

/** @deprecated 如有条件，应当更精确的确认内部数据 */
export const unsafe_is_array = judger(v => Array.isArray(v))

export const is_0_or_1 = judger((v): v is 0 | 1 => v === 0 || v === 1)
export function judger<C = unknown>(run: (v: any) => v is C): ITypeJudger<C> {
  return { _$_judger: true as const, run }
}

function is_judger(v: any): v is ITypeJudger {
  if (!v) return false;
  if (!v._$_judger) return false;
  return typeof v.run == 'function';
}

export function find_ui_value(ui: IUIValueScope, name: string): unknown | null {
  let current: Unsafe<IUIValueScope> = ui;
  while (current) {
    const value = current.values?.[name];
    if (value !== null && value !== undefined) {
      return value;
    }
    current = current.parent;
  }
  current = ui;
  while (current) {
    const value = current.template_values?.[name];
    if (value !== null && value !== undefined) {
      return value;
    }
    current = current.parent;
  }
  return null;
}

type AllType<T extends BaseType, C> =
  BooleanConstructor |
  NumberConstructor |
  StringConstructor |
  T | Cls<C> | ITypeJudger |
  null;
export function parse_ui_value(ui: IUIValueScope, type: null, value: unknown): any | null;
export function parse_ui_value(ui: IUIValueScope, type: BooleanConstructor | 'boolean', value: unknown): boolean | null;
export function parse_ui_value(ui: IUIValueScope, type: NumberConstructor | 'number', value: unknown): number | null;
export function parse_ui_value(ui: IUIValueScope, type: StringConstructor | 'string', value: unknown): string | null;
export function parse_ui_value<T>(ui: IUIValueScope, type: ITypeJudger<T>, value: unknown): T | null
export function parse_ui_value<T extends BaseType, C>(ui: IUIValueScope, type: Cls<C> | null, value: unknown): C | T | null
export function parse_ui_value<T extends BaseType, C>(ui: IUIValueScope, type: AllType<T, C>, value: unknown): C | T | null {
  let ret: unknown = value
  if (ret === null || ret === void 0)
    return null
  if (!ui)
    throw new Error(`[parse_ui_value] failed, ui is not an object, got ${ui}`)
  if (Array.isArray(ui))
    throw new Error(`[parse_ui_value] failed, ui is not an object, got ${ui}`)
  if (typeof ui !== 'object')
    throw new Error(`[parse_ui_value] failed, ui is not an object, got ${ui}`)

  if (typeof ret == 'string' && ret.trim().startsWith("$val:")) {
    ret = find_ui_value(ui, ret.substring(5).trim());
    if (ret === null || ret === void 0)
      return null;
  }
  switch (type) {
    case 'boolean': case Boolean:
      if (typeof ret != 'boolean')
        throw { ui, error: new Error(`[parse_ui_value] failed, value must be boolean, got ${ret}, src: ${value}`) }
      return ret as any
    case 'number': case Number:
      if (typeof ret != 'number')
        throw { ui, error: new Error(`[parse_ui_value] failed, value must be number, got ${ret}, src: ${value}`) }
      return ret as any
    case 'string': case String:
      if (typeof ret != 'string')
        throw { ui, error: new Error(`[parse_ui_value] failed, value must be string, got ${ret}, src: ${value}`) }
      return ret as any
  }
  if (is_judger(type)) {
    if (type.run(ret)) return ret as any
    return null
  }
  if (typeof type === 'function') {
    if (ret instanceof type) return ret as any;
    return null;
  }
  return ret as any;
}