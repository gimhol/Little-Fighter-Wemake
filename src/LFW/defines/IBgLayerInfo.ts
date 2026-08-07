import { any, fields, flt, int, str } from "../fields";
import { make_schema } from "../utils/schema";

export interface IBgLayerInfo {
  /** 预留的 */
  id?: string;
  
  /** 预留的 */
  name?: string;

  /**
   * 图层图片资源路径（必填）
   * 
   * Layer image resource path (required).
   * 
   * 支持倍数图：无 ! 时按 @4x.webp → @4x.png → @3x → @2x → 原路径 顺序自动选择可用版本
   * 
   * Scale variants: without '!', tries @4x.webp → @4x.png → @3x → @2x → original path in order
   * 
   * 以 ! 开头 = 精确匹配：只使用该路径本身，不做 @Nx/格式回退查找
   * 
   * '!' prefix = exact match: use this path as-is, skip @Nx/format fallback resolution
   * 
   * 需固定倍数图时：路径直接写 xxx@4x.png 并加 ! 前缀
   * 
   * To pin a scale: write it explicitly (e.g. xxx@4x.png) with a '!' prefix
   */
  file?: string;

  /**
   * 绝对定位开关（非 0 时不随相机移动）
   * 
   * Absolute positioning flag (non-zero = does not follow camera).
   */
  absolute?: number;

  /**
   * Layer的颜色（可选）
   * 当file存在时，此值无效
   */
  color?: number | string;

  width: number;
  height: number;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  /** 
   * x轴循环布置间隔距离
   */
  loop?: number;
  /** 循环周期帧数（总帧数），now = count % cc */
  cc?: number;
  /** 循环内开始显示帧（含），now >= c1 时可见 */
  c1?: number;
  /** 循环内结束显示帧（含），now <= c2 时可见 */
  c2?: number;

  /** UV偏移动画，横轴(像素/秒) */
  offsetAnimX?: number;
  /** UV偏移动画，纵轴(像素/秒) */
  offsetAnimY?: number;
}
export function bg_layer_info_new(): IBgLayerInfo {
  return {
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    z: 0,
    w: 0,
    h: 0
  }
}

export const bg_layer_info_fields = fields<IBgLayerInfo>({
  id: str("预留ID"),
  name: str("预留名称"),
  file: str("文件"),
  absolute: int("绝对"),
  color: any,
  width: int("宽度"),
  height: int("高度"),
  x: int("X"),
  y: int("Y"),
  z: int("Z"),
  w: int("W"),
  h: int("H"),
  loop: int("循环间隔"),
  cc: int("CC"),
  c1: int("C1"),
  c2: int("C2"),
  offsetAnimX: flt("UV动画X"),
  offsetAnimY: flt("UV动画Y"),
})
export const Schema_IBgLayerInfo = make_schema<IBgLayerInfo>({
  key: "IBgLayerInfo",
  type: "object",
  properties: {
    id: { type: 'string', nullable: true },
    name: { type: 'string', nullable: true },
    file: { type: 'string', nullable: true },
    absolute: { type: 'number', nullable: true },
    color: { type: 'string', nullable: true },
    width: { type: 'number' },
    height: { type: 'number' },
    x: { type: 'number' },
    y: { type: 'number' },
    z: { type: 'number' },
    w: { type: 'number' },
    h: { type: 'number' },
    loop: { type: 'number', nullable: true },
    cc: { type: 'number', nullable: true },
    c1: { type: 'number', nullable: true },
    c2: { type: 'number', nullable: true },
    offsetAnimX: { type: 'number', nullable: true },
    offsetAnimY: { type: 'number', nullable: true },
  },
});