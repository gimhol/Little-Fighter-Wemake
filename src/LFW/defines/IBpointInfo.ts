import type { IQubePair } from "./IQubePair";
import { any, fields, int } from "../fields";

export interface IBpointInfo {
  x: number;
  y: number;
  z?: number;
  r?: number;
  __indicator_info?: IQubePair;
}

export function bpoint_info_new(): IBpointInfo {
  return {
    x: 0,
    y: 0,
  };
}

export const bpoint_info_fields = fields<IBpointInfo>({
  x: int("X"),
  y: int("Y"),
  z: int("Z"),
  r: int("R"),
  __indicator_info: any,
})
