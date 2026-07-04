import type { IFrameInfo } from "../defines/IFrameInfo";
import type { IQube } from "../defines/IQube";

export function cook_frame_indicator_info(frame: IFrameInfo) {
  const { pic, bdy, itr, opoint, cpoint, bpoint, wpoint } = frame;
  if (!pic || !("w" in pic)) return;
  const f_qube_1: IQube = {
    x: -frame.centerx,
    y: frame.centery - pic.h,
    w: pic.w,
    h: pic.h,
    z: 0,
    l: 0,
  };
  const f_qube_2: IQube = {
    ...f_qube_1,
    x: frame.centerx - f_qube_1.w,
  };
  frame.__indicator_info = {
    1: f_qube_1,
    [-1]: f_qube_2,
  };

  opoint?.forEach((o) => {
    const w = 2;
    const h = 2;
    const rect_1: IQube = {
      w,
      h,
      x: f_qube_1.x + o.x - w / 2,
      y: f_qube_1.y + f_qube_1.h - o.y - h / 2,
      z: o.z || 0,
      l: 0,
    };
    const rect_2: IQube = {
      ...rect_1,
      x: f_qube_2.x + f_qube_1.w - w - o.x,
    };
    o.indicator_info = { 1: rect_1, [-1]: rect_2 };
  });
  if (cpoint) {
    const { x: ox = 0, y: oy = 0, z: oz = 0 } = cpoint;
    const w = 2;
    const h = 2;
    const rect_1: IQube = {
      w,
      h,
      x: f_qube_1.x + ox - w / 2,
      y: f_qube_1.y + f_qube_1.h - oy - h / 2,
      z: oz || 0,
      l: 0,
    };
    const rect_2: IQube = {
      ...rect_1,
      x: f_qube_2.x + f_qube_1.w - w - ox,
    };
    cpoint.indicator_info = { 1: rect_1, [-1]: rect_2 };
  }
  if (bpoint) {
    const o = bpoint;
    const w = 2;
    const h = 2;
    const rect_1: IQube = {
      w,
      h,
      x: f_qube_1.x + o.x - w / 2,
      y: f_qube_1.y + f_qube_1.h - o.y - h / 2,
      z: o.z || 0,
      l: 0,
    };
    const rect_2: IQube = {
      ...rect_1,
      x: f_qube_2.x + f_qube_1.w - w - o.x,
    };
    o.indicator_info = { 1: rect_1, [-1]: rect_2 };
  }
  if (wpoint) {
    const o = wpoint;
    const w = 2;
    const h = 2;
    const rect_1: IQube = {
      w, h,
      x: f_qube_1.x + o.x - w / 2,
      y: f_qube_1.y + f_qube_1.h - o.y - h / 2,
      z: o.z || 0,
      l: 0,
    };
    const rect_2: IQube = {
      ...rect_1,
      x: f_qube_2.x + f_qube_1.w - w - o.x,
    };
    o.indicator_info = { 1: rect_1, [-1]: rect_2 };
  }
  bdy?.forEach((o) => {
    const { x = 0, y = 0, w = 0, h = 0, z = 0, l = 0 } = o
    const rect_1: IQube = {
      w, h, z, l,
      x: f_qube_1.x + x,
      y: f_qube_1.y + f_qube_1.h - y - h,
    };
    const rect_2: IQube = {
      ...rect_1,
      x: f_qube_2.x + f_qube_1.w - w - x,
    };
    o.__indicator_info = { 1: rect_1, [-1]: rect_2 };
  });
  itr?.forEach((o) => {
    const { x = 0, y = 0, w = 0, h = 0, z = 0, l = 0 } = o
    const rect_1: IQube = {
      w, h, z, l,
      x: f_qube_1.x + x,
      y: f_qube_1.y + f_qube_1.h - y - h,
    };
    const rect_2: IQube = {
      ...rect_1,
      x: f_qube_2.x + f_qube_1.w - w - x,
    };
    o.indicator_info = { 1: rect_1, [-1]: rect_2 };
  });
}
