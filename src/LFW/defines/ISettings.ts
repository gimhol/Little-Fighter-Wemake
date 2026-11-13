import { fields, int } from "../fields";
import type { SyncRenderEnum } from "./SyncRenderEnum";

/**
 * 客户端本地设置
 *
 * 不属于世界状态，联机时不同步，也不会被房主覆盖。
 */
export interface ISettings {
  /**
   * 渲染帧率
   *
   * @type {SyncRenderEnum}
   */
  sync_render: number | SyncRenderEnum;

  /**
   * 渲染分辨率宽
   *
   * 0 = 跟随画布显示尺寸
   */
  render_w: number;

  /**
   * 渲染分辨率高
   *
   * 0 = 跟随画布显示尺寸
   */
  render_h: number;
}

export const settings_fields = fields<ISettings>({
  sync_render: int("渲染帧率"),
  render_w: int("渲染分辨率宽", "渲染缓冲像素宽；0 = 跟随画布显示尺寸", { min: 0, max: 16384 }),
  render_h: int("渲染分辨率高", "渲染缓冲像素高；0 = 跟随画布显示尺寸", { min: 0, max: 16384 }),
});
