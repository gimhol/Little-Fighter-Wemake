import { MsgEnum, type IRespTick, type TRejoinTick } from "@/Net";
import type { IRespKeyTick } from "@/Net/IMsg_KeyTick";
import { LFWNetworkDriver } from "./LFWNetworkDriver";

export class LockstepNetworkDriver extends LFWNetworkDriver {
  protected _resp?: IRespTick | IRespKeyTick;
  protected _resyncing: (IRespTick | IRespKeyTick)[] = [];

  get lead(): number { return 1; }

  protected on_tick_data(resp: IRespTick | IRespKeyTick): void {
    if (this._resyncing.length) {
      this._resyncing.push(resp);
      return;
    }
    this._resp = resp;
    if (!this._suspended) this.lfw?.world.awake();
  }

  before_update = () => {
    const { lfw } = this;
    if (!lfw) return;
    if (this._suspended) return lfw.world.sleep();
    const next = this._resyncing.shift();
    if (next) return this.run_tick(next.seq!, next);
    const resp = this._resp;
    this._resp = void 0;
    if (!resp) return lfw.world.sleep();
    this.run_tick(resp.seq!, resp);
  };

  after_update = () => {
    const { lfw } = this;
    if (!lfw) return;
    if (this.debugging) this._snapshot2?.capture(lfw.world.entities);
    if (this._resyncing.length) return;
    this.set_catchup(0);
    lfw.world.sleep();
  };

  begin_rejoin(resps: TRejoinTick[], next_seq: number): void {
    const { lfw } = this;
    if (!lfw) return;
    this._suspended = false;
    this._resp = void 0;
    lfw.cmds.length = 0;
    if (!resps.length) {
      const req = this._last_req && this._last_req.seq === next_seq
        ? this._last_req
        : { seq: next_seq };
      this.conn?.send_nowait(MsgEnum.Tick, req);
      return;
    }
    this._resyncing.push(...resps as (IRespTick | IRespKeyTick)[]);
    this.set_catchup(resps.length);
    lfw.world.awake();
  }
}
