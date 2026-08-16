import type { IHitKeyMap, IVector3, LGK, TNextFrame } from "../defines";
import { AGK, CONFLICTS_KEY_MAP, GK, GKLabels, StateEnum as SE } from "../defines";
import type { Entity } from "../entity/Entity";
import { is_bot_ctrl, is_human_ctrl } from "../entity/type_check";
import type { LFW } from "../LFW";
import type { PlayerInfo } from "../PlayerInfo";
import { is_f_num, round_float } from "../utils";
import { Times } from "../utils/Times";
import type { World } from "../World";
import { ControllerDoubleClicks } from "./ControllerDoubleClicks";
import { ControllerKeyStatus } from "./ControllerKeyStatus";
import { ControllerResult } from "./ControllerResult";
import type { KeyStatus } from "./KeyStatus";
import { SeqKeys } from "./SeqKeys";
enum Status {
  UP = 0,
  DOWN = 1,
  HOLD = 2,
}

/**
 * @link https://www.processon.com/view/link/6765125f16640e2a68b21418?cid=6764eb96c3e02b46ac818e40
 */
export class BaseController {
  static readonly TAG: string = 'BaseController';
  readonly __is_base_ctrl__ = true;
  readonly keys = new ControllerKeyStatus(this);
  readonly dbc = new ControllerDoubleClicks(this);
  private readonly _time = new Times(10, Number.MAX_SAFE_INTEGER);

  player_id: string;
  player: PlayerInfo | undefined;
  private _chase_pos: IVector3 | null = null;
  entity: Entity;

  private _key_list: string = '';
  private _readable_key_list: string = '';

  protected seqKeyMap = new Map<string, SeqKeys<{ etc: string }>>([
    ['djdj', new SeqKeys([GK.d, GK.j, GK.d, GK.j].join(''), { etc: "0" })],
    ['dddd', new SeqKeys([GK.d, GK.d, GK.d, GK.d].join(''), { etc: "2" })],
    ['dada', new SeqKeys([GK.d, GK.a, GK.d, GK.a].join(''), { etc: "4" })],
    ['djjj', new SeqKeys([GK.d, GK.j, GK.j, GK.j].join(''), { etc: "8" })],
  ])

  protected readonly result = new ControllerResult();
  readonly queue: (readonly [Status, LGK])[] = []

  readonly ku = this.key_up.bind(this);
  readonly kd = this.key_down.bind(this);
  readonly ck = this.click.bind(this);
  readonly world: World;
  readonly lfw: LFW;

  get time() {
    return this._time.value;
  }
  get chase_pos(): Readonly<IVector3> {
    if (!this._chase_pos)
      this._chase_pos = this.entity.position.clone()
    return this._chase_pos
  }
  get LR(): 0 | 1 | -1 {
    const L = !this.keys.L.is_end() || this.keys.L.is_start();
    const R = !this.keys.R.is_end() || this.keys.R.is_start();
    return L === R ? 0 : R ? 1 : -1;
  }
  get RL(): 0 | 1 | -1 { return -this.LR as 0 | 1 | -1 }

  get UD(): 0 | 1 | -1 {
    const U = !this.keys.U.is_end() || this.keys.U.is_start();
    const D = !this.keys.D.is_end() || this.keys.D.is_start();
    return U === D ? 0 : D ? 1 : -1;
  }
  get DU(): 0 | 1 | -1 { return -this.UD as 0 | 1 | -1 }

  get jd(): 0 | 1 | -1 {
    const d = !this.keys.d.is_end() || this.keys.d.is_start();
    const j = !this.keys.j.is_end() || this.keys.j.is_start();
    return d === j ? 0 : d ? -1 : 1;
  }
  get dj(): 0 | 1 | -1 { return -this.jd as 0 | 1 | -1 }

  get key_list() { return this._readable_key_list; }

  set_chase_pos(x: number, y: number, z: number) {
    if (is_f_num(x) || is_f_num(y) || is_f_num(z)) debugger;
    this.chase_pos.set(
      round_float(x),
      round_float(y),
      round_float(z)
    )
  }

  constructor(player_id: string, entity: Entity) {
    this.player_id = player_id;
    const { lfw } = entity
    this.player = lfw.players.get(player_id);
    this.entity = entity;
    this.lfw = entity.lfw;
    this.world = entity.world;
  }

  reset_key_list() {
    this._key_list = ''
    this._readable_key_list = ''
  }

  /**
   * 指定按键进入start状态（按下）
   * @param keys 指定按键
   * @returns {this}
   */
  start(...keys: LGK[]): this {
    this.queue.push(...keys.map(k => [1, k] as const))
    return this;
  }

  /**
   * 指定按键进入hold状态
   * @param keys 指定按键
   * @returns {this}
   */
  hold(...keys: LGK[]): this {
    this.queue.push(...keys.map(k => [2, k] as const))
    return this;
  }

  /**
   * 指定按键进入end状态（松开）
   * @param keys 指定按键
   * @returns {this}
   */
  end(...keys: LGK[]): this {
    this.queue.push(...keys.map(k => [0, k] as const))
    return this;
  }

  /**
   * 指定按键直接进入"双击"状态(结尾不会抬起)
   * like: ⬇+⬆+⬇
   * @param keys 指定按键
   * @returns {this}
   */
  db_hit(...keys: LGK[]): this {
    this.start(...keys)
      .end(...keys)
      .start(...keys);
    return this;
  }
  is_hold(k: string): boolean;
  is_hold(k: LGK): boolean;
  is_hold(k: LGK): boolean {
    return !!this.keys[k]?.is_hld();
  }

  is_hit(k: string): boolean;
  is_hit(k: LGK): boolean;
  is_hit(k: LGK): boolean {
    return !!this.keys[k]?.is_hit();
  }

  is_db_hit(k: LGK): boolean {
    const dbc = this.dbc[k]
    const { time, data: [d0, d1] } = dbc;
    const ret = time > 0 && this.time - time <= this.entity.world.dataset.key_hit_duration;
    if (!ret) return false
    if (!d0 || !d1) return true;
    // stupid...
    if (
      (d0.fstate == SE.Standing || d0.fstate == SE.Walking) &&
      (d0.fstate == SE.Standing || d0.fstate == SE.Walking)
    ) {
      return true;
    }
    if (k === GK.L && (d0.facing !== -1 || d1.facing !== -1)) {
      dbc.step();
      return false;
    }
    if (k === GK.R && (d0.facing !== 1 || d1.facing !== 1)) {
      dbc.step();
      return false;
    }
    return true
  }
  is_end(k: string): boolean;
  is_end(k: LGK): boolean;
  is_end(k: LGK): boolean {
    return !!this.keys[k]?.is_end();
  }

  is_start(k: string): boolean;
  is_start(k: LGK): boolean;
  is_start(k: LGK): boolean {
    return !!this.keys[k]?.is_start();
  }

  click(...keys: LGK[]): this {
    for (const k of keys)
      this.start(k).end(k);
    return this;
  }
  dbl_click(...keys: LGK[]): this {
    for (const k of keys)
      this.start(k).end(k).start(k).end(k);
    return this;
  }
  /** 
   * 按下按键
   * 
   * 当按键已处于按下状态时，将被忽略
   */
  key_down(...keys: LGK[]): this {
    for (const k of keys)
      if (this.is_end(k))
        this.start(k);
    return this;
  }

  /** 
   * 抬起按键 
   * 
   * 当按键已处于抬起状态时，将被忽略dbl
   */
  key_up(...keys: LGK[]): this {
    for (const k of keys)
      if (!this.is_end(k))
        this.end(k);
    return this;
  }
  tst(type: "hit" | "hld" | "dbl" | "kd" | 'ku', key: GK) {
    const conflict_key = CONFLICTS_KEY_MAP[key];
    if (conflict_key && !this.is_end(conflict_key)) return false;
    if (type === "kd") return !this.is_end(key) || this.keys[key].time == this.time;
    if (type === "ku") return this.is_end(key) || this.keys[key].u_time == this.time;
    if (type === "dbl") return this.is_db_hit(key);
    if (type === "hit") return this.keys[key].is_hit() && !this.keys[key].used;
    else return this.keys[key].is_hld();
  }

  update(): ControllerResult {
    this._time.add()
    const me = this.entity;
    const { facing } = me;
    let F = facing === 1 ? GK.R : GK.L;
    let B = facing === 1 ? GK.L : GK.R;
    if (this.queue.length) {
      let key_downs = '';
      for (const [status, gk] of this.queue) {
        switch (status) {
          case Status.UP:
            if (this.is_end(gk)) break
            this.keys[gk].end();
            break;
          case Status.DOWN:
            if (!this.is_end(gk)) break;
            key_downs += gk;
            if (gk === GK.d) {
              this._key_list = gk;
              this._readable_key_list = GKLabels[gk]
            } else if (this._key_list[0] === GK.d) {
              this._key_list += gk;
              this._readable_key_list += GKLabels[gk]
            }
            this.keys[gk].hit(this.time);
            const ck = CONFLICTS_KEY_MAP[gk];
            if (ck) this.dbc[ck].reset();

            const dbc = this.dbc[gk]
            if (!dbc.fired) dbc.press(this.time, {
              fstate: me.frame.state, facing: me.facing
            }, me.world.dataset.double_click_interval);

            break;
          case Status.HOLD:
            this.keys[gk].hit(this.time - me.world.dataset.key_hit_duration);
            break;
        }
      }
      if (is_human_ctrl(this) && key_downs.length && me.hp) {
        for (const [k, v] of this.seqKeyMap) {
          v.press(key_downs)
          if (!v.hit) continue;
          const { x, y, z } = me.position;
          this.world.etc(x, y, z, v.data.etc)
          if (v.data.etc === '0') this.world.team_come(me.team, x, y, z)
          if (v.data.etc === '2') this.world.team_stay(me.team)
          if (v.data.etc === '4') this.world.team_move(me.team)
          if (v.data.etc === '8') this.world.team_follow(me)
          v.reset()
        }
      }
      this.queue.length = 0;
    }
    const entity = this.entity;
    const frame = entity.frame;
    const { hold: hld, hit, key_down: kd, key_up: ku } = frame;

    const ret = this.result.clear();


    if (kd && !ret.time) {
      /** 相对方向的按钮判定 */
      if (kd.F && this.tst('kd', F))
        ret.fire(kd.F, this.keys[F].time, F, 'kd');
      if (kd.B && this.tst("kd", B))
        ret.fire(kd.B, this.keys[B].time, B, 'kd');
    }
    if (ku && !ret.time) {
      /** 相对方向的按钮判定 */
      if (ku.F && this.tst("ku", F))
        ret.fire(ku.F, this.keys[F].time, F, 'ku');
      if (ku.B && this.tst("ku", B))
        ret.fire(ku.B, this.keys[B].time, B, 'ku');
    }
    if (hit && !ret.time) {
      /** 相对方向的按钮判定 */
      if (hit.F && this.tst("hit", F)) ret.fire(hit.F, this.keys[F].use(), F, 'hit');
      if (hit.B && this.tst("hit", B)) ret.fire(hit.B, this.keys[B].use(), B, 'hit');
    }
    if (me.data.hit && !ret.time) {
      /** 相对方向的双击判定 */
      if (me.data.hit.F && this.tst("hit", F)) ret.fire(me.data.hit.F, this.keys[F].use(), F, 'hit');
      if (me.data.hit.B && this.tst("hit", B)) ret.fire(me.data.hit.B, this.keys[B].use(), B, 'hit');
    }
    if (hit) {
      /** 相对方向的双击判定 */
      if (hit.FF && this.tst("dbl", F)) ret.fire(hit.FF, this.dbc[F].time, F, 'dbl');
      if (hit.BB && this.tst("dbl", B)) ret.fire(hit.BB, this.dbc[B].time, B, 'dbl');
    }
    if (me.data.hit) {
      /** 相对方向的双击判定 */
      if (me.data.hit.FF && this.tst("dbl", F)) ret.fire(me.data.hit.FF, this.dbc[F].time, F, 'dbl');
      if (me.data.hit.BB && this.tst("dbl", B)) ret.fire(me.data.hit.BB, this.dbc[B].time, B, 'dbl');
    }

    /** 相对方向的按钮判定 */
    if (hld) {
      if (hld.F && this.tst("hld", F)) ret.fire(hld.F, this.keys[F].time, F, 'hld');
      if (hld.B && this.tst("hld", B)) ret.fire(hld.B, this.keys[B].time, B, 'hld');
    }

    for (const name of AGK) {
      const key = this.keys[name];
      if (this.check_key_act(kd, 'kd', key, false)) break;
      if (this.check_key_act(ku, 'ku', key, false)) break;
      if (this.check_key_act(me.data.hit, 'hit', key, true)) break;
      if (this.check_key_act(hit, 'hit', key, true)) break;
      if (this.check_key_act(hld, 'hld', key, false)) break;
      if (this.dbc[name].fired) this.dbc[name].fired = false;
    }
    frame?.__seq_map && this.check_hit_seqs(frame.__seq_map, ret);
    /** 这里不想支持过长的指令 */
    if (this._key_list && this._key_list.length >= 10) {
      this._key_list = '';
      this._readable_key_list = ''
    }
    return ret;
  }

  private check_key_act(map: IHitKeyMap | undefined, kind: 'hit' | 'ku' | 'kd' | 'hld', key: KeyStatus, use: boolean) {
    if (!map) return false;
    if (this.result.time) return false;

    const name = key.key;
    /** 单击判定 */
    let act = map[name];
    if (act && this.tst(kind, name)) {
      const time = use ? key.use() : key.time
      this.result.fire(act, time, name, kind);
      return true;
    }

    if (kind != 'hit') return false;

    /** 双击判定 */
    const keykey = `${name}${name}` as keyof IHitKeyMap;
    act = map[keykey];
    if (act && this.tst("dbl", name)) {
      this.result.fire(act, this.dbc[name].time, name, 'dbl');
      return true;
    }
    return false;
  }
  private check_hit_seqs(seqs: Map<string, TNextFrame>, result: ControllerResult) {
    /** 同时按键 判定 */
    if (this.keys.d.is_hit()) {
      for (const [seq, nf] of seqs) {
        if (!seq || !nf) continue;
        if (!this.sametime_keys_test(seq)) continue;
        for (let k of seq) this.keys[k as GK]?.use();
        result.fire(nf, this.time, 'd' + seq, 'seq');
        this._key_list = '';
        this._readable_key_list = ''
        return;
      }
    }
    if (is_bot_ctrl(this)) return;
    /** 顺序按键 判定 */
    if (this._key_list.length >= 3) {
      for (const [seq, nf] of seqs) {
        if (!seq || !nf) continue;
        if (!this.sequence_keys_test(seq)) continue;
        result.fire(nf, this.time, 'd' + seq, 'seq');
        for (let k of seq) this.keys[k as GK]?.use();
        this._key_list = '';
        this._readable_key_list = ''
        return;
      }
    }
  }

  sequence_keys_test(str: string): boolean {
    if (this._key_list[0] !== 'd') return false;
    for (let i = 0; i < str.length; i++) {
      let actual_key = this._key_list[i + 1]
      let expected_key = str[i]
      if (expected_key === 'F')
        expected_key = this.entity.facing > 0 ? GK.R : GK.L
      else if (expected_key === 'B')
        expected_key = this.entity.facing < 0 ? GK.R : GK.L
      if (expected_key !== actual_key)
        return false;
    }
    return true;
  }
  sametime_keys_test(str: string): boolean {
    for (let k of str) {
      if (k === 'F')
        k = this.entity.facing > 0 ? GK.R : GK.L
      else if (k === 'B')
        k = this.entity.facing < 0 ? GK.R : GK.L
      if (!this.is_hit(k))
        return false;
    }
    return true;
  }
}
