import type { IQubePair } from "./IQubePair";
import { WpointKind, WpointKindDescriptions } from "./WpointKind";
import { any, fields, flt, int, str } from "../fields";

export interface IWpointInfo {
  kind: number | WpointKind;
  x: number;
  y: number;
  z: number;
  weaponact: string;
  attacking?: string;
  dvx?: number;
  dvy?: number;
  dvz?: number;
  __indicator_info?: IQubePair;
}

const ALL_WPOINT_KIND = Object.values(WpointKind).filter(v => typeof v === 'number') as number[];

export function wpoint_info_new(): IWpointInfo {
  return {
    kind: WpointKind.None,
    x: 0,
    y: 0,
    z: 0,
    weaponact: "",
  };
}

export const wpoint_info_fields = fields<IWpointInfo>({
  kind: int("类型", {
    options: ALL_WPOINT_KIND.map(v => ({
      value: v,
      label: WpointKind[v],
      desc: (WpointKindDescriptions as Record<number, string>)[v] || "",
    })),
  }),
  x: int("X"),
  y: int("Y"),
  z: int("Z"),
  weaponact: str("武器动作"),
  attacking: str("攻击动作"),
  dvx: flt("初速度X"),
  dvy: flt("初速度Y"),
  dvz: flt("初速度Z"),
  __indicator_info: any,
})
