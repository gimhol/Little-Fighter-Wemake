import { SyncRenderEnum } from "../../defines/SyncRenderEnum";
import type { ISoundsCallback } from "../../ditto/sounds/ISoundsCallback";
import type { IWorldCallbacks } from "../../IWorldCallbacks";
import { round_float } from "../../utils/math/round_float";
import { ArrowSwitcher } from "./Slider/ArrowSwitcher";
import { SliderHandle } from "./Slider/SliderHandle";
import { UIComponent } from "./UIComponent";
const render_rate_options = [
  SyncRenderEnum.Half,
  SyncRenderEnum.Sync,
  SyncRenderEnum.FPS_60,
  SyncRenderEnum.FPS_120,
  SyncRenderEnum.Unlimited
]
/** 语言行选项顺序，须与 language_row 的 items 一致（'' 表示英文 base） */
const lang_codes = ["", "zh-hans", "zh-hant", "de", "es", "fr", "it", "ja", "ko", "nl", "pl", "pt", "ru"]
export class MiscSettingsLogic extends UIComponent {
  static override readonly TAGS: string[] = ["MiscSettingsLogic"];
  protected _anys: { [x in string]?: any } = {}
  get bgm_toggle(): SliderHandle | undefined    /**/ { return this._anys.a ||= this.node.search_node("bgm_toggle_row")?.search_component(SliderHandle) }
  get bgm_volume(): SliderHandle | undefined    /**/ { return this._anys.b ||= this.node.search_node("bgm_volume_row")?.search_component(SliderHandle) }
  get sfx_toggle(): SliderHandle | undefined    /**/ { return this._anys.c ||= this.node.search_node("sfx_toggle_row")?.search_component(SliderHandle) }
  get sfx_volume(): SliderHandle | undefined    /**/ { return this._anys.d ||= this.node.search_node("sfx_volume_row")?.search_component(SliderHandle) }
  get team_outline(): SliderHandle | undefined  /**/ { return this._anys.e ||= this.node.search_node("team_outline_row")?.search_component(SliderHandle) }
  get render_rate(): SliderHandle | undefined   /**/ { return this._anys.f ||= this.node.search_node("render_rate_row")?.search_component(SliderHandle) }
  get main_volume(): SliderHandle | undefined   /**/ { return this._anys.g ||= this.node.search_node("main_volume_row")?.search_component(SliderHandle) }
  get ups(): SliderHandle | undefined           /**/ { return this._anys.h ||= this.node.search_node("ups_row")?.search_component(SliderHandle) }
  get lang_row(): ArrowSwitcher | undefined    /**/ { return this._anys.i ||= this.node.search_node("language_row")?.search_component(ArrowSwitcher) }


  cbs: ISoundsCallback = {
    on_volume_changed: (volume) => this.main_volume?.set_factor(volume),
    on_bgm_volume_changed: (volume) => this.bgm_volume?.set_factor(volume),
    on_sound_volume_changed: (volume) => this.sfx_volume?.set_factor(volume),
    on_bgm_muted_changed: (muted) => this.bgm_toggle?.set_value(muted ? 0 : 1),
    on_sound_muted_changed: (muted) => this.sfx_toggle?.set_value(muted ? 0 : 1),
  }
  cbs2: IWorldCallbacks = {
    on_dataset_change: (key, value) => {
      if (key === 'sync_render') this.render_rate?.set_value(render_rate_options.indexOf(value))
    },
  }
  override on_start(): void {
    this.lfw.sounds.callbacks.add(this.cbs)
    this.lfw.world.callbacks.add(this.cbs2)
    this.main_volume?.on_value_changed((_, s) => {
      this.lfw.sounds.set_volume(s.factor)
      this.lfw.sounds.play_preset('cancel')
    })
    this.bgm_toggle?.on_value_changed((v) => {
      this.lfw.sounds.set_bgm_muted(!v)
      this.lfw.sounds.play_preset(!v ? 'cancel' : 'ok')
    })
    this.bgm_volume?.on_value_changed((_, s) => {
      this.lfw.sounds.set_bgm_volume(s.factor)
      this.lfw.sounds.play_preset('cancel')
    })
    this.sfx_toggle?.on_value_changed((v) => {
      this.lfw.sounds.set_sound_muted(!v)
      this.lfw.sounds.play_preset(!v ? 'cancel' : 'ok')
    })
    this.sfx_volume?.on_value_changed((_, s) => {
      this.lfw.sounds.set_sound_volume(s.factor)
      this.lfw.sounds.play_preset('cancel')
    })
    this.team_outline?.on_value_changed((v) => {
      this.world.dataset.outline_enabled = v;
      this.lfw.sounds.play_preset(v ? 'ok' : 'cancel')
    })
    this.render_rate?.on_value_changed((v) => {
      this.world.dataset.sync_render = render_rate_options[v];
      this.lfw.sounds.play_preset('ok')
    })
    const ups_arr = [30, 60, 90, 120]
    const atom_time_arr = ups_arr.map(v => round_float(60 / v))
    const double_click_interval_arr = ups_arr.map(v => 30 * v / 60)
    const key_hit_duration_arr = ups_arr.map(v => 10 * v / 60)
    const fvy_f_arr = [-0.5, -0.5, -0.5324, -0.678];
    const wait_offset_arr = [-1, 0, 0, 0.5]
    this.ups?.on_value_changed((v) => {
      this.world.dataset.UPS = ups_arr[v];
      this.world.dataset.atom_time = atom_time_arr[v];
      this.world.dataset.wait_offset = wait_offset_arr[v];
      this.world.dataset.fvy_f = fvy_f_arr[v];
      this.world.dataset.double_click_interval = double_click_interval_arr[v];
      this.world.dataset.key_hit_duration = key_hit_duration_arr[v];
      this.lfw.sounds.play_preset('ok')
    })
    this.lang_row?.on_value_changed((v) => {
      this.lfw.set_lang(lang_codes[v]);
      this.lfw.sounds.play_preset('ok')
    })
  }

  override on_resume(): void {
    this.main_volume?.set_factor(this.lfw.sounds.volume())
    this.bgm_toggle?.set_value(this.lfw.sounds.bgm_muted() ? 0 : 1)
    this.bgm_volume?.set_factor(this.lfw.sounds.bgm_volume())
    this.sfx_volume?.set_factor(this.lfw.sounds.sound_volume())
    this.sfx_toggle?.set_value(this.lfw.sounds.sound_muted() ? 0 : 1)
    this.team_outline?.set_factor(this.world.dataset.outline_enabled)
    this.render_rate?.set_value(render_rate_options.indexOf(this.world.dataset.sync_render));
    const ups_arr = [30, 60, 90, 120]
    this.ups?.set_value(ups_arr.indexOf(this.world.dataset.UPS));
    const cur_lang = this.lfw.canonical_lang();
    this.lang_row?.set_value(lang_codes.indexOf(cur_lang));
  }
  override on_stop(): void {
    this.lfw.sounds.callbacks.del(this.cbs)
    this.lfw.world.callbacks.del(this.cbs2)
  }
}
