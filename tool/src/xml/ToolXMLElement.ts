import { XMLBuilder } from "fast-xml-parser";
import type { BaseValue, IXMLElement, Voidable } from "../../../src/LFW/ditto/xml/IXMLElement";

const VALUE_TAGS = new Set(['number', 'boolean', 'object', 'array', 'string', 'value']);

/**
 * LF2 工具使用的 XML 元素实现
 *
 * 基于 fast-xml-parser 进行 XML 序列化
 */
export class ToolXMLElement implements IXMLElement {
  readonly tag: string;
  private _attrs: { name: string; value: string }[] = [];
  private _children: ToolXMLElement[] = [];
  private _parent: ToolXMLElement | null = null;
  private _text: string = '';

  get type(): string | undefined {
    let type: string | undefined = this.tag.toLowerCase();
    if (type === 'value') type = this.attr('type')?.toLowerCase();
    return type;
  }

  get text(): string { return this._text; }
  get children(): ToolXMLElement[] { return this._children; }
  get attrs(): { name: string; value: string }[] { return this._attrs; }
  get parent(): ToolXMLElement | undefined { return this._parent ?? undefined; }

  constructor(tag: string) { this.tag = tag; }

  attr(name: string): string | undefined {
    return this._attrs.find(a => a.name === name)?.value;
  }

  del_attr(name: string): void {
    const i = this._attrs.findIndex(a => a.name === name);
    if (i >= 0) this._attrs.splice(i, 1);
  }

  str_attr(name: string): string | undefined {
    return this.attr(name);
  }

  num_attr(name: string): number | undefined {
    const v = this.attr(name);
    return v != null ? Number(v) : undefined;
  }

  bool_attr(name: string): boolean | undefined {
    const v = this.attr(name);
    return v != null ? v === 'true' || v === '1' : undefined;
  }

  strs_attr(name: string, sep: string = ','): string[] | undefined {
    const v = this.attr(name);
    if (v == null) return void 0;
    return v.split(sep).map(s => s.trim());
  }

  nums_attr(name: string, sep: string = ','): number[] | undefined {
    const v = this.attr(name);
    if (v == null) return void 0;
    return v.split(sep).map(s => Number(s.trim()));
  }

  strs_attr_soft(name: string, sep: string = ','): Voidable<string>[] | undefined {
    const v = this.attr(name);
    if (v == null) return void 0;
    return v.split(sep).map(s => s.trim() || void 0);
  }

  nums_attr_soft(name: string, sep: string = ','): Voidable<number>[] | undefined {
    const v = this.attr(name);
    if (v == null) return void 0;
    return v.split(sep).map(s => s.trim() === '' ? void 0 : Number(s.trim()));
  }

  set_attr(name: string, value: Voidable<BaseValue | BaseValue[]>, sep: string = ','): void {
    if (value === void 0 || value === null) return this.del_attr(name);
    const existing = this._attrs.find(a => a.name === name);
    const sv = Array.isArray(value) ? value.join(sep) : String(value);
    if (existing) existing.value = sv;
    else this._attrs.push({ name, value: sv });
  }


  as_value(): number | boolean | string | object | undefined {
    switch (this.type) {
      case 'string': return this.as_string();
      case 'number': return this.as_number();
      case 'boolean': return this.as_boolean();
      case 'array': return this.as_array();
      default: return this.as_object();
    }
  }

  as_string(or: string): string;
  as_string(or?: string): string | undefined;
  as_string(or?: string): string | undefined {
    if ('string' !== this.type) return or;
    return this.attr('value') ?? this._text;
  }

  as_number(or: number): number;
  as_number(or?: number): number | undefined;
  as_number(or?: number): number | undefined {
    if ('number' !== this.type) return or;
    const txt = this.as_string();
    if (txt == null) return or;
    const ret = Number(txt);
    return isNaN(ret) ? or : ret;
  }

  as_boolean(or: boolean): boolean;
  as_boolean(or?: boolean): boolean | undefined;
  as_boolean(or?: boolean): boolean | undefined {
    if ('boolean' !== this.type) return or;
    const txt = this.as_string()?.toLowerCase();
    if (txt === '1' || txt === 'true') return true;
    if (txt === '0' || txt === 'false') return false;
    return or;
  }

  as_array(or: any[]): any[];
  as_array(or?: any[]): any[] | undefined;
  as_array(or?: any[]): any[] | undefined {
    if ('array' !== this.type) return or;
    const ret: any[] = [];
    for (const child of this._children) ret.push(child.as_value());
    return ret;
  }

  as_object(or: object): object;
  as_object(or?: object): object | undefined;
  as_object(or?: object): object | undefined {
    const ret: Record<string, any> = {};
    for (const attr of this._attrs) ret[attr.name] = attr.value;
    for (const child of this._children) {
      const key = child.attr('name') || child.tag;
      if (key) ret[key] = child.as_value();
    }
    return Object.keys(ret).length ? ret : or;
  }

  action_str(): string {
    const name = this.attr('action') || this.attr('name');
    if (name) {
      const args = this.attr('args');
      return args ? `${name}(${args})` : `${name}()`;
    }
    return this._text;
  }

  stringify(): string {
    const builder = new XMLBuilder({
      format: true,
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      suppressEmptyNode: false,
    });
    const obj = this._toFXPObject();
    const xml = builder.build(obj);
    return typeof xml === 'string' ? xml : '';
  }

  private _toFXPObject(): any {
    const attrObj: Record<string, any> = {};
    for (const a of this._attrs) attrObj[`@_${a.name}`] = a.value;

    if (this._children.length) {
      const childObj: Record<string, any> = {};
      for (const child of this._children) {
        const co = child._toFXPObject();
        const key = Object.keys(co)[0]; // tag name as key
        if (childObj[key]) {
          if (!Array.isArray(childObj[key])) childObj[key] = [childObj[key]];
          childObj[key].push(co[key]);
        } else {
          childObj[key] = co[key];
        }
      }
      return { [this.tag]: { ...attrObj, ...childObj } };
    }

    if (this._text) {
      return { [this.tag]: { ...attrObj, '#text': this._text } };
    }

    return { [this.tag]: Object.keys(attrObj).length ? attrObj : undefined };
  }

  insert(child?: ToolXMLElement, index?: number): void {
    if (!child) return;
    child._parent = this;
    if (index === void 0 || index >= this._children.length) {
      this._children.push(child);
    } else {
      this._children.splice(index, 0, child);
    }
  }

  remove(child: ToolXMLElement): boolean {
    const i = this._children.indexOf(child);
    if (i < 0) return false;
    this._children.splice(i, 1);
    child._parent = null;
    return true;
  }

  remove_self(): boolean {
    if (!this._parent) return false;
    return this._parent.remove(this);
  }

  remove_all(): void {
    for (const c of this._children) c._parent = null;
    this._children.length = 0;
  }

  has_attr(name: string): boolean {
    return this._attrs.some(a => a.name === name);
  }

  set_text(text: string): void {
    this._text = text;
  }

  children_by_tag(tag: string): ToolXMLElement[] {
    return this._children.filter(c => c.tag === tag);
  }

  child_by_tag(tag: string): ToolXMLElement | undefined {
    return this._children.find(c => c.tag === tag);
  }

  get_obj(tag: string): object | undefined {
    return this.child_by_tag(tag)?.as_object();
  }

  _addChild(child: ToolXMLElement): void {
    child._parent = this;
    this._children.push(child);
  }

  _setText(text: string): void {
    this._text = text;
  }

  _appendText(text: string): void {
    this._text += text;
  }

  get_str(name: string, or: string): string;
  get_str(name: string, or?: string): string | undefined;
  get_str(name: string, or?: string): string | undefined {
    return this.child_by_tag(name)?.as_string() ?? this.attr(name) ?? or;
  }
  get_num(name: string, or: number): number;
  get_num(name: string, or?: number): number | undefined;
  get_num(name: string, or?: number): number | undefined {
    return this.child_by_tag(name)?.as_number() ?? this.num_attr(name) ?? or;
  }
  get_bool(name: string, or: boolean): boolean;
  get_bool(name: string, or?: boolean): boolean | undefined;
  get_bool(name: string, or?: boolean): boolean | undefined {
    return this.child_by_tag(name)?.as_boolean() ?? this.bool_attr(name) ?? or;
  }
  get_str_arr(name: string, or: string[]): string[];
  get_str_arr(name: string, or?: string[]): string[] | undefined;
  get_str_arr(name: string, or?: string[]): string[] | undefined {
    let ret: string[] | undefined;
    const a = this.children_by_tag(name).map(v => v.as_string())
    const b = this.strs_attr(name)
    for (const i of a) {
      if (i !== void 0) {
        ret ||= [];
        ret.push(i);
      }
    }
    if (b) {
      ret ||= [];
      ret.push(...b);
    }
    return ret
  }

  set_arr_attr_soft(name: string, value: Voidable<Voidable<BaseValue> | Voidable<BaseValue>[]>, sep?: string): void {
    if (value === void 0 || value === null)
      return this.del_attr(name);
    if (!Array.isArray(value))
      return this.set_attr(name, value, sep)
    const arr = [...value];
    while (arr.length) {
      const t = arr[arr.length - 1];
      if (t !== void 0 && t !== null) break;
      arr.pop();
    }
    if (!arr.length) return this.del_attr(name);
    this.set_attr(name, arr.map(n => (n === void 0 || n === null) ? '' : String(n)).join(sep));

  }
  get_num_arr(name: string, or: number[]): number[];
  get_num_arr(name: string, or?: number[]): number[] | undefined;
  get_num_arr(name: string, or?: number[]): number[] | undefined {
    let ret: number[] | undefined;
    const a = this.children_by_tag(name).map(v => v.as_number())
    const b = this.nums_attr(name)
    for (const i of a) {
      if (i !== void 0) {
        ret ||= [];
        ret.push(i);
      }
    }
    if (b) {
      ret ||= [];
      ret.push(...b);
    }
    return ret
  }
}
