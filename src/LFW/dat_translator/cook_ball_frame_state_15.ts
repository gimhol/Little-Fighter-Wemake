import { BdyKind, HitFlag, OID } from "../defines";
import type { IBdyInfo } from "../defines/IBdyInfo";
import type { IFrameInfoContext } from "../loader/IEntityDataContext";
import { cook_ball_bdy_get_hit } from "./cook_ball_bdy_get_hit";
import { cook_ball_bdy_rebound } from "./cook_ball_bdy_rebound";
import { EditBdy } from "./EditBdy";

/**
 * 能被角色普通反弹
 * 能被武器挥动普通反弹
 */
export function cook_ball_frame_state_15(ctx: IFrameInfoContext) {
  const { frame } = ctx;
  const bdy_list = frame.bdy ? frame.bdy : (frame.bdy = []);
  const new_bdy: IBdyInfo[] = [];
  for (let i = 0; i < bdy_list.length; i++) {
    const bdy = bdy_list[i];
    if (bdy.kind != BdyKind.Normal) continue;

    if (ctx.data.id == OID.FreezeColumn) {
      /* 
      NOTE: 冰柱能被自己队伍物品相同朝向的 打到似乎是特殊ID的缘故 -Gim
      */
      EditBdy.edit(bdy, { hit_flag: HitFlag.AllBoth })
    }


    /* ball 被打到消失的bdy */
    bdy_list[i] = cook_ball_bdy_get_hit({ ...ctx, bdy, index: i });
    /* ball 被打到反弹的bdy */
    new_bdy.push(cook_ball_bdy_rebound({ ...ctx, bdy, index: -1 }));

  }
  bdy_list.push(...new_bdy);
}
