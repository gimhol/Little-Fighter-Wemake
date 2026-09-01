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
export const frame_model_fields = fields<IFrameModel>({
  id: str('模型ID'),
  pose: obj('姿态', { nullable: true, fields: frame_model_pose_fields }),
  anim: str('动画片段', { nullable: true }),
  loop: bool('循环', { nullable: true }),
  time_scale: flt('速度倍率', { nullable: true }),
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
  },
});
