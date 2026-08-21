import { warn } from "console";
import { R_OK } from "constants";
import { accessSync, mkdirSync, writeFileSync } from "fs";
import { parase_indexes } from "../../../src/LFW/dat_translator/parase_indexes";
import type { IDataLists, ITempDataLists } from "../../../src/LFW/defines/IDataLists";
import { DatTypeEnum } from "../../../src/LFW/defines/IDatIndex";
import { conf } from "../conf";
import { is_file } from "./is_file";
import { debug, info } from "./log";
import { read_text_file } from "./read_text_file";
import { write_obj_file } from "./write_obj_file";

export async function convert_data_txt(src_dir: string, out_dir: string, index_file: string): Promise<ITempDataLists> {
  debug(`convert_data_txt(
  src_dir = ${JSON.stringify(src_dir)},
  out_dir = ${JSON.stringify(out_dir)}, 
)`)
  const suffix = conf().OUT_TYPE ?? 'json5'
  try {
    accessSync(index_file, R_OK)
  } catch (e) {
    const message = [
      `data.txt not found, path:`,
      `"${index_file}"\n`,
      "Will try to create it for you, please edit it and retry again."
    ].join('\n    ')
    warn(message)
    try { mkdirSync(`${src_dir}/data`, { recursive: true }) } catch (e) { }
    writeFileSync(index_file, `
[NOT_READY] Please remove this line after the editing or LF2W-TOOL will not use this file.
<object>
<object_end>
<background>
<background_end>
`.trim())
    throw new Error(message);
  }
  const stage_path = `${src_dir}/data/stage.dat`;
  const dst_path = `${out_dir}/data/data.index.${suffix}`;
  info("Convert", index_file, "=>\n    " + dst_path);

  const text = await read_text_file(index_file);
  debug(`[parse_indexes] text:\n`, text)
  const indexes = parase_indexes(text, suffix as 'json5' | 'json' | 'xml');
  if (!indexes.stages.length && await is_file(stage_path)) {
    indexes.stages = [{
      id: "default_stages",
      type: DatTypeEnum.Stage,
      file: `data/stage.stage.${suffix}`,
      src: "data/stage.dat"
    }]
  }
  await write_obj_file(dst_path, indexes);
  return indexes;
}
export async function write_index_file(indexes: IDataLists, out_dir: string) {
  const suffix = conf().OUT_TYPE ?? 'json5'
  const dst_path = `${out_dir}/data/data.index.${suffix}`;
  await write_obj_file(dst_path, indexes);
}