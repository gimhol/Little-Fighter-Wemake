import { type IFrameInfo, SE, StateEnum } from "../defines";
import { ActionType } from "../defines/actions/ActionType";
import { B_K, OLD_BDY_KIND_GOTO_MAX, OLD_BDY_KIND_GOTO_MIN } from "../defines/BdyKind";
import { O_ID } from "../defines/OID";
import { CollisionVal as C_Val } from "../defines/CollisionVal";
import { E_E } from "../defines/EntityEnum";
import { HitFlag } from "../defines/HitFlag";
import { bdy_info_fields, type IBdyInfo } from "../defines/IBdyInfo";
import { I_K } from "../defines/ItrKind";
import { between, ensure } from "../utils";
import { reorder_keys } from "../fields";
import { CondMaker } from "./CondMaker";
import { set_bdy_kind } from "./set_bdy_kind";
import { set_hit_flag } from "./set_hit_flag";
import { take } from "./take";

export function cook_bdy(bdy: Partial<IBdyInfo>, frame: IFrameInfo): void {
  if (!bdy) return;
  const kind = Number(take(bdy, "kind"));
  set_bdy_kind(bdy, kind);
  reorder_keys(bdy, bdy_info_fields)
}
