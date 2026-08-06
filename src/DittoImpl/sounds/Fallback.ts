import { Ditto } from "@/LFW/ditto";
import { BaseSounds } from "@/LFW/ditto/sounds/BaseSounds";
import { clamp } from "@/LFW/utils/math/clamp";
import { float_equal } from "@/LFW/utils/math/float_equal";

export class __Fallback extends BaseSounds {
  static readonly TAG = "__Fallback";
  protected _r = new Map<string, string>();
  protected _prev_bgm_url: string | null = null;
  protected _bgm_ele?: HTMLAudioElement;
  protected _req_id: number = 0;
  protected _sound_id = 0;
  protected _playings = new Map<string, HTMLAudioElement>();
  protected _muted: boolean = true;
  protected _volume: number = 0.3;
  protected _bgm_volume: number = 0.5;
  protected _sound_volume: number = 1;
  protected _bgm_muted: boolean = false;
  protected _sound_muted: boolean = false;
  protected _is_random: boolean = false;
  override get is_random() { return this._is_random; }
  override set is_random(v: boolean) {
    if (v === this._is_random) return;
    this._is_random = v;
    // TODO: support random.
  }

  override bgm_volume(): number {
    return this._bgm_volume;
  }
  override set_bgm_volume(v: number): void {
    v = clamp(v, 0, 1);
    const prev = this.bgm_volume();
    if (float_equal(v, prev)) return;
    this._bgm_volume = v;
    this.apply_bgm_volume();
    this._callbacks.call("on_bgm_volume_changed", v, prev, this);
  }
  override sound_volume(): number {
    return this._sound_volume;
  }
  override set_sound_volume(v: number): void {
    v = clamp(v, 0, 1);
    const prev = this.sound_volume();
    if (float_equal(v, prev)) return;
    this._sound_volume = v;
    this.apply_sound_volume();
    this._callbacks.call("on_sound_volume_changed", v, prev, this);
  }
  override muted(): boolean {
    return this._muted;
  }
  override set_muted(v: boolean): void {
    this._muted = v;
    this.apply_sound_volume();
    this.apply_bgm_volume();
  }

  override bgm_muted(): boolean {
    return this._bgm_muted;
  }
  override set_bgm_muted(v: boolean): void {
    if (v === this.bgm_muted()) return;
    this._bgm_muted = v;
    this.apply_bgm_volume();
    this._callbacks.call("on_bgm_muted_changed", v, this);
  }
  override sound_muted(): boolean {
    return this._sound_muted;
  }
  override set_sound_muted(v: boolean): void {
    if (v === this.sound_muted()) return;
    this._sound_muted = v;
    this.apply_sound_volume();
    this._callbacks.call("on_sound_muted_changed", v, this);
  }

  private apply_bgm_volume(): void {
    if (this._bgm_ele) {
      this._bgm_ele.muted = this._bgm_muted || this._muted;
      this._bgm_ele.volume = this._volume * this._bgm_volume;
    }
  }

  private apply_sound_volume(): void {
    for (const [, a] of this._playings) {
      a.muted = this._sound_muted || this._muted;
      a.volume = this._volume * this._sound_volume;
    }
  }

  override volume(): number {
    return this._volume;
  }

  override set_volume(v: number): void {
    v = clamp(v, 0, 1);
    const prev = this.volume();
    if (float_equal(v, prev)) return;
    this._volume = v;
    this.apply_bgm_volume();
    this.apply_sound_volume();
    this._callbacks.call("on_volume_changed", v, prev, this);
  }

  override bgm(): string | null {
    return this._bgm_ele?.getAttribute("bgm_name") ?? null;
  }

  override has(name: string): boolean {
    return this._r.has(name);
  }

  override stop_bgm(): void {
    if (!this._bgm_ele) return;
    this._bgm_ele.pause();
    delete this._bgm_ele;
    this._prev_bgm_url = null;
  }
  override play_bgm(name: string, restart?: boolean | undefined): () => void {
    if (!restart && this._prev_bgm_url === name) return () => { };
    const prev = this.bgm();
    if (this._bgm_ele) this.stop_bgm();
    this._bgm_ele = document.createElement("audio");
    this._bgm_ele?.setAttribute("bgm_name", name);
    this._bgm_ele.src = "" + this._r.get(name);
    this._bgm_ele.controls = false;
    this._bgm_ele.loop = true;
    this._bgm_ele.play();
    this._bgm_ele.volume = this._volume * this._bgm_volume;
    this._bgm_ele.muted = this._muted;
    ++this._req_id;
    const req_id = this._req_id;
    this._prev_bgm_url = name;
    this._callbacks.call("on_bgm_changed", name, prev, this);
    this._is_random = name === '?'
    // TODO: support random.
    return () => {
      if (req_id === this._req_id) this.stop_bgm();
    };
  }

  override async load(name: string, src: string): Promise<void> {
    const [url] = await this.lfw.import_resource(src, false);
    this._r.set(name, url);
  }

  override play(name: string, x?: number, y?: number, z?: number): string {
    const src_audio = this._r.get(name);
    if (!src_audio) return "";
    const audio = document.createElement("audio");
    audio.src = src_audio;
    audio.controls = false;
    audio.volume = this._volume * this._sound_volume;
    audio.muted = this._muted;

    const id = "" + ++this._sound_id;
    this._playings.set(id, audio);

    audio.onerror = (e) => {
      Ditto.warn(
        __Fallback.TAG + "::play -> audio.onerror",
        ", failed:",
        name,
        e,
      );
      this._playings.delete(id);
    };
    audio.onended = () => this._playings.delete(id);
    return id;
  }

  override stop(id: string): void {
    const n = this._playings.get(id);
    if (!n) return;
    n.pause();
    this._playings.delete(id);
  }

  override dispose(): void {
    this._playings.forEach((v) => v.pause());
    this._playings.clear();

    this._bgm_ele?.pause();
    delete this._bgm_ele;

    this._r.clear();
  }
}
