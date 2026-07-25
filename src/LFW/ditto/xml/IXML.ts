import type { IXMLElement } from './IXMLElement';

export interface IXML {
  parse(text: string): IXMLElement;
  create(tag: string, text?: string): IXMLElement;
  from_object(obj: any, tag?: string): IXMLElement;
  from_array(arr: any[], tag?: string): IXMLElement;
  from_number(num: number, tag?: string): IXMLElement;
  from_boolean(bool: boolean, tag?: string): IXMLElement;
  from_string(str: string, tag?: string): IXMLElement;
}
