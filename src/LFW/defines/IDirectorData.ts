import type { LGK } from "./GameKey";

export type TNumberExpr = number | string;
export type TSelectors = string | string[];

export interface IKeyStepData {
  click?: LGK[];
  dbl_click?: LGK[];
  db_hit?: LGK[];
  key_down?: LGK[];
  key_up?: LGK[] | "all";
}

interface IActionBase {
  op: string;
}

export interface IInputActionData extends IActionBase {
  op: "input";
  target: TSelectors;
  actions: IKeyStepData[];
}

export interface ISetActionData extends IActionBase {
  op: "set";
  target: TSelectors;
  values: Record<string, unknown>;
}

export interface ICameraActionData extends IActionBase {
  op: "camera";
  dest?: [TNumberExpr, TNumberExpr];
  undest?: boolean;
  lock?: [TNumberExpr, TNumberExpr];
  unlock?: boolean;
}

export interface ICmdActionData extends IActionBase {
  op: "cmd";
  name: string;
  args?: TNumberExpr[];
}

export interface IBgActionData extends IActionBase {
  op: "bg";
  id: string;
}

export interface IDirectorStageData {
  left?: number;
  right?: number;
  near?: number;
  far?: number;
  width?: number;
  depth?: number;
  player_l?: number;
  player_r?: number;
  cam_l?: number;
  cam_r?: number;
  enemy_l?: number;
  enemy_r?: number;
  drink_l?: number;
  drink_r?: number;
  phase_time?: number;
  dialog_time?: number;
}

export interface IStageActionData extends IActionBase {
  op: "stage";
  values: IDirectorStageData;
}

export interface IPlaceActionData extends IActionBase {
  op: "place";
  target: TSelectors;
  at: string;
  dx?: TNumberExpr;
  dy?: TNumberExpr;
  dz?: TNumberExpr;
  requires?: string;
}

export interface IMoveActionData extends IActionBase {
  op: "move";
  target: TSelectors;
  dx?: TNumberExpr;
  dy?: TNumberExpr;
  dz?: TNumberExpr;
}

export interface IFaceActionData extends IActionBase {
  op: "face";
  target: TSelectors;
  at: string;
}

export interface IVelocityActionData extends IActionBase {
  op: "velocity";
  target: TSelectors;
  x?: TNumberExpr | null;
  y?: TNumberExpr | null;
  z?: TNumberExpr | null;
}

export interface IFrameActionData extends IActionBase {
  op: "frame";
  target: TSelectors;
  id: string;
}

export interface IPickupActionData extends IActionBase {
  op: "pickup";
  target: TSelectors;
  weapon: string;
  if_empty?: boolean;
}

export interface ICycleActionData extends IActionBase {
  op: "cycle";
  target: TSelectors;
  property: string;
  values: unknown[];
}

export interface IThrowSpotActionData extends IActionBase {
  op: "throw_spot";
  target: string;
  from: string;
}

export interface IResetActionData extends IActionBase {
  op: "reset";
}

export type TActionData =
  | IInputActionData
  | ISetActionData
  | ICameraActionData
  | ICmdActionData
  | IBgActionData
  | IStageActionData
  | IPlaceActionData
  | IMoveActionData
  | IFaceActionData
  | IVelocityActionData
  | IFrameActionData
  | IPickupActionData
  | ICycleActionData
  | IThrowSpotActionData
  | IResetActionData;

export interface ILayoutBaseData {
  x?: TNumberExpr;
  y?: TNumberExpr;
  z?: TNumberExpr;
}

export interface IPointLayoutData extends ILayoutBaseData {
  type?: "point";
}

export interface ILineLayoutData extends ILayoutBaseData {
  type: "line";
  axis?: "x" | "z";
  length?: TNumberExpr;
}

export interface ICircleLayoutData extends ILayoutBaseData {
  type: "circle";
  radius?: TNumberExpr;
  rx?: TNumberExpr;
  rz?: TNumberExpr;
}

export type TLayoutData = IPointLayoutData | ILineLayoutData | ICircleLayoutData;

export interface IActorData {
  id: string;
  oid?: string | string[];
  source?: "fighters";
  half?: "first" | "second";
  count?: number;
  layout?: TLayoutData;
  at?: string;
  x?: TNumberExpr;
  y?: TNumberExpr;
  z?: TNumberExpr;
  dx?: TNumberExpr;
  dy?: TNumberExpr;
  dz?: TNumberExpr;
  values?: Record<string, unknown>;
  group?: string | string[];
  ctrl?: "local" | "bot" | "invalid";
  player_id?: string;
  attach?: boolean;
}

export interface IAutoWhenData {
  state?: string | string[];
  state_not?: string | string[];
  mp_gt?: number;
  frame_hit?: string;
}

export interface IAutoRuleData {
  target: TSelectors;
  when?: IAutoWhenData;
  actions: IKeyStepData[];
}

export type TTimelineEntryData =
  | { wait: number }
  | { after?: number; actions?: TActionData[] }
  | { repeat: number; interval: number; entries: TTimelineEntryData[] };

export interface IDirectorTimelineData {
  times?: number;
  entries: TTimelineEntryData[];
}

export interface IDirectorData {
  name: string;
  bg?: string;
  stage?: IDirectorStageData;
  actors?: IActorData[];
  groups?: Record<string, TSelectors>;
  setup?: TActionData[];
  auto?: IAutoRuleData[];
  timeline?: IDirectorTimelineData;
}

export interface IDirectorFileData {
  directors: IDirectorData[];
}

export interface IDirectorGroupData extends IDirectorFileData {
  id: string;
  name?: string;
  file?: string;
}
