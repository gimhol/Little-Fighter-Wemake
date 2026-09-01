import { Entity } from "../entity";
import type { LFW } from "../LFW";
import { Times } from "../utils/Times";
import { World } from "../World";
import type { IBuffSnapshot } from "./IBuffSnapshot";

export abstract class Buff {
  static readonly KIND: string | number = '';
  readonly lfw: LFW;
  readonly world: World;
  readonly id: string
  readonly kind: string | number;
  protected _attacker: Entity | undefined;
  protected _attacker_id: string = '';
  level: number = 0;
  protected _mounted = false;
  protected readonly _victims: string[] = [];
  protected readonly _ticker = new Times();
  protected readonly _lifetime = new Times(0, 1).set_lifes(1);

  get victims(): ReadonlyArray<string> { return this._victims; }
  get dead() { return this._lifetime.remains == 0 }
  get lifetime() { return this._lifetime.value }
  set lifetime(v) { this._lifetime.value = v }
  get duration() { return this._lifetime.max }
  set duration(v) { this._lifetime.max = v }
  get ticks() { return this._ticker.max }
  set ticks(v) { this._ticker.max = v }
  get attacter(): Entity | undefined {
    if (!this._attacker_id)
      return this._attacker = void 0;
    if (this._attacker?.id == this._attacker_id)
      return this._attacker = this.world.find_entity(this._attacker_id);
    return this._attacker;
  }
  constructor(lfw: LFW, id: string, kind: string | number) {
    this.lfw = lfw;
    this.kind = kind
    this.world = lfw.world;
    this.id = id;
  }
  init(): void { };
  on_tick?(attacker?: Entity, victim?: Entity): 'keep' | 'del';
  on_update?(attacker?: Entity, victim?: Entity): 'keep' | 'del';
  on_end?(attacker?: Entity, victim?: Entity): 'keep' | 'del';
  set_attacker(attacker: string | Entity) {
    if (typeof attacker === 'string') {
      this._attacker = this.world.find_entity(attacker);
      this._attacker_id = attacker;
    } else {
      this._attacker = attacker;
      this._attacker_id = attacker.id;
    }
  }
  set_victims(...victims: (string | Entity)[]): this {
    for (const victim of this._victims)
      this.world.find_entity(victim)?.buffs.set(this.id, this);
    this._victims.length = 0;
    return this.add_victims(...victims);
  }
  add_victims(...victims: (string | Entity)[]): this {
    for (const victim of victims) {
      let entity: Entity | undefined = void 0;
      if (typeof victim == 'string') {
        if (this._victims.includes(victim)) continue;
        this._victims.push(victim);
        entity = this.world.find_entity(victim)
      } else {
        if (this._victims.includes(victim.id)) continue;
        this._victims.push(victim.id);
        entity = victim;
      }
      entity?.buffs.set(this.id, this);
    }
    return this;
  }

  del_victims(...victims: (string | Entity)[]): this {
    for (const victim of victims) {
      let entity: Entity | undefined = void 0;
      if (typeof victim == 'string') {
        if (this._del(victim)) continue;
        entity = this.world.entity_map.get(victim)
      } else {
        if (this._del(victim.id)) continue;
        entity = victim;
      }
      entity?.buffs.delete(this.id);
    }
    return this;
  }
  apply?(): void
  private _del(id: string): boolean {
    let fast = 0, slow = 0
    let len = this._victims.length
    for (; fast < len; ++fast) {
      if (slow < fast) this._victims[slow] = this._victims[fast]
      if (this._victims[fast] === id) continue;
      ++slow;
    }
    this._victims.length = slow;
    return slow !== fast
  }


  update(d: number) {
    const { on_update, on_tick, on_end } = this;
    let attacker: Entity | undefined | 0 = 0
    if (on_update) {
      if (attacker === 0) attacker = this.attacter;
      this.loop(on_update, attacker);
    }
    if (this._ticker.add(d) && on_tick) {
      if (attacker === 0) attacker = this.attacter;
      this.loop(on_tick, attacker);
    }
    if (this._lifetime.add() && on_end) {
      if (attacker === 0) attacker = this.attacter;
      this.loop(on_end, attacker);
    }
  }

  private loop(fn: (attacker?: Entity, victim?: Entity) => "keep" | "del", attacker: Entity | undefined) {
    let slow = 0, fast = 0;
    for (; fast < this._victims.length; ++fast) {
      const vid = this._victims[fast];
      const victim = this.world.find_entity(vid);
      if (slow !== fast) this._victims[slow] = this._victims[fast];
      const ret = fn.call(this, attacker, victim);
      if (ret == 'del') continue;
      ++slow;
    }
    this._victims.length = slow;
  }

  to_snapshot(): IBuffSnapshot {
    return {
      attacker_id: this._attacker_id,
      level: this.level,
      mounted: this._mounted,
      victims: [...this._victims],
      ticker: this._ticker.to_snapshot(),
      lifetime: this._lifetime.to_snapshot(),
    };
  }
  read_snapshot(s: IBuffSnapshot): this {
    this._attacker_id = s.attacker_id;
    this._attacker = s.attacker_id ? this.world.find_entity(s.attacker_id) : void 0;
    this.level = s.level;
    this._mounted = s.mounted;
    this._victims.length = 0;
    this._victims.push(...s.victims);
    this._ticker.read_snapshot(s.ticker);
    this._lifetime.read_snapshot(s.lifetime);
    return this;
  }

  mount(): void {
    if (this._mounted) return;
    this._mounted = true;
    this.world.buffs.set(this.id, this);
  }
  unmount() {
    if (!this._mounted) return;
    this._mounted = false;
    this.del_victims(...this._victims);
  }
}