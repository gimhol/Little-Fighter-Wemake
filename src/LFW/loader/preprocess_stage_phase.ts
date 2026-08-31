import { Expression } from "../base";
import { delete_undefined } from "../dat_translator";
import { stage_phase_info_fields, type IStagePhaseInfo } from "../defines";
import { reorder_fields } from "../fields";
import { get_val_getter_from_stage } from "./get_val_getter_from_stage";

export function preprocess_stage_phase(v: IStagePhaseInfo): IStagePhaseInfo {
  v.__end_testers = v.end_test?.map(v => new Expression(v, get_val_getter_from_stage))
  if (v.dialogs)
    for (const d of v.dialogs)
      d.__end_testers = d.end_test?.map(v => new Expression(v, get_val_getter_from_stage))
  delete_undefined(v);
  reorder_fields(v, stage_phase_info_fields)
  return v;
}
preprocess_stage_phase.TAG = 'preprocess_stage_phase'