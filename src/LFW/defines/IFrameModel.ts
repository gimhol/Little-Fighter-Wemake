import { bool, fields, flt, obj, str } from "../fields";
import { make_schema } from "../utils/schema/make_schema";

/**
 * 帧的 3D 模型视觉
 *
 * 模式 A：帧 = 3D 姿态关键帧
 *   - pose: 骨骼姿态（相邻帧 pose 之间做插值）
 *
 * 模式 B：帧 = 动画片段触发器
 *   - anim: glTF 动画片段名
 *
 * 帧存在 model 时优先用模型渲染，否则回退到 pic/pics（2D 精灵）
 *
 * @export
 * @interface IFrameModel
 */
export interface IFrameModelPose {
  /** 骨骼名（可选，缺省时按骨骼遍历顺序应用） */
  bones?: string[];
  /** 每个骨骼的 position，展平为 x,y,z 序列 */
  pos?: number[];
  /** 每个骨骼的 rotation(四元数)，展平为 x,y,z,w 序列 */
  rot?: number[];
  /** 每个骨骼的 scale，展平为 x,y,z 序列 */
  scl?: number[];
}
export interface IFrameModel {
  /** base.models 里的模型 ID */
  id: string;
  /** 模式 A：骨骼姿态（可选，缺省则用动画片段） */
  pose?: IFrameModelPose;
  /** 模式 B：glTF 动画片段名 */
  anim?: string;
  /** 动画是否循环 */
  loop?: boolean;
  /** 动画速度倍率（配合 wait 控制节奏） */
  time_scale?: number;
  /** 整模型绕 Z 轴旋转角（弧度，缺省 0），类似 2D pic 的 rad */
  rad?: number;
  /** 帧级缩放系数（x,y,z，缺省 1）；与 base 模型 scale 同时存在时逐轴相乘 */
  scale?: { x?: number; y?: number; z?: number };
  /** 帧级平移偏移（x,y,z，缺省 0）；与 base 模型 offset 逐轴相加 */
  offset?: { x?: number; y?: number; z?: number };
}
export function frame_model_new(): IFrameModel {
  return { id: "" }
}
const frame_model_pose_fields = fields<IFrameModelPose>({
  bones: str('骨骼名', { array: true }),
  pos: flt('位置', { array: true }),
  rot: flt('旋转(四元数)', { array: true }),
  scl: flt('缩放', { array: true }),
});
const vec3_scale_fields = fields<{ x?: number; y?: number; z?: number }>({
  x: flt('X'),
  y: flt('Y'),
  z: flt('Z'),
});
const vec3_offset_fields = fields<{ x?: number; y?: number; z?: number }>({
  x: flt('X'),
  y: flt('Y'),
  z: flt('Z'),
});
export const frame_model_fields = fields<IFrameModel>({
  id: str('模型ID'),
  pose: obj('姿态', { nullable: true, fields: frame_model_pose_fields }),
  anim: str('动画片段', { nullable: true }),
  loop: bool('循环', { nullable: true }),
  time_scale: flt('速度倍率', { nullable: true }),
  rad: flt('Z轴旋转(弧度)', { nullable: true }),
  scale: obj('缩放', { nullable: true, fields: vec3_scale_fields }),
  offset: obj('偏移', { nullable: true, fields: vec3_offset_fields }),
});

export const Schema_IFrameModel = make_schema<IFrameModel>({
  key: 'IFrameModel',
  type: 'object',
  properties: {
    id: { type: "string", description: "模型ID" },
    pose: { type: "object", nullable: true, description: "骨骼姿态" },
    anim: { type: "string", nullable: true, description: "动画片段名" },
    loop: { type: "boolean", nullable: true, description: "是否循环" },
    time_scale: { type: "number", nullable: true, description: "速度倍率" },
    rad: { type: "number", nullable: true, description: "Z轴旋转(弧度)" },
    scale: {
      type: "object", nullable: true, description: "缩放系数(x,y,z)",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        z: { type: "number" },
      },
    },
    offset: {
      type: "object", nullable: true, description: "平移偏移(x,y,z)",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        z: { type: "number" },
      },
    },
  },
});
