import { Graves } from "./base/Graves";
import type { Buff } from "./buff/Buff";
import type { BaseController } from "./controller/BaseController";
import { LocalController } from "./controller/LocalController";
import type { IEntityData } from "./defines/IEntityData";
import { Ditto } from "./ditto/Instance";
import type { Entity } from "./entity/Entity";
import type { LFW } from "./LFW";
import type { States } from "./state/States";
import type { UIComponent } from "./ui/component/UIComponent";
import type { IComponentInfo } from "./ui/IComponentInfo";
import type { UINode } from "./ui/UINode";
import type { World } from "./World";

export interface IEntityCreators {
  (world: World, data: IEntityData, states?: States): Entity | undefined
}
export interface ICtrlCreator {
  new(player_id: string, entity: Entity): BaseController;
}
export interface IBuffCreator {
  readonly KIND: string | number;
  readonly GROUPS: string[];
  new(...args: ConstructorParameters<typeof Buff>): Buff;
}
export type Key = string | number | symbol

export class Factory {
  static readonly TAG = `Factory`;
  readonly graves_maps = new Map<Key, Graves<Entity>>();
  readonly buff_graves_maps = new Map<Key, Graves<Buff>>();
  readonly ctrl_graves_maps = new Map<object, Graves<BaseController>>();
  static readonly entity_creators = new Map<Key, IEntityCreators>();
  static readonly ctrl_creators = new Map<Key, ICtrlCreator>();
  static readonly buff_creators = new Map<Key, IBuffCreator>();
  static readonly components = new Map<string, typeof UIComponent<unknown>>();
  protected static readonly _usedALIAS = new Set<string[]>()
  static readonly buff_groups = new Map<string, Set<string | number>>()
  static register_component(Cls: typeof UIComponent<unknown>): void {
    const names = Cls.TAGS
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      if (this.components.has(name)) {
        Ditto.warn(`[${Factory.TAG}::register_component] name already exists, ${name}`)
        debugger;
      }
      this.components.set(name, Cls);
    }
  }
  static register_entity(type: Key, creator: IEntityCreators): void {
    if (Factory.entity_creators.has(type))
      Ditto.warn(`[${Factory.TAG}::register_entity] type already exists, ${type.toString()}`)
    Factory.entity_creators.set(type, creator);
  }
  static register_ctrl(oid: Key, creator: ICtrlCreator): void {
    if (Factory.ctrl_creators.has(oid))
      Ditto.warn(`[${Factory.TAG}::register_ctrl] oid already exists, ${oid.toString()}`)
    Factory.ctrl_creators.set(oid, creator);
  }
  static register_buff(creator: IBuffCreator): void {
    const { KIND, GROUPS } = creator;
    if (Factory.buff_creators.has(KIND))
      Ditto.warn(`[${Factory.TAG}::register_buff] kind already exists, ${KIND.toString()}`)
    for (const g of GROUPS) {
      let s = this.buff_groups.get(g);
      if (!s) this.buff_groups.set(g, s = new Set())
      s.add(KIND)
    }
    Factory.buff_creators.set(KIND, creator);
  }
  create_buff(kind: Key, lfw: LFW, id: string): Buff | undefined {
    const B = Factory.buff_creators.get(kind);
    if (!B) return void 0;
    const ret = this.buff_graves_maps.get(kind)?.take() ?? new B(lfw, id, B.KIND);
    ret.reset(id);
    ret.init();
    return ret;
  }
  recycle_buff(buff: Buff): this {
    let graves = this.buff_graves_maps.get(buff.kind);
    if (!graves) this.buff_graves_maps.set(buff.kind, graves = new Graves());
    graves.add(buff);
    return this;
  }
  recycle_entity(e: Entity): this {
    let graves = this.graves_maps.get(e.data.type);
    if (!graves) this.graves_maps.set(e.data.type, graves = new Graves());
    graves.add(e);
    return this;
  }
  acquire_entity(type: Key): Entity | undefined {
    return this.graves_maps.get(type)?.take()
  }
  create_entity(...args: Parameters<IEntityCreators>): Entity | undefined {
    return Factory.entity_creators.get(args[1].type)?.(...args);
  }
  create_ctrl(oid: Key, player_id: string, entity: Entity): BaseController | undefined {
    const Cls = Factory.ctrl_creators.get(oid);
    if (!Cls) return void 0;
    return this.acquire_ctrl(Cls, player_id, entity);
  }
  acquire_ctrl<T extends BaseController>(Cls: new (player_id: string, entity: Entity) => T, player_id: string, entity: Entity): T {
    const ret = this.ctrl_graves_maps.get(Cls)?.take() as T | undefined;
    if (!ret) return new Cls(player_id, entity);
    ret.reset(player_id, entity);
    return ret;
  }
  release_ctrl(ctrl: BaseController | undefined): this {
    if (!ctrl) return this;
    let graves = this.ctrl_graves_maps.get(ctrl.constructor);
    if (!graves) this.ctrl_graves_maps.set(ctrl.constructor, graves = new Graves());
    graves.add(ctrl);
    return this;
  }
  create_entity_with_bot(player_id: string, ...args: Parameters<IEntityCreators>): Entity | undefined {
    const ret = Factory.entity_creators.get(args[1].type)?.(...args);
    if (!ret) return ret;
    ret.ctrl = this.create_ctrl(args[1].id, player_id, ret);
    return ret;
  }
  create_entity_with_player(player_id: string, ...args: Parameters<IEntityCreators>): Entity | undefined {
    const ret = Factory.entity_creators.get(args[1].type)?.(...args);
    if (!ret) return ret;
    ret.ctrl = this.acquire_ctrl(LocalController, player_id, ret)
    return ret;
  }
  create_components(layout: UINode, components: IComponentInfo[]): UIComponent[] {
    if (!components.length) return [];

    const ret: UIComponent[] = [];
    for (let idx = 0; idx < components.length; idx++) {
      const info = components[idx];

      const clz = Factory.components.get(info.cls);
      if (!clz) {
        Ditto.warn(`[${Factory.TAG}::create_components] Component not found! cls: ${info.cls}`, info);
        continue;
      }
      const id = info.id ?? `${info.cls}_${idx}`
      const name = info.name ?? id
      const rinfo: Required<IComponentInfo> = {
        id: id,
        name: name,
        cls: info.cls,
        args: info.args || [],
        enabled: info.enabled ?? true,
        properties: info.properties || {},
        props: info.props || {},
        weight: info.weight ?? 0
      }
      if (clz.SINGLETON) {
        const lfw = layout.lfw;
        let singleton = lfw.get_singleton(clz);
        if (!singleton) {
          singleton = new clz(lfw.host_node, rinfo.name, rinfo);
          singleton.init?.();
          lfw.adopt_singleton(clz, singleton);
          lfw.host_node.add_components(singleton);
          singleton.on_start?.();
        }
        layout.link_singleton(singleton);
        continue;
      }
      const component = new clz(layout, rinfo.name, rinfo)
      component.init?.()
      ret.push(component);
    }
    return ret;
  }
}
