
import { ChaseStratedy, EMPTY_FRAME_INFO, FID, FrameBehavior, GK, type IChaseInfo } from "../defines";
import { ChaseLost } from "../defines/ChaseLost";
import type { Entity } from "../entity/Entity";
import { closer_one, manhattan_xz } from "../helper";
import { round_float } from "../utils";
import { BaseController } from "./BaseController";
import type { ControllerResult } from "./ControllerResult";
const { L, R, U, D, j, d } = GK
export class BallController extends BaseController {
  readonly __is_ball_ctrl__ = true;
  private _chasing: Entity | null = null;
  private _frame = EMPTY_FRAME_INFO;
  get chasing(): Entity | null { return this._chasing; }
  set chasing(e: Entity | null) { this._chasing = e || null; }

  lookup(lookup: Entity) {
    const { chase } = this.entity.frame;
    if (!chase) return;

    const { stratedy } = chase;
    const a = this.chasing;
    const b = this.should_chase(a) ? a : this.chasing = null;
    if (a && stratedy === ChaseStratedy.TillLost) {
      this.set_chase_pos(
        a.position.x,
        a.position.y,
        a.position.z
      )
      return true
    }
    const c = this.should_chase(lookup) ? lookup : null;
    const d = this.chasing = closer_one(this.entity, b, c);
    // lost
    if (!d && a) {
      this.set_chase_pos(
        this.entity.position.x,
        this.entity.position.y,
        this.entity.position.z
      )
      return
    }

    // follow
    if (d) {
      this.set_chase_pos(
        d.position.x,
        d.position.y,
        d.position.z
      )
    }
  }

  update_lookup(me: number, entities: Entity[]): void {
    const { chase } = this.entity.frame;
    if (!chase) return;
    const { stratedy } = chase;
    if (stratedy !== ChaseStratedy.TillLost)
      this.chasing = null;
    const self = this.entity;
    const x0 = self.position.x;
    let i1 = me - 1;
    let i2 = me + 1;
    while (1) {
      let l: Entity | undefined = entities[i1];
      let r: Entity | undefined = entities[i2];
      if (this.chasing) {
        const d = manhattan_xz(self, this.chasing);
        if (l && x0 - l.position.x >= d) l = void 0;
        if (r && r.position.x - x0 >= d) r = void 0;
      }
      const e = closer_one(self, l, r);
      if (!e) break;
      if (!e.ghosted) this.lookup(e);
      if (l === e) --i1;
      if (r === e) ++i2;
    }
  }

  should_chase(other: Entity | null): boolean {
    if (!other) return false;
    if (
      other.frame.id === FID.Gone ||
      other.frame.id === FID.None
    ) return false;
    const { chase } = this.entity.frame;
    if (!chase) return false;
    const { flag } = chase
    const target = other.get_flag(this.entity)
    return (target & flag) == target
  }

  override update(): ControllerResult {
    const { frame, facing, hp } = this.entity;
    const { chase, behavior } = frame;

    if (hp > 0 && this._frame != frame) {
      if (this._frame.chase && !chase) {
        this.world.del_chaser(this)
      } else if (chase && !this._frame.chase) {
        this.world.add_chaser(this)
      }
    } else if (hp <= 0 && chase) {
      this.world.del_chaser(this)
    }

    if (behavior === FrameBehavior.JohnBiscuitLeaving) {
      const p1 = this.entity.position;
      this.key_down(facing < 0 ? L : R).key_up(facing < 0 ? R : L, U, D);
      if (p1.y > 40) this.key_down(d).key_up(j);
      else if (p1.y < 40) this.key_down(j).key_up(d);
      else this.key_up(j, d);
    }
    if (chase) this.update_chasing(chase)
    this._frame = frame;
    return super.update();
  }
  private update_chasing(chase: IChaseInfo) {
    const { chasing } = this;
    const { facing, hp } = this.entity;
    if (!this._chasing && chasing) this.start_chasing(chase)
    const me = this.entity.position;

    let { x, y, z } = chasing?.position || this.chase_pos;
    if (chasing)
      y = round_float(y + chasing.frame.centery * (chase.oy ?? 0.5))

    if (hp > 0 && (this._chasing || (chase.lost & ChaseLost.Hover))) {
      if (x < me.x) this.key_down(L).key_up(R)
      else if (x > me.x) this.key_down(R).key_up(L)
      else this.key_up(L, R)
      if (z < me.z) this.key_down(U).key_up(D)
      else if (z > me.z) this.key_down(D).key_up(U)
      else this.key_up(U, D)

      if (me.y > y) this.key_down(d).key_up(j)
      else if (me.y < y) this.key_down(j).key_up(d)
      else this.key_up(j, d)
    } else {
      const p1 = this.entity.position;
      this.key_down(facing < 0 ? L : R).key_up(facing < 0 ? R : L, U, D);
      if (p1.y > y) this.key_down(d).key_up(j)
      else if (p1.y < y) this.key_down(j).key_up(d)
      else this.key_up(j, d)
    }
    if (this._chasing && !chasing)
      this.end_chasing(chase)
    this._chasing = chasing;
  }
  private start_chasing(chase: IChaseInfo) {
  }
  private end_chasing(chase: IChaseInfo) {
    this.set_chase_pos(
      this.entity.position.x,
      this.entity.position.y,
      this.entity.position.z,
    )
  }
}