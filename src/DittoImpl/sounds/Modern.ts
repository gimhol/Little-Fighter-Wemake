import { AsyncValuesKeeper } from "@/DittoImpl/AsyncValuesKeeper";
import { Graves } from "@/LFW/base/Graves";
import { Defines } from "@/LFW/defines/defines";
import { BaseSounds } from "@/LFW/ditto/sounds/BaseSounds";
import { Randoming } from "@/LFW/helper/Randoming";
import { LFW } from "@/LFW/LFW";
import { abs, max } from "@/LFW/utils/math/base";
import { clamp } from "@/LFW/utils/math/clamp";
import { float_equal } from "@/LFW/utils/math/float_equal";
import type { WorldRenderer } from "../renderer/WorldRenderer";

export class __Modern extends BaseSounds {
  readonly ctx = new AudioContext();
  protected _req_id: number = 0;
  protected _prev_bgm_url: string | null = null;
  protected _bgm_node: {
    src_node: AudioBufferSourceNode;
    gain_node: GainNode;
  } | null = null;

  protected _r = new AsyncValuesKeeper<AudioBuffer>();
  protected _bgm_name: string | null = null;
  protected _sound_id = 0;
  protected _playings = new Map<
    string,
    {
      src_node: AudioBufferSourceNode;
      l_gain_node: GainNode;
      r_gain_node: GainNode;
      sound_x: number;
    }
  >();
  protected _splitter_node_graves = new Graves<ChannelSplitterNode>();
  protected _merger_node_graves = new Graves<ChannelMergerNode>();
  protected _l_gain_node_graves = new Graves<GainNode>();
  protected _r_gain_node_graves = new Graves<GainNode>();
  protected _muted: boolean = false;
  protected _volume: number = 0.3;
  protected _bgm_volume: number = 0.5;
  protected _sound_volume: number = 1;
  protected _bgm_muted: boolean = false;
  protected _sound_muted: boolean = false;
  protected _bgms: Randoming<string | undefined>
  protected _is_random: boolean = false;
  override get is_random() { return this._is_random; }
  override set is_random(v: boolean) {
    if (v === this._is_random) return;
    this._is_random = v;
    const src_node = this._bgm_node?.src_node;
    if (!src_node) return;
    if (this._is_random) {
      src_node.addEventListener('ended', this._random_next, { once: true })
    } else {
      src_node.loop = true;
      src_node.removeEventListener('ended', this._random_next)
    }
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
    if (v === this.muted()) return;
    this._muted = v;
    this.apply_volume();
    this._callbacks.call("on_muted_changed", v, this);
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

  override volume(): number {
    return this._volume;
  }
  override set_volume(v: number): void {
    v = clamp(v, 0, 1);
    const prev = this.volume();
    if (float_equal(v, prev)) return;
    this._volume = v;
    this.apply_volume();
    this._callbacks.call("on_volume_changed", v, prev, this);
  }

  protected apply_volume(): void {
    this.apply_bgm_volume();
    this.apply_sound_volume();
  }

  protected apply_sound_volume(): void {
    for (const [, { sound_x, l_gain_node, r_gain_node }] of this._playings) {
      const [, l_vol, r_vol] = this.get_l_r_vol(sound_x);
      l_gain_node.gain.value = l_vol;
      r_gain_node.gain.value = r_vol;
    }
  }

  protected apply_bgm_volume(): void {
    if (!this._bgm_node) return;
    const muted = this._muted || this._bgm_muted;
    this._bgm_node.gain_node.gain.value = muted
      ? 0
      : this._volume * this._bgm_volume;
  }

  override bgm(): string | null {
    return this._bgm_name;
  }

  override has(name: string): boolean {
    return this._r.has(name);
  }

  override load(name: string, src: string): Promise<AudioBuffer> {
    return this._r.fetch(name, async () => {
      this.lfw.emit_progress(`${name}`, 0);
      const [dat, , origin] = await this.lfw.import_array_buffer(src, false);
      const buf = this.ctx.decodeAudioData(dat);
      this.lfw.emit_progress(`${name}`, 100);
      if (origin) this.set_origin(name, origin)
      return buf;
    });
  }
  constructor(lfw: LFW) {
    super(lfw);
    this._bgms = new Randoming('bgm_randoming', this.lfw.bgms, this.lfw.mt)
  }
  private _stop_bgm(): void {
    if (!this._bgm_node) return;
    this._bgm_name = null;
    this._bgm_node.src_node.removeEventListener('ended', this._random_next)
    this._bgm_node.src_node.stop();
    this._prev_bgm_url = null;

  }
  override stop_bgm(): void {
    if (!this._bgm_node) return;
    const prev = this.bgm();
    this._stop_bgm();
    this._callbacks.call("on_bgm_changed", null, prev, this);
  }
  _random_next = () => this.play_bgm('?')
  override play_bgm(name: string, restart?: boolean | undefined): () => void {
    if (!restart && this._prev_bgm_url === name) return () => { };
    const prev = this.bgm();
    const real_name = name === '?' ?
      this._bgms.set_src(this.lfw.bgms).get() :
      name;
    this._stop_bgm();
    if (!real_name) return () => { };
    this._bgm_name = real_name;
    this._prev_bgm_url = real_name;
    this._is_random = name === '?'
    ++this._req_id;

    const req_id = this._req_id;
    const ctx = this.ctx;
    const buf = this._r.get(real_name);
    const start = (buf: AudioBuffer) => {
      if (this._bgm_name !== real_name) return;
      const src_node = ctx.createBufferSource();
      src_node.buffer = buf;
      src_node.start();
      const gain_node = this.ctx.createGain();
      gain_node.connect(ctx.destination);
      src_node.connect(gain_node);
      if (this._is_random) {
        src_node.addEventListener('ended', this._random_next, { once: true })
      } else {
        src_node.loop = true;
        src_node.removeEventListener('ended', this._random_next)
      }
      this._bgm_node = {
        src_node,
        gain_node,
      };
      this.apply_bgm_volume();
    };
    do {
      const { file, origin } = this.lfw.find_from_zips([real_name], false).at(0) || {}
      // 非本地存在资源，说明来自网络，不必重载
      if (!file || !origin) break;

      // 判断是否来源是否产生了变化
      if (this.get_origin(real_name) === origin)
        break;
      this.unload(real_name)
    } while (0)
    if (buf) {
      start(buf);
    } else {
      this.load(real_name, real_name).then(start);
    }

    this._callbacks.call("on_bgm_changed", real_name, prev, this);
    return () => req_id === this._req_id && this.stop_bgm();
  }

  protected get_l_r_vol(x?: number): [number, number, number] {
    const scale = (this.lfw.world.renderer as WorldRenderer).world_node.scale.x
    const full_w = Defines.CLASSIC_SCREEN_WIDTH / scale
    const half_w = full_w / 2;
    const viewer_x = this.lfw.world.camera.position.x + half_w;
    const sound_x = x ?? viewer_x;
    const playings = this._playings.size + 1;
    const attenuation = 1 / Math.sqrt(playings);
    const baseVol = this._volume * this._sound_volume;
    const muted = this._muted || this._sound_muted;

    const finalBaseVol = muted ? 0 : baseVol * attenuation;

    const l_vol = finalBaseVol * max(
      0, 1 - abs((sound_x - viewer_x + half_w) / full_w),
    ) * scale;

    const r_vol = finalBaseVol * max(
      0, 1 - abs((sound_x - viewer_x - half_w) / full_w),
    ) * scale;

    return [sound_x, l_vol, r_vol];
  }
  override play(name: string, x?: number, y?: number, z?: number): string {
    const buf = this._r.get(name);
    if (!buf) {
      this.load(name, name)
        .then(() => this.play(name, x, y, z))
        .catch((e) => {
          debugger;
          console.error(e);
        });
      return "";
    }

    const id = "" + ++this._sound_id;
    const [sound_x, l_vol, r_vol] = this.get_l_r_vol(x);

    const ctx = this.ctx;
    const src_node = ctx.createBufferSource();
    src_node.buffer = buf;

    const splitter_node = this._splitter_node_graves.take() ?? this.ctx.createChannelSplitter(1);
    src_node.connect(splitter_node);

    const merger_node = this._merger_node_graves.take() ?? this.ctx.createChannelMerger(2);

    const l_gain_node = this._l_gain_node_graves.take() ?? this.ctx.createGain();

    if (Number.isFinite(l_vol) && !Number.isNaN(l_vol))
      l_gain_node.gain.value = l_vol;
    else
      l_gain_node.gain.value = 0

    l_gain_node.connect(merger_node, 0, 0);
    splitter_node.connect(l_gain_node, 0);

    const r_gain_node = this._r_gain_node_graves.take() ?? this.ctx.createGain();
    if (Number.isFinite(r_vol) && !Number.isNaN(r_vol))
      r_gain_node.gain.value = r_vol;
    else
      r_gain_node.gain.value = 0


    r_gain_node.connect(merger_node, 0, 1);
    splitter_node.connect(r_gain_node, 0);

    merger_node.connect(this.ctx.destination);
    src_node.start();

    this._playings.set(id, {
      src_node,
      l_gain_node,
      r_gain_node,
      sound_x,
    });
    src_node.onended = () => {
      src_node.disconnect();
      splitter_node.disconnect();
      l_gain_node.disconnect();
      r_gain_node.disconnect();
      merger_node.disconnect();
      this._splitter_node_graves.add(splitter_node);
      this._merger_node_graves.add(merger_node);
      this._l_gain_node_graves.add(l_gain_node);
      this._r_gain_node_graves.add(r_gain_node);
      this._playings.delete(id)
    };
    return id;
  }

  override stop(id: string): void {
    const n = this._playings.get(id);
    if (!n) return;
    n.src_node.stop();
    this._playings.delete(id);
  }

  override dispose(): void {
    this._r.clean();
    this.stop_bgm();
    this._playings.forEach((v) => v.src_node.stop());
    this._playings.clear();
    super.dispose();
  }

  override unload(name: string): void {
    super.unload(name)
    this._r.del(name)
  }
}
