import { OID, type IOpointInfo } from "../defines";
import { is_entity } from "../entity";
import { Randoming } from "../helper";
import { round } from "../utils";
const dvx_arr = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
const dvy_arr = [1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5];

let randoming_dvx: Randoming<number> | null = null;
let randoming_dvy: Randoming<number> | null = null;

export function spawn_ice_piece(id: string): IOpointInfo {
  const ret: IOpointInfo = {
    kind: 0,
    x: 0,
    y: 0,
    oid: OID.BrokenWeapon,
    action: { id },
    dvx: 0,
    dvy: 0,
    is_entity: false,
    speedz: 0,
    unimportant: 1,
    __gen_dvx: {
      get: (e: unknown) => {
        if (!is_entity(e)) return 0;
        if (!randoming_dvx || randoming_dvx.mt !== e.lfw.mt)
          randoming_dvx = new Randoming(dvx_arr, e.lfw.mt)
        return randoming_dvx.get();
      }
    },
    __gen_dvy: {
      get: (e: unknown) => {
        if (!is_entity(e)) return 0;
        if (!randoming_dvy || randoming_dvy.mt !== e.lfw.mt)
          randoming_dvy = new Randoming(dvy_arr, e.lfw.mt)
        return randoming_dvy.get();
      }
    },
    __gen_x: {
      get: (e: unknown) => {
        if (!is_entity(e)) return 0;
        const { frame, lfw: { mt } } = e;
        const { width: w } = frame;
        const r = w / 4;
        return round(w / 2 + mt.range(-r, r))
      }
    },
    __gen_y: {
      get: (e: unknown) => {
        if (!is_entity(e)) return 0;
        const { frame, lfw: { mt } } = e;
        const { height: h } = frame;
        const r = h / 4;
        return round(h / 2 + mt.range(-r, r))
      }
    }
  }
  return ret;
}
export const ice_piece_opoints = [
  spawn_ice_piece("130"),
  spawn_ice_piece("130"),
  spawn_ice_piece("130"),
  spawn_ice_piece("120"),
  spawn_ice_piece("120"),
  spawn_ice_piece("125"),
  spawn_ice_piece("125"),
  spawn_ice_piece("125"),
  spawn_ice_piece("125"),
  spawn_ice_piece("135"),
  spawn_ice_piece("135"),
  spawn_ice_piece("135"),
  spawn_ice_piece("135"),
  spawn_ice_piece("135"),
  spawn_ice_piece("135"),
  spawn_ice_piece("135"),
]