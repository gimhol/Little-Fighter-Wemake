import type { IEntityData, IFrameInfo } from "../defines";
import { Schema_IFrameInfo } from "../defines";
import { SchemaValidator } from "../utils/schema/validate_schema";

/**
 * 检查frame每个字段是否正常
 *
 * @export
 * @param {Readonly<IEntityData>} data
 * @param {Readonly<IFrameInfo>} frame
 */
export function check_frame(data: Readonly<IEntityData>, frame: Readonly<IFrameInfo>, errors?: string[]): boolean {
  const my_errors: string[] = []
  const frame_name = `${data.base.name}#frame`
  const v = new SchemaValidator();
  v.validate(frame, Schema_IFrameInfo);
  my_errors.push(...v.errors);
  // TODO: hold
  // TODO: hit
  // TODO: wpoint
  // TODO: bpoint
  // TODO: opoint
  // TODO: cpoint
  // TODO: indicator_info
  // TODO: on_dead
  // TODO: on_exhaustion
  // TODO: on_landing
  // TODO: behavior
  // TODO: on_hit_ground

  if (errors) errors.push(...my_errors)
  return !my_errors.length
}
check_frame.TAG = 'check_frame'
