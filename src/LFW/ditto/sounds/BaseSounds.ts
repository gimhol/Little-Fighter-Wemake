import { Callbacks } from "../../base/Callbacks";
import type { NoEmitCallbacks } from "../../base/NoEmitCallbacks";
import type { LFW } from "../../LFW";
import type { ISounds } from "./ISounds";
import type { ISoundsCallback } from "./ISoundsCallback";

export class BaseSounds implements ISounds {
  readonly lfw: LFW;
  private _origins: { [x in string]?: string } = {};
  get is_random(): boolean { return false };
  set is_random(v: boolean) { };
  constructor(lfw: LFW) {
    this.lfw = lfw;
  }
  protected _callbacks = new Callbacks<ISoundsCallback>();
  get callbacks(): NoEmitCallbacks<ISoundsCallback> {
    return this._callbacks;
  }
  bgm_volume(): number {
    return 0;
  }
  set_bgm_volume(v: number): void { }
  sound_volume(): number {
    return 0;
  }
  set_sound_volume(v: number): void { }
  bgm_muted(): boolean {
    return true;
  }
  set_bgm_muted(v: boolean): void { }
  sound_muted(): boolean {
    return true;
  }
  set_sound_muted(v: boolean): void { }
  muted(): boolean {
    return true;
  }
  set_muted(v: boolean): void { }
  volume(): number {
    return 0;
  }
  set_volume(v: number): void { }

  has(name: string): boolean {
    return false;
  }
  stop_bgm(): void { }
  bgm(): string | null {
    return null;
  }
  play_bgm(name: string): () => void {
    return () => void 0;
  }
  load(name: string, src: string): Promise<any> {
    return Promise.reject(new Error(BaseSounds.name));
  }
  play(name: string, x?: number, y?: number, z?: number): string {
    return "";
  }
  stop(id: string): void { }
  dispose(): void {
    this._callbacks.clear()
  }
  async play_with_load(
    src: string,
    x?: number,
    y?: number,
    z?: number,
  ): Promise<string> {
    do {
      if (!this.has(src)) {
        // 不存在，加载便是
        await this.load(src, src);
        break;
      }
      const { file, origin } = this.lfw.zips.find([src], false).at(0) || {}
      // 非本地存在资源，说明来自网络，不必重载
      if (!file || !origin) break;

      // 判断是否来源是否产生了变化
      if (this.get_origin(src) === origin) break;

      // 可能后面又有新数据包加载覆盖了，重新加载之
      this.unload(src)

      await this.load(src, src);
    } while (0)

    return this.play(src, x, y, z);
  }
  play_preset(t: string, x?: number, y?: number, z?: number): void {
    switch (t) {
      case "cancel":
      case "end":
      case "join":
      case "ok":
      case "pass":
        this.play_with_load(`data/m_${t}.wav.mp3`, x, y, z);
        break;
      default:
        this.play_with_load(t, x, y, z);
        break;
    }
  }
  set_origin(name: string, origin: string): void {
    this._origins[name] = origin;
  }
  get_origin(name: string): string | undefined {
    return this._origins[name];
  }
  unload(name: string): void {

  }
}
