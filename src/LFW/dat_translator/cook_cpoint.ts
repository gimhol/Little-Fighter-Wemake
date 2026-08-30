import { CPointKind, type IFrameInfo } from "../defines";
import { FacingFlag } from "../defines/FacingFlag";
import type { ICpoint } from "../defines/ICpoint";
import { abs } from "../utils";
import { is_num, is_str } from "../utils/type_check";
import { get_next_frame_by_raw_id } from "./get_the_next";
import { take } from "./take";
import { take_not_zero_num } from "./take_not_zero_num";
import { take_num } from "./take_num";

export function cook_cpoint(cpoint: ICpoint, frame: IFrameInfo): void {
  cpoint.x = take_not_zero_num(cpoint, "x");
  cpoint.y = take_not_zero_num(cpoint, "y");
  cpoint.z = take_not_zero_num(cpoint, "z");
  cpoint.throwvx = take_not_zero_num(cpoint, "throwvx");
  cpoint.throwvy = take_not_zero_num(cpoint, "throwvy");
  cpoint.throwvz = take_not_zero_num(cpoint, "throwvz");
  cpoint.throwinjury = take_not_zero_num(cpoint, "throwinjury");
  cpoint.decrease = take_num(cpoint, 'decrease', n => -abs(n));

  const cover = take_not_zero_num(cpoint, "cover");
  if (cover == 1 || cover == 11) cpoint.z = 1;
  if (cover == 0 || cover == 10) cpoint.z = -1;
  if (!cover && CPointKind.Attacker == cpoint.kind) cpoint.z = -1;

  const vaction = take(cpoint, "vaction");
  const injury = take_num(cpoint, "injury");
  if (injury) cpoint.injury = abs(injury);
  if (injury && injury > 0) cpoint.shaking = 2;
  if (injury && injury > 0) cpoint.motionless = 2;

  if (is_str(vaction) || is_num(vaction)) {
    cpoint.vaction = get_next_frame_by_raw_id(vaction, 'frame');
    if (cover === 11 || cover === 10) // for louis throw
      cpoint.vaction.facing = FacingFlag.SameAsCatcher

    if (cpoint.throwvx)
      delete cpoint.vaction?.facing;
  }
}