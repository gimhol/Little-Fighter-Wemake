import { HitFlag } from "../HitFlag";
import { ActionType } from "./ActionType";
import type { IAction_Base } from "./IAction_Base";

export interface IAction_VBuff extends IAction_Base {
  type: ActionType.V_BUFF;
  data?: {
    hitflag?: HitFlag;
    duration?: number;
    buff?: string;
  };
}

