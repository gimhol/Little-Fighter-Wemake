import { MsgEnum, type IRespTick, type TRejoinTick } from "@/Net";
import type { IRespKeyTick } from "@/Net/IMsg_KeyTick";
import { LFWNetworkDriver } from "./LFWNetworkDriver";

export class DelayNetworkDriver extends LFWNetworkDriver {
  readonly input_delay: number;
  protected _seq: number = 0;
  protected _starved: boolean = false;
  protected readonly _inputs = new Map<number, IRespTick | IRespKeyTick>();

  constructor(input_delay: number = 2) {
    super();
    this.input_delay = input_delay;
  }

  get lead(): number { return Math.max(1, Math.floor(this.input_delay)); }

  override get rejoin_seq(): number { return this._seq; }

  begin_rejoin(resps: TRejoinTick[], next_seq: number): void {
    const { lfw, conn } = this;
    if (!lfw) return;
    this._suspended = false;
    lfw.cmds.length = 0;
    for (const resp of resps)
      this._inputs.set(resp.seq!, resp as IRespTick);
    this.set_catchup(resps.length);
    const owed_end = this._seq - 1 + this.lead;
    for (let seq = next_seq; seq <= owed_end; seq++) {
      if (this._inputs.has(seq)) continue;
      conn?.send_nowait(MsgEnum.Tick, { seq });
    }
    if (!resps.length) {
      const req = this._last_req;
      if (req && typeof req.seq === 'number')
        conn?.send_nowait(MsgEnum.Tick, req);
    }
    this._starved = true;
    if (this._inputs.has(this._seq)) {
      this._starved = false;
      lfw.world.awake();
    }
  }

  protected override on_start(): void {
    this._seq = 0;
    // 初始时 world 处于 sleep，等第 0 帧输入到达后由 on_tick_data 唤醒
    this._starved = true;
    this._inputs.clear();
    const { conn } = this;
    if (!conn) return;
    for (let seq = 1; seq < this.lead; seq++)
      conn.send_nowait(MsgEnum.Tick, { seq });
  }

  protected on_tick_data(resp: IRespTick | IRespKeyTick): void {
    const seq = resp.seq!;
    this._inputs.set(seq, resp);
    if (!this._suspended && this._starved && seq === this._seq) {
      this._starved = false;
      this.lfw?.world.awake();
    }
  }

  before_update = () => {
    const { lfw } = this;
    if (!lfw) return;
    if (this._suspended) return lfw.world.sleep();
    const resp = this._inputs.get(this._seq);
    if (!resp) {
      this._starved = true;
      return lfw.world.sleep();
    }
    this._inputs.delete(this._seq);
    this.run_tick(this._seq, resp);
  };

  after_update = () => {
    const { lfw } = this;
    if (!lfw) return;
    if (this.debugging) this._snapshot2?.capture(lfw.world.entities);
    this._seq++;
    if (!this._inputs.has(this._seq)) {
      this._starved = true;
      this.set_catchup(0);
      lfw.world.sleep();
    }
  };
}
