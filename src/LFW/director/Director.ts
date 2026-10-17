import { InvalidController } from "../controller/InvalidController";
import { LocalController } from "../controller/LocalController";
import { AGK, Defines, OID, StateEnum } from "../defines";
import type { IHitKeyMap, IWpointInfo } from "../defines";
import { CMD } from "../defines/CMD";
import type {
  IActorData,
  IAutoWhenData,
  IDirectorData,
  IKeyStepData,
  TActionData,
  TNumberExpr,
  TSelectors,
  TTimelineEntryData,
} from "../defines/IDirectorData";
import type { Entity } from "../entity";
import { eval_number } from "../utils/eval_number";
import { round_float } from "../utils/math/round_float";
import type { World } from "../World";
import { ActionDirector } from "./ActionDirector";

const OID_BY_NAME = new Map<string, string>();
for (const [name, id] of Object.entries(OID)) OID_BY_NAME.set(name.toLowerCase(), id);

const CMD_BY_NAME: Record<string, CMD> = {
  DIST_CAM: CMD.DIST_CAM,
  LOCK_CAM: CMD.LOCK_CAM,
  CHANGE_BG: CMD.CHANGE_BG,
  CHANGE_STAGE: CMD.CHANGE_STAGE,
  PAUSE: CMD.PAUSE,
  BGM: CMD.BGM,
};

export class Director {
  readonly world: World;
  readonly data: IDirectorData;
  readonly action_director = new ActionDirector();

  fighters: Entity[] = [];
  entities: Entity[] = [];
  weapons: Entity[] = [];

  private readonly _actors = new Map<string, Entity[]>();
  private readonly _groups = new Map<string, Entity[]>();
  private readonly _spawned: Entity[] = [];
  private _compiled = false;

  constructor(world: World, data: IDirectorData) {
    this.world = world;
    this.data = data;
  }

  get lfw() { return this.world.lfw; }
  get bg() { return this.world.bg; }
  get left() { return this.world.bg.left; }
  get right() { return this.world.bg.right; }
  get far() { return this.world.bg.far; }
  get near() { return this.world.bg.near; }
  get midX() { return round_float((this.left + this.right) / 2); }
  get midZ() { return round_float((this.near + this.far) / 2); }
  get actors(): ReadonlyMap<string, Entity[]> { return this._actors; }
  get groups(): ReadonlyMap<string, Entity[]> { return this._groups; }
  get spawned(): readonly Entity[] { return this._spawned; }

  start(): void {
    this.action_director.reset();
    this.world.camera.undest();
    this.world.camera.unlock();
    this._compile();
    this._setup_scene();
  }

  restart(): void {
    this._compiled = false;
    this.start();
  }

  stop(): void {
    this.action_director.reset();
    this._actors.clear();
    this._groups.clear();
    this._spawned.length = 0;
  }

  update(dt: number): void {
    if (this.world.paused) return;
    this.action_director.update(dt);
    this._update_auto();
  }

  resolve(selectors: TSelectors): Entity[] {
    const ret: Entity[] = [];
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const selector of list) {
      if (selector === "@all") {
        ret.push(...this._spawned);
        continue;
      }
      if (selector.startsWith("@")) {
        ret.push(...(this._groups.get(selector.slice(1)) ?? []));
        continue;
      }
      const matched = /^(.+?)(?:\[(-?\d+)\])?$/.exec(selector);
      if (!matched) continue;
      const entities = this._actors.get(matched[1]);
      if (!entities) continue;
      if (matched[2] == null) {
        ret.push(...entities);
      } else {
        const index = Number(matched[2]);
        const e = entities[index < 0 ? entities.length + index : index];
        if (e) ret.push(e);
      }
    }
    return ret.filter((e, i) => ret.indexOf(e) === i);
  }

  spawn(oid: string): Entity | null {
    const data = this.lfw.datas.find_object(oid);
    if (!data) return null;
    return this.lfw.factory.create_entity(this.world, data)!;
  }

  private _update_auto(): void {
    const rules = this.data.auto;
    if (!rules?.length) return;

    const handled = new Set<Entity>();
    for (const rule of rules) {
      for (const e of this.resolve(rule.target)) {
        if (handled.has(e) || !this._match_auto(e, rule.when)) continue;
        this._apply_keys(e, rule.actions);
        handled.add(e);
      }
    }
  }

  private _compile(): void {
    if (this._compiled) return;
    this._compiled = true;

    const timeline = this.data.timeline;
    if (!timeline) return;

    let time = 0;
    const schedule = (actions: TActionData[] | undefined) => {
      if (!actions?.length) {
        this.action_director.insert(time, () => { });
        return;
      }
      for (const action of actions) this.action_director.insert(time, () => this._run_action(action));
    };
    const walk = (entries: TTimelineEntryData[], interval: number) => {
      for (const entry of entries) {
        time += interval;
        if ("wait" in entry) {
          time += entry.wait;
          this.action_director.insert(time, () => { });
        } else if ("repeat" in entry) {
          for (let i = 0; i < entry.repeat; i++) walk(entry.entries, entry.interval);
        } else {
          time += entry.after ?? 0;
          schedule(entry.actions);
        }
      }
    };

    walk(timeline.entries, 0);
    if (timeline.times != null) this.action_director.times(timeline.times);
    this.action_director.sort();
  }

  private _setup_scene(): void {
    this._actors.clear();
    this._groups.clear();
    this._spawned.length = 0;
    this.fighters = [];
    this.entities = [];
    this.weapons = [];

    this.world.clear();
    this.lfw.change_bg(this.data.bg ?? 'bg_4');
    if (this.data.stage) Object.assign(this.world.stage, this.data.stage);

    for (const actor of this.data.actors ?? []) this._spawn_actor(actor);
    for (const [name, selectors] of Object.entries(this.data.groups ?? {})) {
      const group = this._groups.get(name) ?? [];
      for (const e of this.resolve(selectors)) {
        if (!group.includes(e)) group.push(e);
      }
      this._groups.set(name, group);
    }

    this.fighters = this._groups.get("fighters") ?? [];
    this.entities = this._groups.get("entities") ?? [];
    this.weapons = this._groups.get("weapons") ?? [];

    for (const action of this.data.setup ?? []) this._run_action(action);
  }

  private _spawn_actor(actor: IActorData): void {
    const oids = this._actor_oids(actor);
    if (!oids.length) return;

    const count = Math.max(0, Math.floor(actor.count ?? oids.length));
    if (!count) return;

    const ctx = this._ctx();
    const spawned: Entity[] = [];
    for (let i = 0; i < count; i++) {
      const oid = oids[i % oids.length];
      const e = this.spawn(oid);
      if (!e) continue;

      const [x, y, z] = this._actor_position(actor, i, count, ctx);
      e.set_position(x, y, z);
      if (actor.values) this._apply_values(e, actor.values, i);
      this._apply_ctrl(e, actor, i, oid);
      if (actor.attach !== false) e.attach();

      spawned.push(e);
      this._spawned.push(e);
      const list = this._actors.get(actor.id) ?? [];
      list.push(e);
      this._actors.set(actor.id, list);
    }

    const groups = typeof actor.group === "string" ? [actor.group] : actor.group ?? [];
    for (const name of groups) {
      const group = this._groups.get(name) ?? [];
      group.push(...spawned);
      this._groups.set(name, group);
    }
  }

  private _actor_oids(actor: IActorData): string[] {
    if (actor.source === "fighters") {
      let ids = this.lfw.datas.fighters.map(v => v.id);
      if (actor.half === "first") ids = ids.slice(0, Math.round(ids.length / 2));
      else if (actor.half === "second") ids = ids.slice(Math.round(ids.length / 2));
      return ids;
    }
    if (actor.oid == null) return [];
    const oids = Array.isArray(actor.oid) ? actor.oid : [actor.oid];
    return oids.map(oid => OID_BY_NAME.get(oid.toLowerCase()) ?? oid);
  }

  private _actor_position(
    actor: IActorData,
    index: number,
    count: number,
    ctx: Record<string, number>,
  ): [number, number, number] {
    const layout = actor.layout;
    let x = eval_number(actor.x ?? layout?.x ?? "midX", ctx);
    let y = eval_number(actor.y ?? layout?.y ?? 0, ctx);
    let z = eval_number(actor.z ?? layout?.z ?? "midZ", ctx);

    if (actor.at) {
      const ref = this.resolve(actor.at)[0];
      if (ref) {
        x = ref.position.x + eval_number(actor.dx ?? 0, ctx);
        y = ref.position.y + eval_number(actor.dy ?? 0, ctx);
        z = ref.position.z + eval_number(actor.dz ?? 0, ctx);
      }
    }

    if (layout?.type === "line") {
      const length = eval_number(layout.length ?? 0, ctx);
      const step = count > 1 ? length / (count - 1) : 0;
      if ((layout.axis ?? "x") === "x") x = x - length / 2 + step * index;
      else z = z - length / 2 + step * index;
    } else if (layout?.type === "circle" && count > 1) {
      const a = Math.PI * 2 / count * index;
      const rx = eval_number(layout.rx ?? layout.radius ?? 0, ctx);
      const rz = eval_number(layout.rz ?? layout.radius ?? rx, ctx);
      x += Math.cos(a) * rx;
      z += Math.sin(a) * rz;
    }

    return [round_float(x), round_float(y), round_float(z)];
  }

  private _apply_values(e: Entity, values: Record<string, unknown>, index: number): void {
    for (const [key, raw] of Object.entries(values)) {
      const value = Array.isArray(raw) ? (raw.length ? raw[index % raw.length] : void 0) : raw;
      if (value === void 0) continue;
      if (key === "as_key_role") {
        e.as_key_role(value);
        continue;
      }
      (e as unknown as Record<string, unknown>)[key] = value;
    }
  }

  private _apply_ctrl(e: Entity, actor: IActorData, index: number, oid: string): void {
    if (!actor.ctrl) return;
    const player_id = this._player_id(actor.player_id ?? "", e, index);
    if (actor.ctrl === "local") {
      e.ctrl = new LocalController(player_id, e);
    } else if (actor.ctrl === "invalid") {
      e.ctrl = new InvalidController(player_id, e);
    } else {
      const ctrl = this.lfw.factory.create_ctrl(oid, player_id, e);
      if (ctrl) e.ctrl = ctrl;
    }
  }

  private _player_id(template: string, e: Entity, index: number): string {
    if (template === "$new_id") return this.lfw.new_id;
    if (template === "$keep") return e.ctrl.player_id;
    return template.replace(/\{i\}/g, String(index));
  }

  private _ctx(): Record<string, number> {
    const { bg } = this;
    return {
      midX: this.midX,
      midZ: this.midZ,
      left: this.left,
      right: this.right,
      near: this.near,
      far: this.far,
      width: bg.width,
      depth: bg.depth,
      modernScreenW: Defines.MODERN_SCREEN_WIDTH,
      PI: Math.PI,
    };
  }

  private _run_action(action: TActionData): void {
    switch (action.op) {
      case "input": {
        for (const e of this.resolve(action.target)) this._apply_keys(e, action.actions);
        break;
      }
      case "set": {
        const list = this.resolve(action.target);
        list.forEach((e, i) => this._apply_values(e, action.values, i));
        break;
      }
      case "camera": {
        if (action.undest) this.world.camera.undest();
        if (action.unlock) this.world.camera.unlock();
        if (action.dest) this.world.camera.dest(this._expr(action.dest[0]), this._expr(action.dest[1]));
        if (action.lock) this.world.camera.lock(this._expr(action.lock[0]), this._expr(action.lock[1]));
        break;
      }
      case "cmd": {
        const cmd = CMD_BY_NAME[action.name];
        if (cmd) this.lfw.push_cmd(cmd, ...(action.args ?? []).map(v => String(this._expr(v))));
        break;
      }
      case "bg": {
        this.lfw.change_bg(action.id);
        break;
      }
      case "stage": {
        Object.assign(this.world.stage, action.values);
        break;
      }
      case "place": {
        const ref = this.resolve(action.at)[0];
        if (!ref) break;
        if (action.requires && !(ref as unknown as Record<string, unknown>)[action.requires]) break;
        const x = ref.position.x + this._expr(action.dx ?? 0);
        const y = action.dy == null ? 0 : this._expr(action.dy);
        const z = ref.position.z + this._expr(action.dz ?? 0);
        for (const e of this.resolve(action.target)) e.set_position(x, y, z);
        break;
      }
      case "move": {
        const dx = this._expr(action.dx ?? 0);
        const dy = this._expr(action.dy ?? 0);
        const dz = this._expr(action.dz ?? 0);
        for (const e of this.resolve(action.target)) {
          e.set_position(e.position.x + dx, e.position.y + dy, e.position.z + dz);
        }
        break;
      }
      case "face": {
        const ref = this.resolve(action.at)[0];
        if (!ref) break;
        for (const e of this.resolve(action.target)) {
          e.facing = ref.position.x < e.position.x ? -1 : 1;
        }
        break;
      }
      case "velocity": {
        const x = action.x == null ? null : this._expr(action.x);
        const y = action.y == null ? null : this._expr(action.y);
        const z = action.z == null ? null : this._expr(action.z);
        for (const e of this.resolve(action.target)) e.set_velocity(x, y, z);
        break;
      }
      case "frame": {
        for (const e of this.resolve(action.target)) this._enter_frame(e, action.id);
        break;
      }
      case "pickup": {
        const weapon = this.resolve(action.weapon)[0];
        if (!weapon) break;
        for (const e of this.resolve(action.target)) {
          if (action.if_empty && e.holding) continue;
          e.pick(weapon);
          e.enter_frame(Defines.NEXT_FRAME_AUTO);
        }
        break;
      }
      case "cycle": {
        this._cycle(action.target, action.property, action.values);
        break;
      }
      case "throw_spot": {
        this._throw_spot(action.target, action.from);
        break;
      }
      case "reset": {
        this._setup_scene();
        break;
      }
    }
  }

  private _apply_keys(e: Entity, steps: IKeyStepData[]): void {
    const { ctrl } = e;
    for (const step of steps) {
      if (step.click) ctrl.click(...step.click);
      if (step.dbl_click) ctrl.dbl_click(...step.dbl_click);
      if (step.db_hit) ctrl.db_hit(...step.db_hit);
      if (step.key_down) ctrl.key_down(...step.key_down);
      if (step.key_up) ctrl.key_up(...(step.key_up === "all" ? AGK : step.key_up));
    }
  }

  private _enter_frame(e: Entity, id: string): void {
    if (id === "auto") {
      e.enter_frame(Defines.NEXT_FRAME_AUTO);
    } else if (id === "falling_forward_0") {
      e.enter_frame_by_id(e.data.indexes?.falling?.[1][0]);
    } else if (id === "falling_backward_0") {
      e.enter_frame_by_id(e.data.indexes?.falling?.[-1][0]);
    } else {
      e.enter_frame_by_id(id);
    }
  }

  private _cycle(target: TSelectors, property: string, values: unknown[]): void {
    if (!values.length) return;
    for (const e of this.resolve(target)) {
      const record = e as unknown as Record<string, unknown>;
      const current = record[property];
      const index = values.indexOf(current);
      record[property] = index < 0 ? values[0] : values[(index + 1) % values.length];
    }
  }

  private _throw_spot(target: string, from: string): void {
    const a = this.resolve(target)[0];
    const c = this.resolve(from)[0];
    if (!a || !c) return;

    let dx = 86;
    for (const frame of Object.values(c.data.frames ?? {})) {
      const wpoint = frame.wpoint as IWpointInfo | IWpointInfo[] | undefined;
      if (!wpoint || Array.isArray(wpoint)) continue;
      if (wpoint.dvx === void 0 && wpoint.dvy === void 0 && wpoint.dvz === void 0) continue;
      dx = (wpoint.x ?? 0) - (frame.centerx ?? 0);
      break;
    }
    a.facing = -1;
    a.set_position(c.position.x + dx, 0, a.position.z);
  }

  private _match_auto(e: Entity, when?: IAutoWhenData): boolean {
    if (!when) return true;
    if (when.mp_gt != null && !(e.mp > when.mp_gt)) return false;
    if (when.state != null) {
      const states = Array.isArray(when.state) ? when.state : [when.state];
      if (!states.some(name => e.state === this._state_value(name))) return false;
    }
    if (when.state_not != null) {
      const states = Array.isArray(when.state_not) ? when.state_not : [when.state_not];
      if (states.some(name => e.state === this._state_value(name))) return false;
    }
    if (when.frame_hit != null) {
      const hit = e.frame.hit;
      if (!hit || !hit[when.frame_hit as keyof IHitKeyMap]) return false;
    }
    return true;
  }

  private _state_value(name: string): number {
    return (StateEnum as unknown as Record<string, number>)[name];
  }

  private _expr(value: TNumberExpr): number {
    return eval_number(value, this._ctx());
  }
}
