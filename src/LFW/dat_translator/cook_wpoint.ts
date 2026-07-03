import type { IFrameInfo, IWpointInfo } from "../defines";
import { not_zero_num } from "../utils/type_check";
import { take } from "./take";
import { take_not_zero_num } from "./take_not_zero_num";

export function cook_wpoint(unsure_wpoint: IWpointInfo, frame: IFrameInfo) {
  const x = take(unsure_wpoint, "x");
  unsure_wpoint.x = x || 0

  const y = take(unsure_wpoint, "y");
  unsure_wpoint.y = y || 0

  const z = take(unsure_wpoint, "z");
  unsure_wpoint.z = z || 0

  const dvx = take(unsure_wpoint, "dvx");
  if (not_zero_num(dvx)) unsure_wpoint.dvx = dvx;

  const dvz = take(unsure_wpoint, "dvz");
  if (not_zero_num(dvz)) unsure_wpoint.dvz = dvz;

  const dvy = take(unsure_wpoint, "dvy");
  if (not_zero_num(dvy)) unsure_wpoint.dvy = dvy;

  const attacking = take(unsure_wpoint, "attacking");
  if (attacking) unsure_wpoint.attacking = "" + attacking;

  unsure_wpoint.z = 0;
  if (unsure_wpoint.kind == 1) {
    const cover = take_not_zero_num(unsure_wpoint, "cover", n => n);
    unsure_wpoint.z = cover == 1 ? -2 : 2;
  }

  unsure_wpoint.weaponact = '' + take(unsure_wpoint, "weaponact") || "";
}
