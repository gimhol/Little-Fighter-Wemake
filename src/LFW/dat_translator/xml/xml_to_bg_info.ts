import { bg_info_new, Defines } from "../..";
import type { IBgInfo } from "../../defines";
import type { IXMLElement } from "../../ditto";

/**
 * 解析 `<base>` 元素为 IBgInfo
 * @param {IXMLElement} el - base 元素
 * @param {string} fallbackId - 无 name 时的回退 ID
 * @return {IBgData["base"]}
 */

export function xml_to_bg_info(el: IXMLElement, fallbackId: string): IBgInfo {
  const ret: IBgInfo = bg_info_new();
  const bound = el.get_num_arr("bound");
  const zoom = el.get_num_arr("zoom");
  const shadowsize = el.get_num_arr("shadowsize");
  ret.name     /**/ = el.get_str("name") ?? fallbackId
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
  return ret;
}
