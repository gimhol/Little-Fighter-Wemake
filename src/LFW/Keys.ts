import { KeyStatus } from "./controller/KeyStatus";
import { GK } from "./defines/GameKey";
import { LFW } from "./LFW";
import { World } from "./World";

export class Keys {
  readonly lfw: LFW;
  readonly world: World;
  get time() { return this.lfw.world.lifetime; }
  readonly [GK.L] = new KeyStatus(this, GK.L);
  readonly [GK.R] = new KeyStatus(this, GK.R);
  readonly [GK.U] = new KeyStatus(this, GK.U);
  readonly [GK.D] = new KeyStatus(this, GK.D);
  readonly [GK.a] = new KeyStatus(this, GK.a);
  readonly [GK.j] = new KeyStatus(this, GK.j);
  readonly [GK.d] = new KeyStatus(this, GK.d);
  constructor(lfw: LFW) {
    this.lfw = lfw;
    this.world = lfw.world;
  }
  mount(): void {
    this.lfw.regist_keys(this);
  }
  unmount(): void {
    this.lfw.recycle_keys(this);
  }
}
