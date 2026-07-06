import type { IFrameInfo, INextFrame, IVector3 } from "../defines";
import { Entity } from "../entity/Entity";
import { is_ball, is_fighter, is_weapon } from "../entity/type_check";
import { BallState_Base } from "./BallState_Base";
import { CharacterState_Base } from "./CharacterState_Base";
import { State_Base } from "./State_Base";
import { WeaponState_Base } from "./WeaponState_Base";

export class StateBase_Proxy extends State_Base implements Required<State_Base> {
  character_proxy: CharacterState_Base;
  weapon_proxy: WeaponState_Base;
  ball_proxy: BallState_Base;
  proxy: State_Base;
  constructor(
    state: string | number,
    character_proxy = new CharacterState_Base(state),
    weapon_proxy = new WeaponState_Base(state),
    ball_proxy = new BallState_Base(state),
    proxy = new State_Base(state),
  ) {
    super(state);
    this.character_proxy = character_proxy
    this.weapon_proxy = weapon_proxy
    this.ball_proxy = ball_proxy
    this.proxy = proxy
  }
  override get_gravity(e: Entity): number | undefined | null {
    return this.get_proxy(e).get_gravity?.(e);
  }
  get_proxy(e: Entity) {
    if (is_fighter(e)) return this.character_proxy;
    if (is_weapon(e)) return this.weapon_proxy;
    if (is_ball(e)) return this.ball_proxy;
    return this.proxy;
  }
  override enter(e: Entity, prev_frame: IFrameInfo): void {
    return this.get_proxy(e).enter?.(e, prev_frame);
  }
  override leave(e: Entity, next_frame: IFrameInfo): void {
    return this.get_proxy(e).leave?.(e, next_frame);
  }
  override pre_update(e: Entity): void {
    return this.get_proxy(e).pre_update?.(e);
  }
  override update(e: Entity): void {
    return this.get_proxy(e).update(e);
  }
  override on_landing(e: Entity, velocity: IVector3): void {
    return this.get_proxy(e).on_landing?.(e, velocity);
  }
  override on_dead(e: Entity): void {
    return this.get_proxy(e).on_dead?.(e);
  }
  override get_auto_frame(e: Entity): IFrameInfo | undefined {
    return this.get_proxy(e).get_auto_frame?.(e);
  }
  override get_sudden_death_frame(target: Entity): INextFrame | undefined {
    return this.get_proxy(target)?.get_sudden_death_frame?.(target);
  }
  override get_caught_end_frame(target: Entity): INextFrame | undefined {
    return this.get_proxy(target)?.get_caught_end_frame?.(target);
  }
  override on_leave_ground(e: Entity): void {
    return this.get_proxy(e)?.on_leave_ground?.(e);
  }
  override find_frame_by_id(
    e: Entity,
    id: string | undefined,
  ): IFrameInfo | undefined {
    return this.get_proxy(e)?.find_frame_by_id?.(e, id);
  }
}
