import type { IBgLayerInfo } from "../defines/IBgLayerInfo";
import type { Background } from "./Background";
export class Layer {
  readonly bg: Background;
  readonly info: IBgLayerInfo;
  /** 数据文件中的下标（data.layers 的位置） */
  readonly data_index: number;
  /** loop 派生的第几个副本（>=0 表示是 loop 副本，-1 表示普通单层） */
  readonly loop_index: number;
  is_static(): boolean {
    const { info: { c1, c2, cc, offsetAnimX, offsetAnimY, absolute } } = this;
    return (cc === void 0 || c1 === void 0 || c2 === void 0) &&
      !offsetAnimX &&
      !offsetAnimY &&
      !!absolute
  }
  visible = false;
  constructor(bg: Background, info: IBgLayerInfo, data_index = 0, loop_index = -1) {
    this.bg = bg;
    this.info = info;
    this.data_index = data_index;
    this.loop_index = loop_index;
  }
  update(count: number) {
    const { info: { c1, c2, cc } } = this;
    if (cc !== void 0 && c1 !== void 0 && c2 !== void 0) {
      const now = count % cc;
      this.visible = now >= c1 && now <= c2;
    } else {
      this.visible = true;
    }
  }
}
