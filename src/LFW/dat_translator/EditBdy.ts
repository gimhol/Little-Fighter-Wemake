import { bdy_info_fields, bdy_kind_name } from "../defines";
import { get_hit_flag_name } from "../defines/HitFlag";
import type { IBdyInfo } from "../defines/IBdyInfo";
import { reorder_keys } from "../fields";
const { parse, stringify } = JSON
export class EditBdy<T extends Partial<IBdyInfo>> {
  readonly raw: T;
  static edit<T extends Partial<IBdyInfo>>(bdy: T, fields: Partial<IBdyInfo> = {}): EditBdy<T> {
    return new EditBdy(bdy).edit(fields);
  }
  static clone<T extends Partial<IBdyInfo>>(bdy: T, fields: Partial<IBdyInfo> = {}): EditBdy<T> {
    return new EditBdy(parse(stringify(bdy))).edit(fields);
  }
  constructor(bdy: T) {
    this.raw = bdy;
    this.deco();
  }
  deco(): this {
    if (this.raw.hit_flag !== void 0) {
      this.raw.hit_flag_name = get_hit_flag_name(this.raw.hit_flag)
    } else {
      delete this.raw.hit_flag;
      delete this.raw.hit_flag_name;
    }
    if (this.raw.kind !== void 0) {
      this.raw.kind_name = bdy_kind_name(this.raw.kind)
    } else {
      delete this.raw.kind;
      delete this.raw.kind_name;
    }
    reorder_keys(this.raw, bdy_info_fields);
    return this
  }
  edit(fields: Partial<IBdyInfo>) {
    Object.assign(this.raw, fields)
    return this.deco();
  }
  confirm(): T {
    this.deco()
    return this.raw;
  }
}
