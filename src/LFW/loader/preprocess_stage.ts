import { delete_undefined } from "../dat_translator";
import { stage_info_fields, type IStageInfo } from "../defines";
import { reorder_keys } from "../fields";
import { preprocess_stage_phase } from "./preprocess_stage_phase";

export function preprocess_stage(v: IStageInfo): IStageInfo {
  if (Array.isArray(v.phases)) {
    for (let i = 0; i < v.phases.length; i++) {
      v.phases[i] = preprocess_stage_phase(v.phases[i]);
    }
  }
  delete_undefined(v);
  reorder_keys(v, stage_info_fields);
  return v;
}
preprocess_stage.TAG = "preprocess_stage"