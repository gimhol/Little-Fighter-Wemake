import { LFW } from '../LFW';
import { type IOpointInfo, OpointSpreading } from "../defines";
import { Randoming } from "../helper";

const osr_name = (a: number) => (b: string) => `osr_${a}_${b}`
export function preprocess_opoint(opoint: IOpointInfo, lfw: LFW): IOpointInfo {
  const sp = opoint.spreading;
  if (sp == OpointSpreading.Spreading) {
    const spn = osr_name(sp);
    if (opoint.spreading_x?.length)
      opoint.__spreading_random_x = new Randoming(spn('x'), opoint.spreading_x as [number, ...number[]], lfw.mt)
    if (opoint.spreading_y?.length)
      opoint.__spreading_random_y = new Randoming(spn('y'), opoint.spreading_y as [number, ...number[]], lfw.mt)
    if (opoint.spreading_z?.length)
      opoint.__spreading_random_z = new Randoming(spn('z'), opoint.spreading_z as [number, ...number[]], lfw.mt)
  } else if (sp == OpointSpreading.FloatRange) {
    const spn = osr_name(sp);
    const { spreading_x: xx, spreading_y: yy, spreading_z: zz } = opoint;
    if (xx?.length == 3)
      opoint.__spreading_random_x = {
        get: () => {
          lfw.mt.mark = spn('x')
          return lfw.mt.range(xx[0], xx[1]) / xx[2]
        }
      };
    if (yy?.length == 3)
      opoint.__spreading_random_y = {
        get: () => {
          lfw.mt.mark = spn('y')
          return lfw.mt.range(yy[0], yy[1]) / yy[2]
        }
      };
    if (zz?.length == 3)
      opoint.__spreading_random_z = {
        get: () => {
          lfw.mt.mark = spn('z')
          return lfw.mt.range(zz[0], zz[1]) / zz[2]
        }
      };
  }
  return opoint
}
preprocess_opoint.TAG = "preprocess_opoint";