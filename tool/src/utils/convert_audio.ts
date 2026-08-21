import fs from "fs/promises";
import { _conf, conf } from "../conf";
import { whoami } from "../show_main_usage";
import { exec_cmd } from "./exec_cmd";
import { find_real_cmd } from "./find_real_cmd";
import { info, warn } from "./log";

export let is_ffmpeg_tried = false;
function get_dst_path(
  out_dir: string,
  src_dir: string,
  src_path: string,
): string {
  return src_path.replace(src_dir, out_dir) + ".mp3";
}

export function print_ffmpeg_hints() {
  const { FFMPEG_CMD, FFMPEG_OPTS } = _conf ?? {};
  if (!is_ffmpeg_tried || FFMPEG_CMD && find_real_cmd(FFMPEG_CMD)) return;
  const hints = `
================== ffmpeg not found ==================
FFMPEG_OPTS = '${FFMPEG_OPTS}'
FFMPEG_CMD = '${FFMPEG_CMD}'

All audio files will not be converted to MP3. 

However, you can convert them to MP3 in your own way.

Then you need to put it into output zip file yourself.

To download ffmpeg: https://ffmpeg.org/download.html

'${whoami}' currently only supports MP3.

`.trim()
  console.log('\n')
  warn(hints)
}
export async function convert_audio(dst_path: string, src_path: string) {
  is_ffmpeg_tried = true;
  const { FFMPEG_CMD, FFMPEG_OPTS } = conf();
  if (!FFMPEG_CMD) return;
  const real_cmd = find_real_cmd(FFMPEG_CMD);
  if (!real_cmd) return; // ffmpeg 缺失时跳过转换（与图片转换行为一致），避免 spawn('') 崩溃
  info("Convert audio", src_path, "=>\n    " + dst_path);
  await fs.rm(dst_path, { recursive: true, force: true }).catch(() => void 0);
  const args = [
    "-i",
    src_path,
    ...FFMPEG_OPTS!
      .split(' ')
      .filter(Boolean),
    dst_path,
  ];
  return await exec_cmd(real_cmd, ...args);
}

convert_audio.get_dst_path = get_dst_path;
