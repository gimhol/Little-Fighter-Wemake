import { ImageInfo } from "./ImageInfo";
import type { ITextInfo } from "./ITextInfo";

/**
 * 文本测量结果。
 *
 * 只描述文本本身及其测量尺寸，不持有样式。
 * 文本样式统一存放在 UINode 的 style 上。
 */
export class TextInfo<T = any> extends ImageInfo<T> implements ITextInfo {
  text: string = '';
  constructor(o?: Partial<TextInfo>) {
    super(o);
    if (o) Object.assign(this, o);
  }
  override merge(o: Partial<TextInfo> = {}): this {
    super.merge(o);
    Object.assign(this, o);
    return this;
  }
}
