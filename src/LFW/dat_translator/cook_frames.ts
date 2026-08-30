import {
  FacingFlag,
  type IBdyInfo,
  type IBpointInfo,
  type ICpoint,
  type IFramePic,
  type IItrInfo,
  type IOpointInfo,
  ItrKind,
  type IWpointInfo,
  StateEnum
} from "../defines";
import type { IDatContext } from "../defines/IDatContext";
import type { IFrameInfo } from "../defines/IFrameInfo";
import type { ILegacyPictureInfo } from "../defines/ILegacyPictureInfo";
import { SpeedCtrl } from "../defines/SpeedCtrl";
import { SpeedMode } from "../defines/SpeedMode";
import { round_float } from "../utils";
import { abs, floor } from "../utils/math/base";
import { match_all } from "../utils/string_parser/match_all";
import { match_colon_value } from "../utils/string_parser/match_colon_value";
import { take_sections } from "../utils/string_parser/take_sections";
import { to_num } from "../utils/type_cast/to_num";
import { not_zero_num } from "../utils/type_check";
import { cook_bdy } from "./cook_bdy";
import { cook_bpoint } from "./cook_bpoint";
import { cook_cpoint } from "./cook_cpoint";
import { cook_itr } from "./cook_itr";
import { cook_opoint } from "./cook_opoint";
import { cook_wpoint } from "./cook_wpoint";
import { add_next_frame } from "./edit_next_frame";
import { get_next_frame_by_raw_id } from "./get_the_next";
import { make_frame_state } from "./make_frame_state";
import { take } from "./take";

export function cook_frames(ctx: IDatContext): Record<string, IFrameInfo> {
  const { text, base: { files = {} } } = ctx
  const frames: Record<string, IFrameInfo> = {};
  const frame_regexp = /<frame>\s+(.*?)\s+(.*)((.|\n)+?)<frame_end>/g;
  for (const [, frame_id, frame_name, content] of match_all(
    text,
    frame_regexp,
  )) {
    let _content = content;
    const r1 = take_sections<IBdyInfo>(_content, "bdy:", "bdy_end:");
    const bdy_list = r1.sections;
    _content = r1.remains;

    const r2 = take_sections<IItrInfo>(_content, "itr:", "itr_end:");
    const itr_list = r2.sections;
    _content = r2.remains;

    const r3 = take_sections<IOpointInfo>(_content, "opoint:", "opoint_end:");
    const opoint_list = r3.sections;
    _content = r3.remains;

    const r4 = take_sections<IWpointInfo>(_content, "wpoint:", "wpoint_end:");
    const wpoint_list = r4.sections;
    _content = r4.remains;

    const r5 = take_sections<IBpointInfo>(_content, "bpoint:", "bpoint_end:");
    const bpoint_list = r5.sections;
    _content = r5.remains;

    const r6 = take_sections<ICpoint>(_content, "cpoint:", "cpoint_end:");
    const cpoint_list = r6.sections;
    _content = r6.remains;

    const fields: any = {};
    for (const [name, value] of match_colon_value(_content))
      fields[name] = to_num(value) ?? value;

    const raw_next = take(fields, "next");
    const next = get_next_frame_by_raw_id(raw_next, 'repeat');
    const pic_idx = take(fields, "pic");
    let frame_pic_info: IFramePic | undefined = void 0;
    let entity_pic_info: ILegacyPictureInfo | undefined = void 0;

    let pic = pic_idx;
    for (const key in files) {
      const { row, col } = (entity_pic_info = files[key] as ILegacyPictureInfo);
      if (pic < row * col) break;
      pic -= row * col;
    }

    let error: any;
    if (entity_pic_info) {
      const { id, row, cell_w, cell_h } = entity_pic_info;
      frame_pic_info = {
        tex: id,
        x: (cell_w + 1) * (pic % row),
        y: (cell_h + 1) * floor(pic / row),
        w: cell_w,
        h: cell_h,
      };
    } else {
      error = {
        msg: "entity_pic_info not found!",
        files,
        pic_idx,
      };
    }

    const wait = take(fields, "wait") * 2 + 1;
    const frame: IFrameInfo = {
      id: frame_id,
      name: frame_name,
      pic: frame_pic_info,
      wait,
      next,
      width: frame_pic_info?.w ?? 0,
      height: frame_pic_info?.h ?? 0,
      ...fields,
    };

    for (const bdy of bdy_list) cook_bdy(bdy, frame);
    for (const itr of itr_list) cook_itr(itr, frame);
    for (const bpoint of bpoint_list) cook_bpoint(bpoint, frame);
    for (const opoint of opoint_list) cook_opoint(opoint, frame);
    for (const wpoint of wpoint_list) cook_wpoint(wpoint, frame);
    for (const cpoint of cpoint_list) cook_cpoint(cpoint, frame);

    if (itr_list.length) frame.itr = itr_list
    if (bdy_list.length) frame.bdy = bdy_list
    if (opoint_list.length) frame.opoint = opoint_list
    if (wpoint_list.length) frame.wpoint = wpoint_list[0]
    if (cpoint_list.length) frame.cpoint = cpoint_list[0]
    if (bpoint_list.length) frame.bpoint = bpoint_list[0]

    const state_name = StateEnum[frame.state!]
    if (state_name) (frame as any).state_name = `StateEnum.${state_name}`

    if (error) (frame as any).__ERROR__ = error;
    if (
      (raw_next >= 1100 && raw_next <= 1299) ||
      (raw_next <= -1100 && raw_next >= -1299)
    ) {
      frame.invisible = 2 * (abs(raw_next) - 1100);
    }

    if (!frame.itr?.length) delete frame.itr;
    if (!frame.bdy?.length) delete frame.bdy;
    if (!frame.opoint?.length) delete frame.opoint;
    if (!frame.wpoint) delete frame.wpoint;
    if (!frame.bpoint) delete frame.bpoint;
    if (!frame.cpoint) delete frame.cpoint;

    const sound = take(frame, "sound");
    if (typeof sound === 'string') frame.sound = sound.replace(/\\/g, '/') + ".mp3";
    frames[frame_id] = frame;

    const dircontrol = take(cpoint_list[0], "dircontrol");
    if (dircontrol) {
      frame.hit = frame.hit || {};
      if (dircontrol === 1) {
        frame.hit.B = add_next_frame(frame.hit.B, {
          wait: "i",
          facing: FacingFlag.Backward,
        });
      } else {
        frame.hit.F = add_next_frame(frame.hit.F, {
          wait: "i",
          facing: FacingFlag.Backward,
        });
      }
    }




    const vx = take(frame, "dvx");
    const vy = take(frame, "dvy");
    const vz = take(frame, "dvz");
    const [vxm, dvx, ctrl_x] = cook_dvxyz(vx)
    const [vym, dvy, ctrl_y] = cook_dvxyz(vy)
    const [vzm, dvz, ctrl_z] = cook_dvxyz(vz)

    if (vxm !== void 0) frame.vxm = vxm;
    if (dvx !== void 0) frame.dvx = dvx;
    if (ctrl_x !== void 0) frame.ctrl_x = ctrl_x;

    if (vy === 550) frame.gravity_enabled = false;
    if (vym !== void 0) frame.vym = vym;
    if (dvy !== void 0) frame.dvy = dvy;
    if (ctrl_y !== void 0) frame.ctrl_y = ctrl_y;

    if (vzm !== void 0) frame.vzm = vzm;
    if (dvz !== void 0) frame.dvz = dvz;
    if (ctrl_z !== void 0) frame.ctrl_z = ctrl_z;
    else if (not_zero_num(vz)) frame.ctrl_z = 1;

    if (frame.itr) {
      for (const itr of frame.itr) {
        if (
          itr.kind === ItrKind.SuperPunchMe &&
          (!itr.vrest || itr.vrest < frame.wait)
        ) {
          itr.vrest = frame.wait;
        }
      }
    }
    make_frame_state(frame);
  }
  return frames;
}

function cook_dvxyz(v: any): [SpeedMode?, number?, SpeedCtrl?] {
  if (!not_zero_num(v)) return [void 0, void 0]
  if (v === 550) return [SpeedMode.Fixed, 0, SpeedCtrl.None] as const;
  return [void 0, round_float(v)] as const;
}
