import format from 'xml-formatter';
import type { BaseValue, IXMLElement, Voidable } from "../../LFW/ditto/xml/IXMLElement";
export class XMLElement implements IXMLElement {
  readonly inner: Element;
  private _children: XMLElement[] = [];
  private _parent: XMLElement | null = null;

  get type(): string | undefined {
    let type: string | undefined = this.tag.toLowerCase();
    if (type == 'value') type = this.attr('type')?.toLowerCase();
    return type;
  }
  get tag(): string { return this.inner.tagName; }
  get text(): string { return this.inner.textContent ?? ''; }

  get children(): XMLElement[] { return this._children; }

  get attrs(): { name: string; value: string; }[] {
    const ret: { name: string; value: string; }[] = [];
    const map = this.inner.attributes;
    for (let i = 0; i < map.length; i++) {
      const a = map.item(i)!;
      ret.push({ name: a.name, value: a.value });
    }
    return ret;
  }
  constructor(inner: Element) {
    this.inner = inner;
    for (const c of this.inner.children) {
      const child = new XMLElement(c);
      child._parent = this;
      this._children.push(child);
    }
  }

  attr(name: string): string | undefined {
    return this.inner.getAttribute(name) ?? undefined;
  }
  set_attr(name: string, value: Voidable<BaseValue | BaseValue[]>, sep: string = ','): void {
    if (value === void 0 || value === null)
      this.del_attr(name);
    else if (Array.isArray(value))
      this.inner.setAttribute(name, value.join(sep));
    else
      this.inner.setAttribute(name, String(value));
  }
  del_attr(name: string): void {
    this.inner.removeAttribute(name)
  }
  str_attr(name: string): string | undefined {
    return this.attr(name) ?? undefined;
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
  set_arr_attr(name: string, value: Voidable<BaseValue | BaseValue[]>, sep: string = ','): void {
    if (value === void 0 || value === null)
      return this.del_attr(name);
    if (Array.isArray(value))
      this.set_attr(name, value.join(sep))
    else
      this.set_attr(name, value)
  }
  set_arr_attr_soft(name: string, value: Voidable<Voidable<BaseValue> | Voidable<BaseValue>[]>, sep: string = ','): void {
    if (value === void 0 || value === null)
      return this.del_attr(name);
    if (!Array.isArray(value))
      return this.set_arr_attr(name, value, sep)
    const arr = [...value];
    while (arr.length) {
      const t = arr[arr.length - 1];
      if (t !== void 0 && t !== null) break;
      arr.pop();
    }
    if (!arr.length) return this.del_attr(name);
    this.set_attr(name, arr.map(n => (n === void 0 || n === null) ? '' : String(n)).join(sep));
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
    if ('string' != this.type) return or;
    return this.attr('value') ?? this.text;
  }
  as_number(or: number): number;
  as_number(or?: number): number | undefined;
  as_number(or?: number): number | undefined {
    if ('number' != this.type) return or;
    const txt = this.attr('value') ?? this.text;
    const ret = Number(txt);
    if (isNaN(ret)) return or;
    return ret;
  }
  as_boolean(or: boolean): boolean;
  as_boolean(or?: boolean): boolean | undefined;
  as_boolean(or?: boolean): boolean | undefined {
    if ('boolean' != this.type) return or;
    const txt = (this.attr('value') ?? this.text)?.toLowerCase();
    if (txt === '1' || txt === 'true') return true;
    if (txt === '0' || txt === 'false') return false;
    return or;
  }
  as_array(or: any[]): any[];
  as_array(or?: any[]): any[] | undefined;
  as_array(or?: any[]): any[] | undefined {
    if ('array' != this.type) return or;
    return this._children.map(c => c.as_value());
  }

  as_object(or: object): object;
  as_object(or?: object): object | undefined;
  as_object(or?: object): object | undefined {
    const ret: Record<string, any> = {};
    for (const attr of this.attrs) {
      if (attr.name == 'type') continue; // ...
      ret[attr.name] = attr.value;
    }
    for (const child of this.children) {
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
    return this.text;
  }

  /**
   * 将当前元素及其子元素序列化为 XML 字符串
   * @return {string}
   * @memberof XMLElement
   */
  stringify(): string {
    const ser = new XMLSerializer();
    const str = ser.serializeToString(this.inner).replace(/<(\w+)([^>]*)><\/\1>/g, '<$1$2/>');
    return format(str, { indentation: '  ' });
  }

  insert(child?: XMLElement, index?: number): void {
    if (!child) return;
    child._parent?.remove(child);
    child._parent = this;

    if (index === void 0 || index >= this.inner.children.length) {
      this.inner.appendChild(child.inner);
      this.children.push(child);
    } else {
      const ref = this.inner.children[index];
      this.inner.insertBefore(child.inner, ref);
      this.children.splice(index, 0, child);
    }
  }

  remove(child: XMLElement): boolean {
    if (!this.inner.contains(child.inner)) return false;
    this.inner.removeChild(child.inner);
    child._parent = null;
    const i = this._children.indexOf(child);
    if (i >= 0) this._children.splice(i, 1);
    return true;
  }

  remove_self(): boolean {
    const { parentNode } = this.inner;
    if (!parentNode) return false;
    parentNode.removeChild(this.inner);
    this._parent = null;
    return true;
  }

  remove_all(): void {
    for (const c of this._children) c._parent = null;
    this._children.length = 0;
    while (this.inner.firstChild) {
      this.inner.removeChild(this.inner.firstChild);
    }
  }

  get parent(): XMLElement | undefined {
    return this._parent ?? undefined;
  }

  has_attr(name: string): boolean {
    return this.inner.hasAttribute(name);
  }

  set_text(text: string): void {
    this.inner.textContent = text;
  }

  children_by_tag(tag: string): XMLElement[] {
    return this.children.filter(c => c.tag === tag);
  }

  child_by_tag(tag: string): XMLElement | undefined {
    return this._children.find(c => c.tag === tag);
  }

  get_obj(tag: string): object | undefined {
    return this.child_by_tag(tag)?.as_object();
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
    return ret ?? or
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
    return ret ?? or
  }
}
