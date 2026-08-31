import { bg_info_fields, bg_info_new, Defines, delete_undefined, reorder_fields } from "../..";
import type { IBgInfo } from "../../defines";
import type { IXML, IXMLElement } from "../../ditto";


export function xml_2_bg_info(el: IXMLElement): IBgInfo {
  const ret: IBgInfo = bg_info_new();
  const bound = el.get_num_arr("bound");
  const zoom = el.get_num_arr("zoom");
  const shadowsize = el.get_num_arr("shadowsize");
  ret.name     /**/ = el.get_str("name")
  ret.shadow   /**/ = el.get_str("shadow") ?? ret.shadow
  ret.group    /**/ = el.get_str_arr("group") ?? ["regular"]
  ret.left     /**/ = el.get_num("left") ?? bound?.[0] ?? ret.left
  ret.right    /**/ = el.get_num("right") ?? bound?.[1] ?? ret.right
  ret.far      /**/ = el.get_num("far") ?? bound?.[2] ?? ret.far
  ret.near     /**/ = el.get_num("near") ?? bound?.[3] ?? ret.near
  ret.height   /**/ = el.get_num("height") ?? Defines.MODERN_SCREEN_HEIGHT
  ret.shadow_w /**/ = el.get_num('shadow_w') ?? shadowsize?.[0] ?? ret.shadow_w
  ret.shadow_h /**/ = el.get_num('shadow_h') ?? shadowsize?.[1] ?? ret.shadow_h
  ret.zoom_x   /**/ = el.get_num('zoom_x') ?? zoom?.[0] ?? ret.zoom_x
  ret.zoom_y   /**/ = el.get_num('zoom_y') ?? zoom?.[1] ?? ret.zoom_y
  ret.zoom_z   /**/ = el.get_num('zoom_z') ?? zoom?.[2] ?? ret.zoom_z
  delete_undefined(ret);
  reorder_fields(ret, bg_info_fields);
  return ret;
}

export function xml_x_bg_info(xml: IXML, b: IBgInfo, tag: string) {
  const info = xml.create(tag);
  info.set_attr("name", b.name);
  info.set_attr("shadow", b.shadow);
  info.set_attr("group", b.group?.join() || void 0)
  info.set_arr_attr_soft("bound", [b.left, b.right, b.far, b.near]);
  info.set_attr("height", b.height);
  info.set_arr_attr_soft("shadowsize", [b.shadow_w, b.shadow_h]);
  info.set_arr_attr_soft("zoom", [b.zoom_x, b.zoom_y, b.zoom_z]);
  return info;
}