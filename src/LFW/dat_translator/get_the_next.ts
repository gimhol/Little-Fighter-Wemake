import { FrameId, Defines, FacingFlag, type INextFrame } from "../defines";
import { cook_next_frame_cost as cook_next_frame_cost } from "./cook_next_frame_cost";

export const get_next_frame_by_raw_id = (
  id: number | string,
  zero_as: "frame" | "repeat",
  type?: "next" | "hit",
  frame_mp_hp_map?: Map<string, { mp: number, hp: number }>,
): INextFrame => {
  if ("" + id === "1000") return Defines.NEXT_FRAME_GONE;
  if ("" + id === "999") return Defines.NEXT_FRAME_AUTO;
  if ("" + id === "-999")
    return Defines.NEXT_FRAME_AUTO_BACKWARD;

  if ("" + id === "0") {
    if (zero_as == 'frame') // for opoint...
      return { id: "" + id };
    else
      return {};
  }

  if (typeof id === "number") {
    if (id >= 1100 && id <= 1299) {
      // 外部需要处理隐身逻辑。
      return Defines.NEXT_FRAME_AUTO;
    }
    if (id <= -1100 && id >= -1299) {
      // 外部需要处理隐身逻辑。
      return Defines.NEXT_FRAME_AUTO_BACKWARD;
    }
    if (id < 0) {
      const ret: INextFrame = {
        id: "" + -id,
        facing: FacingFlag.Backward,
      };
      cook_next_frame_cost(ret, type, frame_mp_hp_map);
      return ret;
    }
  }
  if (typeof id === "string" && id.startsWith("-")) {
    const ret: INextFrame = {
      id: id.substring(1),
      facing: FacingFlag.Backward,
    };
    cook_next_frame_cost(ret, type, frame_mp_hp_map);
    return ret;
  }
  const ret: INextFrame = { id: "" + id };
  cook_next_frame_cost(ret, type, frame_mp_hp_map);
  return ret;
};
