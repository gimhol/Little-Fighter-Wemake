import type { IState } from "../../../base";
import { CMD } from "../../../defines/CMD";
import { OID } from "../../../defines/OID";
import { Entity } from "../../../entity";
import { round_float } from "../../../utils/math/round_float";
import { ActionDirector } from "./ActionDirector";
import type { Tests } from "./Tests";

export class TestCase implements IState<number> {
  static key = -1;
  readonly key: number = ++TestCase.key;
  readonly owner: Tests;
  readonly director = new ActionDirector();
  entities: Entity[] = [];
  fighters: Entity[] = [];
  weapons: Entity[] = [];
  name: string = 'None';
  get lfw() { return this.owner.lfw }
  get world() { return this.owner.world }
  get bg() { return this.owner.world.bg }
  get fsm() { return this.owner.fsm }
  get left() { return this.world.bg.left; }
  get right() { return this.world.bg.right; }
  get far() { return this.world.bg.far; }
  get near() { return this.world.bg.near; }
  get midX() { return round_float((this.left + this.right) / 2); }
  get midZ() { return round_float((this.near + this.far) / 2); }

  readonly hori_3 = (oid: string, rx: number = 250, z: number = this.midZ): Entity[] => this.hori(oid, this.midX, z, rx * 2, 3);
  readonly hori_2 = (oid: string, rx: number = 250, z: number = this.midZ): Entity[] => this.hori(oid, this.midX, z, rx * 2, 2);
  readonly verti_3 = (oid: string, x: number = this.midX, z: number = 200): Entity[] => this.verti(oid, x, this.midZ, z, 3);

  constructor(owner: Tests) {
    this.owner = owner;
  }
  update(dt: number): number | void | undefined {
    if (!this.world.paused) this.director.update(dt);
  }
  enter(): void {
    this.director.reset();
    this.world.camera.undest()
    this.world.camera.unlock()
    this.owner.world.clear();
    this.owner.lfw.change_bg('bg_4');
  }
  leave(): void {
    this.lfw.push_cmd(CMD.DIST_CAM)
    this.owner.world.clear();
    this.owner.lfw.change_bg('bg_4');
  }
  spawn(oid: string) {
    const data = this.lfw.datas.find_entity(oid);
    if (!data) return null;
    return this.lfw.factory.create_entity(this.world, data)!;
  }
  spawns(...oids: string[]): Entity[] {
    const ret = [];
    for (const oid of oids) {
      ret.push(this.spawn(oid)!)
    }
    return ret;
  }
  bandits_8(): Entity[] {
    return this.circle(OID.Bandit, this.midX, this.midZ, this.bg.width / 2, this.bg.depth / 2, 8);
  }
  bandits_mid_8(x = 100, z = 50): Entity[] {
    return this.circle(OID.Bandit, this.midX, this.midZ, x, z, 8);
  }
  circle(oid: string | string[], ox: number, oz: number, r1: number, r2: number, count?: number): Entity[] {
    if (!oid.length) return [];
    const oids = typeof oid === 'string' ? [oid] : oid;
    count = Math.floor(count ?? oids.length);
    if (count <= 0) return [];
    const ret: Entity[] = [];
    const d = Math.PI * 2 / count;
    for (let i = 0; i < count; i++) {
      const oid = oids[i % oids.length];
      const a = round_float(d * i);
      const x = count === 1 ? ox : round_float(ox + Math.cos(a) * r1);
      const z = count === 1 ? oz : round_float(oz + Math.sin(a) * r2);
      const e = this.spawn(oid);
      if (!e) break;
      ret.push(e);
      e.set_position(x, 0, z);
      e.attach();
    }
    return ret;
  }

  verti(oid: string | string[], ox: number, oz: number, h: number, count?: number): Entity[] {
    if (!oid.length) return [];
    const oids = typeof oid === 'string' ? [oid] : oid;
    count = Math.floor(count ?? oids.length);
    if (count <= 0) return [];
    const ret: Entity[] = [];
    const d = count > 1 ? h / (count - 1) : 0;
    for (let i = 0; i < count; i++) {
      const z = round_float(count === 1 ? oz : oz - h / 2 + d * i)
      const oid = oids[i % oids.length];
      const o = this.spawn(oid);
      if (!o) continue;
      o.set_position(ox, 0, z);
      o.attach();
      ret.push(o)
    }
    return ret;
  }

  hori(oid: string | string[], ox: number, oz: number, w: number, count?: number): Entity[] {
    if (!oid.length) return [];
    const oids = typeof oid === 'string' ? [oid] : oid;
    count = Math.floor(count ?? oids.length);
    if (count <= 0) return [];
    const ret: Entity[] = [];
    const d = count > 1 ? w / (count - 1) : 0;
    for (let i = 0; i < count; i++) {
      const x = round_float(count === 1 ? ox : ox - w / 2 + d * i);
      const oid = oids[i % oids.length];
      const o = this.spawn(oid);
      if (!o) continue;
      o.set_position(x, 0, oz);
      o.attach();
      ret.push(o)
    }
    return ret;
  }

}
