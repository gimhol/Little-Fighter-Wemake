import json5 from "json5";
import { Callbacks } from './base/Callbacks';
import { CtrlDevice } from "./defines/CtrlDevice";
import { Defines } from "./defines/defines";
import { type GameKey } from './defines/GameKey';
import type { IPurePlayerInfo } from "./defines/IPurePlayerInfo";
import type { ICacheData } from "./ditto/cache/ICacheData";
import { Ditto } from './ditto/Instance';
import type { Entity } from './entity/Entity';
import type { IPlayerInfoCallback } from "./IPlayerInfoCallback";
import { is_str } from './utils/type_check/is_str';
import type { Unsafe } from "./utils/type_check/Unsafe";
import { decodeUTF8, encodeUTF8 } from "./utils/utf8";

export class PlayerInfo {
  static readonly TAG = "PlayerInfo";
  static readonly DATA_TYPE: string = 'PlayerInfo';
  static readonly DATA_VERSION: number = 1;
  readonly callbacks = new Callbacks<IPlayerInfoCallback>();
  readonly local: boolean = true;
  readonly mine: boolean = true;
  protected _info: IPurePlayerInfo;
  protected _is_com: boolean = false;
  private _fighter: Unsafe<Entity>;
  get id(): string { return this._info.id; }
  get storage_key() { return "player_info_" + this.id; }
  get name(): string { return this._info.name; }
  set name(v: string) { this._info.name = v; }
  get keys() { return this._info.keys; }
  get is_com(): boolean { return this._is_com; }
  set is_com(v: boolean) { this._is_com = v; }
  get ctrl(): CtrlDevice { return this._info.ctrl; }
  set ctrl(v: CtrlDevice) { this._info.ctrl = v; }
  get fighter(): Unsafe<Entity> { return this._fighter; }
  set fighter(v: Unsafe<Entity>) { this._fighter = v; }

  constructor(id: string, name: string = id, local: boolean = true, mine: boolean = true) {
    this.local = local;
    this.mine = mine;
    this._info = { id, name, keys: Defines.get_default_keys(id), version: 0, ctrl: CtrlDevice.Keyboard };
    this.load();
  }
  async save(): Promise<void> {
    try {
      if (!this.local) return;
      await Ditto.Cache.del(this.storage_key)
      Ditto.Cache.put({
        name: this.storage_key,
        type: PlayerInfo.DATA_TYPE,
        version: PlayerInfo.DATA_VERSION,
        data: encodeUTF8(JSON.stringify(this._info)),
      })
    } catch (e) {
      Ditto.warn("[PlayerInfo::load]", "load failed, ", e);
    }
  }
  async load(): Promise<boolean> {
    if (!this.local) return false;
    let cache: ICacheData | undefined;
    try {
      cache = await Ditto.Cache.get(this.storage_key)
      if (!cache) return false;
    } catch (e) {
      Ditto.warn("[PlayerInfo::load] failed to load, reason", e);
      return false
    }
    let { data } = cache;

    if (!data) {
      const { blob } = cache;
      if (!blob) {
        Ditto.warn("[PlayerInfo::load] no data");
        return false;
      }
      try {
        const buf = await blob.arrayBuffer()
        data = new Uint8Array(buf)
      } catch (e) {
        Ditto.warn("[PlayerInfo::load] read blob failed, reason: ", e);
        return false
      }
    }

    try {
      const raw_text = decodeUTF8(data);
      const raw_info = json5.parse<Partial<IPurePlayerInfo>>(raw_text);
      const { name, keys, ctrl = this.ctrl, version } = raw_info;
      if (version !== this._info.version) {
        Ditto.warn("[PlayerInfo::load] version changed");
        return false;
      }
      if (is_str(name)) this.set_name(name, true)
      if (keys) for (const k in keys) this.set_key(k, keys[k as keyof typeof keys], true)
      if (ctrl !== this.ctrl) this.set_ctrl(ctrl, true)
      return true;
    } catch (e) {
      Ditto.warn("[PlayerInfo::load] load failed, reason", e);
      return false;
    }
  }

  set_ctrl(ctrl: CtrlDevice, emit: boolean): this {
    const prev = this._info.ctrl;
    if (prev === ctrl) return this;
    this.ctrl = ctrl;
    if (emit) this.callbacks.call("on_ctrl_changed", ctrl, prev, this);
    return this;
  }
  set_name(name: string, emit: boolean): this {
    const prev = this._info.name;
    if (prev === name) return this;
    this.name = name;
    if (emit) this.callbacks.call("on_name_changed", name, prev);
    return this;
  }
  set_is_com(is_com: boolean, emit: boolean): this {
    if (this._is_com === is_com) return this;
    this.is_com = is_com;
    if (emit) this.callbacks.call("on_is_com_changed", is_com);
    return this;
  }
  set_key(name: string, key: string, emit: boolean): this;
  set_key(name: GameKey, key: string, emit: boolean): this;
  set_key(name: GameKey, key: string, emit: boolean): this {
    if (this._info.keys[name] === key) return this;
    const prev = this._info.keys[name];
    this._info.keys[name] = key.toLowerCase();
    if (emit) this.callbacks.call("on_key_changed", name, key.toLowerCase(), prev);
    return this;
  }

  get_key(name: string): string | undefined;
  get_key(name: GameKey): string;
  get_key(name: GameKey): string {
    return this._info.keys[name];
  }
}