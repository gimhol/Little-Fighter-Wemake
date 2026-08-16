import { KeyStatus } from "./KeyStatus";
import type { BaseController } from "./BaseController";
import { GK } from "../defines";

export class ControllerKeyStatus {
  readonly owner: BaseController;
  L: KeyStatus;
  R: KeyStatus;
  U: KeyStatus;
  D: KeyStatus;
  d: KeyStatus;
  j: KeyStatus;
  a: KeyStatus;
  constructor(owner: BaseController) {
    this.owner = owner;
    this.L = new KeyStatus(this.owner, GK.L);
    this.R = new KeyStatus(this.owner, GK.R);
    this.U = new KeyStatus(this.owner, GK.U);
    this.D = new KeyStatus(this.owner, GK.D);
    this.d = new KeyStatus(this.owner, GK.d);
    this.j = new KeyStatus(this.owner, GK.j);
    this.a = new KeyStatus(this.owner, GK.a);
  }
  to_snapshot(): number[][] {
    return [
      this.L.to_snapshot(),
      this.R.to_snapshot(),
      this.U.to_snapshot(),
      this.D.to_snapshot(),
      this.d.to_snapshot(),
      this.j.to_snapshot(),
      this.a.to_snapshot(),
    ];
  }
  from_snapshot(s: number[][]): void {
    this.L.from_snapshot(s[0]);
    this.R.from_snapshot(s[1]);
    this.U.from_snapshot(s[2]);
    this.D.from_snapshot(s[3]);
    this.d.from_snapshot(s[4]);
    this.j.from_snapshot(s[5]);
    this.a.from_snapshot(s[6]);
  }
}
