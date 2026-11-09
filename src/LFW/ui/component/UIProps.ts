import type { IPropsMeta } from '../../defines/ISchema';
import { make_schema } from '../../utils/schema/make_schema';
import { SchemaValidator } from "../../utils/schema/validate_schema";
import { is_num } from '../../utils/type_check/is_num';
import { is_str } from '../../utils/type_check/is_str';
import { parse_ui_value } from "../read_info_value";
import { isUIComponentClass } from "../utils/isUIComponentClass";
import { isUINodeClass } from "../utils/isUINodeClass";
import { read_nums } from "../utils/read_nums";
import type { UIComponent } from "./UIComponent";

export interface IUIPropsCallback { }
export class UIProps {
  readonly raw: { [x in string]?: any };
  readonly owner: UIComponent<unknown, any>;
  readonly validator = new SchemaValidator().instance_getter((value, clazz) => {
    if (isUIComponentClass(clazz)) {
      if (typeof value !== 'string') return null
      const mine = this.owner.node.search_component(clazz, v => v.id == value);
      if (mine) return mine;
      return this.owner.node.parent?.lookup_component(clazz, v => v.id == value) ?? null
    } else if (isUINodeClass(clazz)) {
      if (typeof value !== 'string') return null
      const spec = this.owner.find_node(value)
      if (spec) return spec;
      const mine = this.owner.node.search_node(value)
      if (mine) return mine;
      return this.owner.node.parent?.lookup_node(value) ?? null
    }
    return null
  }).instance_setter((value, clazz) => {

  })
  get errors() { return this.validator.errors }
  constructor(raw: { [x in string]?: any }, owner: UIComponent<unknown, any>) {
    for (const key in raw) {
      const value = raw[key];
      if (typeof value === 'string' && value.startsWith(`$val:`)) {
        raw[key] = parse_ui_value(owner.node, null, value) ?? value
      }
    }
    this.raw = { ...raw };
    this.owner = owner;
  }
  num(name: string): number | null {
    if (!(name in this.raw)) return null;
    const v = this.raw[name];
    return is_num(v) ? v : null;
  }
  set_num(name: string, v: number | null) {
    this.raw[name] = v;
  }
  str<T extends string = string>(name: string, one_of?: T[]): T | null {
    if (!(name in this.raw)) return null;
    const ret: T = this.raw[name];
    if (!is_str(ret)) return null;
    if (!one_of?.length) return ret;
    if (one_of.some(a => a === ret)) return ret;
    return null;
  }
  private _any_str_arr(v: any, out: string[] = []): void {
    if (v === void 0 || v === null) return
    if (Array.isArray(v)) for (const i of v) {
      this._any_str_arr(i, out)
    }
    switch (typeof v) {
      case "string":
        out.push(...v.split(','));
        break;
      case "number":
      case "bigint":
      case "boolean":
      case "symbol":
        out.push(v.toString())
        break;
    }
  }
  set_strs(name: string, v: string[]) {
    this.raw[name] = v;
  }
  strs(name: string): string[] | null {
    if (!(name in this.raw)) return null;
    const out: string[] = [];
    this._any_str_arr(this.raw[name], out);
    return out;
  }
  bool(name: string): boolean | null {
    if (!(name in this.raw)) return null;
    const v = this.raw[name];
    return !['false', '0'].some(b => b === '' + v);
  }
  nums(name: string, len: 4, fallbacks?: number[] | number): [number, number, number, number];
  nums(name: string, len: 3, fallbacks?: number[] | number): [number, number, number];
  nums(name: string, len: 2, fallbacks?: number[] | number): [number, number];
  nums(name: string, len: 1, fallbacks?: number[] | number): [number];
  nums(name: string, len: number, fallbacks?: number[] | number): number[];
  nums(name: string, len: number, fallbacks?: number[] | number): number[] {
    return read_nums(this.raw[name], len, fallbacks);
  }
  component() {
    return this.owner.node.search_component
  }
  validate<P>(Cls: { TAG: string, PROPS: IPropsMeta<P> }): P | null {
    const { TAG, PROPS } = Cls
    this.validator.validate(this.raw, make_schema({
      key: TAG + 'Props',
      type: 'object',
      properties: PROPS
    }))
    if (!this.validator.errors.length)
      return this.raw as P;
    return null
  }
}
