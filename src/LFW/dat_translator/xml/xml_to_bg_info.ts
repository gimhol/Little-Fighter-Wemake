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
  const base: IBgInfo = bg_info_new();
  const bound = el.get_num_arr("bound");
  const zoom = el.get_num_arr("zoom");
  const shadowsize = el.get_num_arr("shadowsize");
  base.name   /**/ = el.get_str("name") ?? fallbackId
  base.shadow /**/ = el.get_str("shadow") ?? base.shadow
  base.group  /**/ = el.get_str_arr("group") ?? ["regular"]
  base.left   /**/ = bound?.[0] ?? el.get_num("left") ?? base.left
  base.right  /**/ = bound?.[1] ?? el.get_num("right") ?? base.right
  base.far    /**/ = bound?.[2] ?? el.get_num("far") ?? base.far
  base.near   /**/ = bound?.[3] ?? el.get_num("near") ?? base.near
  base.height   /**/ = el.get_num("height") ?? Defines.MODERN_SCREEN_HEIGHT
  base.shadow_w /**/ = shadowsize?.[0] ?? el.get_num('shadow_w') ?? base.shadow_w
  base.shadow_h /**/ = shadowsize?.[1] ?? el.get_num('shadow_h') ?? base.shadow_h
  base.zoom_x   /**/ = zoom?.[0] ?? el.get_num('zoom_x') ?? base.zoom_x
  base.zoom_y   /**/ = zoom?.[1] ?? el.get_num('zoom_y') ?? base.zoom_y
  base.zoom_z   /**/ = zoom?.[2] ?? el.get_num('zoom_z') ?? base.zoom_z
  return base;
}
