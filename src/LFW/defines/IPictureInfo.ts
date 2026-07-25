
import { any, fields, int, str } from "../fields";

export interface IPictureInfo {
  /**
   * 图片ID 
   */
  id: string;

  /** 
   * 图片路径 
   */
  path: string;

  /** 
   * 变体ID
   * 
   * 指向其他图片ID
   * 
   * 目前用于实现不同队伍不同颜色的角色 
   */
  variants?: string[];

  /** @deprecated LF2中的row，LFW不再使用，但LFW-TOOL转换的数据会保留此值 */
  row?: number;

  /** @deprecated LF2中的col，LFW不再使用，但LFW-TOOL转换的数据会保留此值 */
  col?: number;

  /** @deprecated LF2中的w，LFW不再使用，但LFW-TOOL转换的数据会保留此值 */
  cell_w?: number;

  /** @deprecated LF2中的h，LFW不再使用，但LFW-TOOL转换的数据会保留此值 */
  cell_h?: number;
}
export function picture_info_new() {
  const ret: IPictureInfo = {
    id: "",
    path: ""
  }
  return ret;
}
export const picture_info_fields = fields<Partial<IPictureInfo>>({
  id: str('图片ID'),
  path: str('路径'),
  variants: str('变体', { array: true }),
  row: int('行数(LF2)', '已弃用'),
  col: int('列数(LF2)', '已弃用'),
  cell_w: int('格宽(LF2)', '已弃用'),
  cell_h: int('格高(LF2)', '已弃用'),
});
