import { BdyKind, HitFlag, OID } from "../defines";
import { ActionType } from "../defines/actions/ActionType";
import type { IBdyInfo } from "../defines/IBdyInfo";
import { ItrKind } from "../defines/ItrKind";
import type { IFrameInfoContext } from "../loader/IEntityDataContext";
import { ensure } from "../utils";
import { cook_ball_bdy_get_hit_to_frame_20 } from "./cook_ball_bdy_get_hit_to_frame_20";
import { cook_ball_bdy_get_hit_to_frame_30 } from "./cook_ball_bdy_get_hit_to_frame_30";
import { EditBdy } from "./EditBdy";


export function cook_ball_frame_state_3000(ctx: IFrameInfoContext) {
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
    bdy_list[i] = cook_ball_bdy_get_hit_to_frame_20({ ...ctx, bdy, index: i });
    /* ball 被打到反弹的bdy */
    new_bdy.push(cook_ball_bdy_get_hit_to_frame_30({ ...ctx, bdy, index: -1 }));
  }
  bdy_list.push(...new_bdy);

  const itr_list = frame.itr ? frame.itr : (frame.itr = []);
  for (const itr of itr_list) {
    switch (itr.kind) {
      case ItrKind.Normal:
        // 命中跳转至10
        itr.actions = ensure(itr.actions, {
          type: ActionType.A_NEXT_FRAME,
          data: { id: "10" }
        });
        break
    }
  }
}
