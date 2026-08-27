import { LFW } from '../LFW';
import { type IOpointInfo, OpointSpreading } from "../defines";
import { Randoming } from "../helper";

export function preprocess_opoint(opoint: IOpointInfo, lfw: LFW): IOpointInfo {
  if (opoint.spreading == OpointSpreading.Spreading) {
    if (opoint.spreading_x?.length) opoint.__spreading_random_x = new Randoming(opoint.spreading_x as [number, ...number[]], lfw.mt)
    if (opoint.spreading_y?.length) opoint.__spreading_random_y = new Randoming(opoint.spreading_y as [number, ...number[]], lfw.mt)
    if (opoint.spreading_z?.length) opoint.__spreading_random_z = new Randoming(opoint.spreading_z as [number, ...number[]], lfw.mt)
  } else if (opoint.spreading == OpointSpreading.FloatRange) {
    const { spreading_x: xx, spreading_y: yy, spreading_z: zz } = opoint;
    if (xx?.length == 3)
      opoint.__spreading_random_x = {
        get: () => {
          lfw.mt.mark = 'osrx'
          return lfw.mt.range(xx[0], xx[1]) / xx[2]
        }
      };
    if (yy?.length == 3)
      opoint.__spreading_random_y = {
        get: () => {
          lfw.mt.mark = 'osry'
          return lfw.mt.range(yy[0], yy[1]) / yy[2]
        }
      };
    if (zz?.length == 3)
      opoint.__spreading_random_z = {
        get: () => {
          lfw.mt.mark = 'osrz'
          return lfw.mt.range(zz[0], zz[1]) / zz[2]
        }
      };
  }
  return opoint
}
preprocess_opoint.TAG = "preprocess_opoint";