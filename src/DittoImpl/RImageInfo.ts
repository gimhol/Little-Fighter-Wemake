import { ImageInfo } from "@/LFW/ditto/image/ImageInfo";
import * as T from "./_t";

export class RImageInfo extends ImageInfo<T.Texture> {
  // 注意：不再 clone texture。clip 走 ShaderMaterial uniforms（不修改 texture 属性），
  // 多实体共享同一 texture 对象是安全的；clone 会触发 three Texture.copy() 的
  // needsUpdate=true，反复 bump 共享 source.version，导致所有引用该贴图的实体重新上传 GPU。
  constructor(o: Partial<RImageInfo>) {
    super(o);
  }
  override clone(): RImageInfo {
    return new RImageInfo(this);
  }
}
