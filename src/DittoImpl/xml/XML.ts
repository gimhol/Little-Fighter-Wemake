import type { IXML } from "@/LFW"
import { XMLElement } from "./XMLElement"

class _XML implements IXML {
  readonly doc = document.implementation.createDocument(null, null, null);
  parse(text: string): XMLElement {
    const i = new DOMParser().parseFromString(text, 'text/xml').documentElement
    return new XMLElement(i)
  }
  create(tag: string, text?: string): XMLElement {
    const ret = new XMLElement(this.doc.createElement(tag))
    if (text) ret.set_text(text);
    return ret;
  }

  from_string(str: string, tag: string = 'string'): XMLElement {
    const el = new XMLElement(this.doc.createElement(tag));
    el.set_attr('type', 'string');
    if (str.length > 80)
      el.set_text(str);
    else
      el.set_attr('value', str);
    return el;
  }

  from_number(num: number, tag: string = 'number'): XMLElement {
    const el = new XMLElement(this.doc.createElement(tag));
    el.set_attr('type', 'number');
    el.set_attr("value", num);
    return el;
  }

  from_boolean(bool: boolean, tag: string = 'boolean'): XMLElement {
    const el = new XMLElement(this.doc.createElement(tag));
    el.set_attr('type', 'boolean');
    el.set_attr("value", bool ? 'true' : 'false');
    return el;
  }

  from_array(arr: any[], tag: string = 'array'): XMLElement {
    const el = new XMLElement(this.doc.createElement(tag));
    el.set_attr('type', 'array');
    for (const item of arr) {
      el.insert(this._from_value(item, "item"));
    }
    return el;
  }

  from_object(obj: any, tag: string = 'object'): XMLElement {
    const el = new XMLElement(this.doc.createElement(tag));
    el.set_attr('type', 'object');
    for (const [key, value] of Object.entries(obj)) {
      const child = this._from_value(key, value);
      el.insert(child);
    }
    return el;
  }

  private _from_value(key: string, value: any): XMLElement {
    if (value === null || value === undefined) return new XMLElement(this.doc.createElement(key))
    if (typeof value === 'string') return this.from_string(value, key);
    if (typeof value === 'number') return this.from_number(value, key);
    if (typeof value === 'boolean') return this.from_boolean(value, key);
    if (Array.isArray(value)) return this.from_array(value, key);
    return this.from_object(value, key);
  }
}
export const XML = new _XML() 