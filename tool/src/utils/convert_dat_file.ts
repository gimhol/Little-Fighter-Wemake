import { BotMaker, make_bg_data, make_stage_info_list, obj_dat_to_json } from "../../../src/LFW/dat_translator";
import type { IBgData, IDataLists, IEntityData, IStageInfo } from "../../../src/LFW/defines";
import { DatTypeEnum } from "../../../src/LFW/defines";
import { is_file } from "./is_file";
import { debug, error, info } from "./log";
import { read_lf2_dat_file } from "./read_lf2_dat_file";
import { write_obj_file } from "./write_obj_file";
export type IRet = IEntityData | IBgData | IStageInfo[]
export interface IPreGeneratedFile {
  path: string;
  suffix: string;
}
export const PRE_GENERATED_SUFFIXES = ['json5', 'json', 'xml'] as const;

export interface IConvertDatContext {
  out_dir: string;
  src_path: string;
  dst_path: string;
  indexes: IDataLists;
}
export async function convert_dat_file(
  ctx: IConvertDatContext,
): Promise<IRet> {
  let { out_dir, src_path, dst_path, indexes } = ctx;
  debug(`convert_dat_file(
  out_dir = ${JSON.stringify(out_dir)},
  src_path = ${JSON.stringify(src_path)}, 
  dst_path = ${JSON.stringify(dst_path)}, 
  indexes = ${indexes}, 
)`)
  dst_path = dst_path.replace(/\\/g, '/');
  out_dir = out_dir.replace(/\\/g, '/');
  const index_file_value = dst_path.replace(out_dir + "/", "");
  let index_info = indexes.objects.find((v) => index_file_value === v.file.replace(/\\/g, '/'))
  if (index_info) {
    const txt = await read_lf2_dat_file(src_path);
    const ret = obj_dat_to_json(txt, index_info);
    await write_obj_bot_file(indexes, ret.id, dst_path, out_dir);
    info(src_path, "=>\n    " + dst_path);
    await write_obj_file(dst_path, ret);
    return ret;
  }

  index_info = indexes.backgrounds.find((v) => index_file_value === v.file.replace(/\\/g, '/'))
  if (index_info) {
    const txt = await read_lf2_dat_file(src_path);
    const ret = make_bg_data(txt, index_info);
    info(src_path, "=>\n    " + dst_path);
    await write_obj_file(dst_path, ret);
    return ret;
  }

  index_info = indexes.stages.find((v) => index_file_value === v.file.replace(/\\/g, '/'));
  if (index_info) {
    const txt = await read_lf2_dat_file(src_path);
    const ret = make_stage_info_list(txt);
    info(src_path, "=>\n    " + dst_path);
    await write_obj_file(dst_path, ret);
    return ret;
  }

  const message = `Convert failed, ${[
    src_path,
    "If this file is not used, please remove it.",
    'Otherwise, please add it to data.txt.'
  ].join('\n    ')}`
  error(message);
  throw new Error(message);
}

export async function write_obj_bot_file(
  indexes: IDataLists,
  obj_id: string,
  dst_path: string,
  out_dir: string,
): Promise<void> {
  const bot_data = BotMaker.makers.get(obj_id)?.().bot
  if (!bot_data) return;
  const ext = dst_path.endsWith('.xml') ? 'xml' : dst_path.endsWith('.json') ? 'json' : 'json5';
  const bot_dst_path = dst_path.replace(/(.*)\/(.*?)\.obj\.(?:json5|json|xml)$/, `$1/bots/${obj_id}.bot.${ext}`)
  indexes.bots.push({ id: bot_data.id, type: DatTypeEnum.Bot, file: bot_dst_path.replace(out_dir + "/", "") });
  await write_obj_file(bot_dst_path, bot_data);
}
convert_dat_file.get_dst_path = function (
  out_dir: string,
  src_dir: string,
  src_path: string,
  type: 'bg' | 'obj' | 'stage',
  suffix: string = 'json5',
): string {
  const s_type = type ? `.${type}` : ''
  return src_path.replace(src_dir, out_dir).replace(/\\/g, '/').replace(/\.dat$/, `${s_type}.${suffix}`);
}

export function get_pre_generated_paths(
  src_dir: string,
  src_path: string,
  type: 'bg' | 'obj' | 'stage',
  preferred_suffix?: string,
): IPreGeneratedFile[] {
  const suffixes: string[] = [];
  if (preferred_suffix) suffixes.push(preferred_suffix);
  for (const suffix of PRE_GENERATED_SUFFIXES) {
    if (!suffixes.includes(suffix)) suffixes.push(suffix);
  }
  return suffixes.map((suffix) => ({
    path: convert_dat_file.get_dst_path(src_dir, src_dir, src_path, type, suffix),
    suffix,
  }));
}

export async function find_pre_generated_file(
  src_dir: string,
  src_path: string,
  type: 'bg' | 'obj' | 'stage',
  preferred_suffix?: string,
): Promise<IPreGeneratedFile | undefined> {
  for (const candidate of get_pre_generated_paths(src_dir, src_path, type, preferred_suffix)) {
    if (await is_file(candidate.path)) return candidate;
  }
  return void 0;
}