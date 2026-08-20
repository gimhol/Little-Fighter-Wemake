import { Ditto } from "../ditto/Instance";
import { Graves } from "./Graves";

export type Kind = string | number | symbol;
export interface IInstCreator<C> {
  kind: Kind,
  cls: new (...args: any) => C,
  create(): C;
  reset(c: C): unknown;
  init?(c: C): unknown;
}
export interface IInstCls<C> {
  new(...args: any): C;
  readonly KIND: Kind;
  create(): C;
  reset(c: C): unknown;
  init?(c: C): unknown;
}
export abstract class InstFactory<T> {
  readonly abstract TAG: string;
  readonly graves_maps = new Map<Kind, Graves<T>>();
  abstract get_kind(inst: T): Kind;
  abstract set_kind(inst: T, kind: Kind): void;
  readonly creators = new Map<Kind, IInstCreator<T>>();
  readonly instances = new Map<Kind, T>();

  exists<C extends T = T>(kind: Kind, key: string): C | undefined {
    const kkey = `${kind.toString()}##${key}`
    return this.instances.get(kkey) as C // unsafe cast
  }
  register<B extends T = T>(creator: IInstCreator<B> | IInstCls<B>): void {
    const { TAG } = this;
    if (!creator)
      throw new Error(`[${TAG}::register] failed! creator is null or undefined`);
    let kind: Kind | undefined;
    let cls: new (...args: any) => T;
    let create: () => T;
    let reset: (c: B) => void;
    let init: ((c: B) => unknown) | undefined;
    if (typeof creator === 'function') {
      cls = creator;
      kind = creator.KIND;
      create = creator.create;
      reset = creator.reset;
      init = creator.init;
    } else {
      cls = creator.cls;
      kind = creator.kind;
      create = creator.create;
      reset = creator.reset;
      init = creator.init;

    }
    if (kind === null || void 0 === kind)
      throw new Error(`[${TAG}::register] failed! kind is null or undefined`);
    if (typeof kind === 'string' && kind.length === 0)
      throw new Error(`[${TAG}::register] failed! kind is empty string`);
    if (typeof cls !== 'function')
      throw new Error(`[${TAG}::register] failed! cls is not a constructor, kind=${kind.toString()}`);
    if (!(cls.prototype?.constructor))
      throw new Error(`[${TAG}::register] failed! cls has no prototype, kind=${kind.toString()}`);
    if (typeof create !== 'function')
      throw new Error(`[${TAG}::register] failed! create is not a function, kind=${kind.toString()}`);
    if (typeof reset !== 'function')
      throw new Error(`[${TAG}::register] failed! reset is not a function, kind=${kind.toString()}`);
    if (this.creators.has(kind))
      Ditto.warn(`[${TAG}::register] warning! duplicate registration, overriding kind=${kind.toString()}`);
    this.creators.set(kind, { kind, cls, create, reset, init });
  }

  /**
   * Description placeholder
   *
   * @template {T} [C=T] 类
   * @param {Kind} kind 枚举
   * @param {new (...args: any) => C} cls 用于TS类型推导以及类型检查
   * @param key 
   * @returns {C} 
   */
  get<C extends T = T>(kind: Kind, cls: new (...args: any) => C, key?: string, init?: (c: C) => unknown): C {
    const { TAG } = this;
    const creator = this.creators.get(kind);
    if (!creator)
      throw new Error(`[${TAG}::get] failed! invalid kind ${kind.toString()}`);
    if (cls !== creator.cls)
      throw new Error(`[${TAG}::get] failed! cls incorrect ${kind.toString()}`);

    if (typeof key == 'string') {
      const kkey = `${kind.toString()}##${key}`
      const value = this.instances.get(kkey);
      if (value) {
        if (!(value instanceof creator.cls)) {
          throw new Error(`[${TAG}::get] failed! cls incorrect ${kind.toString()}`);
        }
        return value as C;
      }
    }

    const graves = this.graves_maps.get(kind);
    const ret: C = (graves?.take() ?? creator.create()) as C;
    if (!(ret instanceof creator.cls))
      throw new Error(`[${TAG}::get] failed! cls incorrect ${kind.toString()}`);
    creator.reset(ret);
    this.set_kind(ret, kind);
    creator.init?.(ret);
    if (typeof key == 'string') {
      const kkey = `${kind.toString()}##${key}`
      init?.(ret)
      this.instances.set(kkey, ret);
    }
    return ret;
  }

  recycle(inst: T): void {
    const { TAG } = this;
    const kind = this.get_kind(inst);
    if (!kind) throw new Error(`[${TAG}::recycle] failed! invalid kind ${kind.toString()}`);
    let graves = this.graves_maps.get(kind);
    if (!graves) this.graves_maps.set(kind, graves = new Graves());
    graves.add(inst);
  }
}
