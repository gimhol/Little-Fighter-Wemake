import type { Entity } from "./Entity";

export enum TReleaseMode {
  /** 持握 */
  Hold = 0,
  /** 掉落*/
  Drop = 1,
  /** 投掷*/
  Throw = 2,
}

export interface IReleasePoint {
  x: number;
  y: number;
  z: number;
}

/**
 * 武器出手点：结果写进调用方传入的 `out`（复用，不分配），
 * 其余直接传实体（用它们的 position / facing / frame），不拆参数。
 */
export function release_point(
  out: IReleasePoint,
  mode: TReleaseMode,
  bearer: Entity,
  weapon?: Entity,
): IReleasePoint {
  const bearer_frame = bearer.frame;
  const wp_a = bearer_frame.wpoint;
  const wa_x = wp_a?.x ?? 0;
  const wa_y = wp_a?.y ?? 0;
  const wa_z = wp_a?.z ?? 0;
  const cx_a = bearer_frame.centerx ?? 0;
  const cy_a = bearer_frame.centery ?? 0;

  if (mode === TReleaseMode.Hold) {
    const weapon_frame = weapon?.frame;
    const wp_b = weapon_frame?.wpoint;
    out.x = bearer.position.x +
      bearer.facing * (wa_x - cx_a + (weapon_frame?.centerx ?? 0) - (wp_b?.x ?? 0));
    out.y = bearer.position.y +
      cy_a - wa_y - (weapon_frame?.centery ?? 0) + (wp_b?.y ?? 0);
    out.z = bearer.position.z + wa_z - (wp_b?.z ?? 0);
    return out;
  }

  out.x = bearer.position.x + bearer.facing * (wa_x - cx_a);
  out.y = bearer.position.y + cy_a - wa_y;
  out.z = mode === TReleaseMode.Drop
    ? bearer.position.z + wa_z
    : bearer.position.z + wa_z - (weapon?.frame.wpoint?.z ?? 0);
  return out;
}
