import type { LFW } from "..";
import type { IBdyInfo, IEntityData, IFrameInfo, IItrInfo } from "../defines";

export interface IEntityDataContext {
  lfw: LFW;
  data: IEntityData;
  jobs: Promise<any>[];
  errors: string[];
}
export interface IFrameInfoContext extends IEntityDataContext {
  frame: IFrameInfo;
}
export interface IBdyInfoContext extends IFrameInfoContext {
  index: number;
  bdy: IBdyInfo;
}
export interface IItrInfoContext extends IFrameInfoContext {
  index: number;
  itr: IItrInfo;
}

