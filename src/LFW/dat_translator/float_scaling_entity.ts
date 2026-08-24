import type { IEntityData } from "../defines";
import { floor, is_num, round_float, traversal } from "../utils";
import { float_scaling_bdy } from "./float_scaling_bdy";
import { float_scaling_itr } from "./float_scaling_itr";

export function float_scaling_entity(ret: IEntityData) {
  traversal(ret.bdy_prefabs, (_, v) => {
    if (v) float_scaling_bdy(v);
  });
  traversal(ret.itr_prefabs, (k, v) => {
    if (v) float_scaling_itr(v);
  });
  traversal(ret.frames, (_, v) => {
    if (!v) return;
    if (v.dvx) v.dvx = round_float(v.dvx)
    if (v.dvy) v.dvy = round_float(v.dvy)
    if (v.dvz) v.dvz = round_float(v.dvz)
    if (v.acc_x) v.acc_x = round_float(v.acc_x)
    if (v.acc_y) v.acc_y = round_float(v.acc_y)
    if (v.acc_z) v.acc_z = round_float(v.acc_z)
    if (v.ctrl_x) v.ctrl_x = round_float(v.ctrl_x)
    if (v.ctrl_y) v.ctrl_y = round_float(v.ctrl_y)
    if (v.ctrl_z) v.ctrl_z = round_float(v.ctrl_z)
    if (v.dataset?.friction_x) v.dataset.friction_x = round_float(v.dataset.friction_x)
    if (v.dataset?.friction_z) v.dataset.friction_z = round_float(v.dataset.friction_z)
    if (v.dataset?.gravity) v.dataset.gravity = round_float(v.dataset.gravity)


    v.itr?.forEach(itr => float_scaling_itr(itr));
    v.bdy?.forEach(itr => float_scaling_bdy(itr));
    const cp = v.cpoint;
    if (cp) {
      ([
        'throwvx', 'throwvy', 'throwvz',
      ] as const).forEach(k => {
        if (is_num(cp[k])) cp[k] = floor(10000 * cp[k]);
      });
    }
    const wp = v.wpoint;
    if (wp) {
      ([
        'dvx', 'dvy', 'dvz',
      ] as const).forEach(k => {
        if (is_num(wp[k])) wp[k] = floor(10000 * wp[k]);
      });
    }
    v.opoint?.forEach((op) => {
      ([
        'dvx', 'dvy', 'dvz', 'speedz',
      ] as const).forEach(k => {
        if (is_num(op[k])) op[k] = floor(10000 * op[k]);
      });
    });
  });

  ([
    'jump_height', 'jump_distance', 'jump_distancez', 'dash_height',
    'dash_distance', 'dash_distancez', 'rowing_height', 'rowing_distance',
    'weight'
  ] as const).forEach(k => {
    if (is_num(ret.base[k])) ret.base[k] = floor(10000 * ret.base[k]);
  });

  ret.base.brokens?.forEach((op) => {
    ([
      'dvx', 'dvy', 'dvz', 'speedz',
    ] as const).forEach(k => {
      if (is_num(op[k])) op[k] = floor(10000 * op[k]);
    });
  });
  traversal(ret.base.bot?.actions, (_, v) => {
    if (!v) return;
    v.e_ray?.forEach((v) => {
      ([
        'x', 'z', 'min_x', 'max_x', 'min_z', 'max_z', 'max_d'
      ] as const).forEach(k => {
        if (is_num(v[k])) v[k] = floor(10000 * v[k]);
      });
    });
  });
  return ret;
}
