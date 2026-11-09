import type { IImageInfo } from "./IImageInfo";

/**
 * 文本测量结果。
 *
 * 只描述文本本身及其测量尺寸，不持有样式。
 * 文本样式统一存放在 UINode 的 style 上。
 */
export interface ITextInfo extends IImageInfo {
  text: string;
}
