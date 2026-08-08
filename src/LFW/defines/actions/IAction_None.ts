import type { ActionType } from "./ActionType";
import type { IAction_Base } from "./IAction_Base";

export interface IAction_None extends IAction_Base {
  type: ActionType.NONE;
}
