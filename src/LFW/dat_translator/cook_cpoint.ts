import { WorldDataset } from "../WorldDataset";
import type { IFrameInfo } from "../defines";
import { FacingFlag } from "../defines/FacingFlag";
import type { ICpoint } from "../defines/ICpoint";
import { Defines } from "../defines/defines";
import { abs } from "../utils";
import { is_num, is_str } from "../utils/type_check";
import { get_next_frame_by_raw_id } from "./get_the_next";
import { take } from "./take";
import { take_not_zero_num } from "./take_not_zero_num";
import { take_num } from "./take_num";

export function cook_cpoint(unsure_cpoint: ICpoint, frame: IFrameInfo): void {
  unsure_cpoint.x = take_not_zero_num(unsure_cpoint, "x") || 0;
  unsure_cpoint.y = take_not_zero_num(unsure_cpoint, "y") || 0;
  unsure_cpoint.z = take_not_zero_num(unsure_cpoint, "z") || 0;
  unsure_cpoint.throwvx = take_not_zero_num(unsure_cpoint, "throwvx", n => n);
  unsure_cpoint.throwvy = take_not_zero_num(unsure_cpoint, "throwvy", n => n);
  unsure_cpoint.throwvz = take_not_zero_num(unsure_cpoint, "throwvz", n => n);
  unsure_cpoint.throwinjury = take_not_zero_num(unsure_cpoint, "throwinjury", n => n * 1);
  unsure_cpoint.decrease = take_num(unsure_cpoint, 'decrease', n => -abs(n));

  const cover = take_not_zero_num(unsure_cpoint, "cover", n => n);
  if (cover == 1 || cover == 11) unsure_cpoint.z = 2;
  if (cover == 0 || cover == 10) unsure_cpoint.z = -2;

  const vaction = take(unsure_cpoint, "vaction");
  const raw_injury = take(unsure_cpoint, "injury");
  if (is_num(raw_injury)) unsure_cpoint.injury = abs(raw_injury);
  if (is_num(raw_injury) && raw_injury > 0) unsure_cpoint.shaking = 2
  if (is_num(raw_injury) && raw_injury > 0) unsure_cpoint.motionless = 2


  if (is_str(vaction) || is_num(vaction)) {
    unsure_cpoint.vaction = get_next_frame_by_raw_id(vaction, 'frame');
    if (cover === 11 || cover === 10) // for louis throw
      unsure_cpoint.vaction.facing = FacingFlag.SameAsCatcher

    if (unsure_cpoint.throwvx)
      delete unsure_cpoint.vaction?.facing;
  }
}