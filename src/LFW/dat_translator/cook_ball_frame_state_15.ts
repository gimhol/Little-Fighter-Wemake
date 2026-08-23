import { BdyKind, HitFlag, OID } from "../defines";
import type { IBdyInfo } from "../defines/IBdyInfo";
import type { IFrameInfoContext } from "../loader/IEntityDataContext";
import { cook_ball_bdy_get_hit_to_frame_20 } from "./cook_ball_bdy_get_hit_to_frame_20";
import { cook_ball_bdy_get_hit_to_frame_30 } from "./cook_ball_bdy_get_hit_to_frame_30";
import { EditBdy } from "./EditBdy";

/**
 * 能被角色普通反弹
 * 能被武器挥动普通反弹
 * 打到fighter不会消失
 * 
 * NOTE: 
 *    冰柱(id=212, state=3000) 
 *      能被相同朝向的自己队伍打到, 
 *    冰柱(id=212, state=15) 
 *      能被相同朝向的自己队伍打到,
 *      却不会被自己的(id=212, state=15)打到
 *    应该是特殊ID硬编码 
 *      -Gim
 */
export function cook_ball_frame_state_15(ctx: IFrameInfoContext) {
  const { frame } = ctx;
  const bdy_list = frame.bdy ? frame.bdy : (frame.bdy = []);
  const new_bdy: IBdyInfo[] = [];
  for (let i = 0; i < bdy_list.length; i++) {
    const bdy = bdy_list[i];
    if (bdy.kind != BdyKind.Normal) continue;

    if (ctx.data.id == OID.FreezeColumn) 
      EditBdy.edit(bdy, { hit_flag: HitFlag.AllBoth })

    /* ball 被打到消失的bdy */
    bdy_list[i] = cook_ball_bdy_get_hit_to_frame_20({ ...ctx, bdy, index: i });
    /* ball 被打到反弹的bdy */
    new_bdy.push(cook_ball_bdy_get_hit_to_frame_30({ ...ctx, bdy, index: -1 }));

  }
  bdy_list.push(...new_bdy);
}
