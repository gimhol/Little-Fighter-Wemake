import fs from "fs/promises";
import { _conf, conf } from "../conf";
import { whoami } from "../show_main_usage";
import { exec_cmd } from "./exec_cmd";
import { find_real_cmd } from "./find_real_cmd";
import { info, warn } from "./log";
import { tool_md5 } from "./tool_identity";

export let is_ffmpeg_tried = false;
let is_ffmpeg_logged = false;
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

/**
 * 解析 ffmpeg 命令。
 *
 * - `FFMPEG_CMD` 为空字符串：明确不使用 ffmpeg（跳过转换，保留旧行为）
 * - `FFMPEG_CMD` 有值但找不到：直接报错中止（避免静默产出没有音频的数据包）
 */
export function resolve_ffmpeg(): string {
  is_ffmpeg_tried = true;
  const { FFMPEG_CMD } = conf();
  if (!FFMPEG_CMD) return "";
  const real_cmd = find_real_cmd(FFMPEG_CMD);
  if (!real_cmd) {
    print_ffmpeg_hints();
    throw new Error(
      `找不到音频转换命令：FFMPEG_CMD = '${FFMPEG_CMD}'。\n` +
        `继续执行只会生成没有音频的数据包，已中止。\n` +
        `请安装 ffmpeg，或用 --ffmpeg <路径> 指定；确实不需要转换时，把 FFMPEG_CMD 显式设为空字符串。`,
    );
  }
  return real_cmd;
}

export async function convert_audio(dst_path: string, src_path: string) {
  const real_cmd = resolve_ffmpeg();
  if (!real_cmd) return;
  const { FFMPEG_OPTS } = conf();
  if (!is_ffmpeg_logged) {
    is_ffmpeg_logged = true;
    info("Use ffmpeg:", real_cmd, "md5: " + await tool_md5(real_cmd));
  }
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
