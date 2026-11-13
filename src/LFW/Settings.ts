import { SyncRenderEnum } from './defines/SyncRenderEnum';
import { Defines } from './defines/defines';
import { type ISettings, settings_fields } from "./defines/ISettings";
import { make_private_properties } from "./utils/make_private_properties";

let _DEFAULT: Settings | null = null;
/**
 * 客户端本地设置
 *
 * 不属于世界状态，联机时不同步。
 */
export class Settings implements ISettings {
  static readonly TAG: string = 'Settings';
  static get DEFAULT(): Settings {
    return _DEFAULT ??= new Settings();
  }

  sync_render: number | SyncRenderEnum = SyncRenderEnum.FPS_60;
  render_w: number = Defines.DEFAULT_RENDER_RESOLUTION.w;
  render_h: number = Defines.DEFAULT_RENDER_RESOLUTION.h;

  constructor(pure: boolean = false) {
    if (!pure) {
      make_private_properties(
        `${Settings.TAG}::constructor`, this,
        (key) => settings_fields.has(key as keyof ISettings),
        (...args) => this.on_settings_change?.(...args)
      )
    }
  }
  on_settings_change?: (k: string, curr: any, prev: any) => void;
  dump_settings() {
    const ret: any = {}
    const keys = Array.from(settings_fields.keys()).sort()
    for (const k of keys) ret[k] = this[k];
    return ret as ISettings;
  }
}
