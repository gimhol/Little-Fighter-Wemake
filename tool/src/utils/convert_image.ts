import fs from "fs/promises";
import type { ILegacyPictureInfo } from "../../../src/LFW/defines/ILegacyPictureInfo";
import { _conf, conf } from "../conf";
import { whoami } from "../show_main_usage";
import { exec_cmd } from "./exec_cmd";
import { find_real_cmd } from "./find_real_cmd";
import { info, warn } from "./log";
import { tool_md5 } from "./tool_identity";
export let is_magick_tried = false;
let is_magick_logged = false;
async function log_magick_once(real_cmd: string) {
  if (is_magick_logged) return;
  is_magick_logged = true;
  info("Use magick:", real_cmd, "md5: " + await tool_md5(real_cmd));
}
function get_dst_path(out_dir: string, src_dir: string, src_path: string) {
  return src_path.replace(src_dir, out_dir).replace(/(.bmp)$/, ".png");
}

/**
 * 解析 magick 命令，供图片相关操作共用。
 *
 * - `MAGICK_CMD` 为空字符串：明确不使用 magick（跳过转换，保留旧行为）
 * - `MAGICK_CMD` 有值但找不到：直接报错中止。以前是静默 return，结果会悄悄产出一个
 *   缺少贴图的数据包（CI 上没装 ImageMagick 7 时就是这样，最后只有一个运行时报错）
 */
export function resolve_magick(): string {
  is_magick_tried = true;
  const { MAGICK_CMD } = conf();
  if (!MAGICK_CMD) return "";
  const real_cmd = find_real_cmd(MAGICK_CMD);
  if (!real_cmd) {
    print_magick_hints();
    throw new Error(
      `找不到图片转换命令：MAGICK_CMD = '${MAGICK_CMD}'。\n` +
        `继续执行只会生成缺少贴图的数据包，已中止。\n` +
        `请安装 ImageMagick 7（需要 magick 命令），或用 --magick <路径> 指定；` +
        `确实不需要转换时，把 MAGICK_CMD 显式设为空字符串。`,
    );
  }
  return real_cmd;
}

export function print_magick_hints() {
  const { MAGICK_CMD } = _conf ?? {};
  if (!is_magick_tried || (MAGICK_CMD && find_real_cmd(MAGICK_CMD))) return;
  const hints = `
====================== magick not found ======================

MAGICK_CMD = '${MAGICK_CMD}'

All image files will not be converted to PNG. 

However, you can convert them to PNG in your own way.

And you need to remove the color from the transparent areas

(the originally black parts of the BMP)

Then you need to put it into output zip file yourself.

To download magick: https://imagemagick.org/script/download.php

'${whoami}' currently only supports PNG.

`.trim();
  console.log('\n')
  warn(hints)
}

export async function convert_whole_image(
  out_dir: string,
  src_dir: string,
  src_path: string,
) {
  const real_cmd = resolve_magick();
  if (!real_cmd) return;
  await log_magick_once(real_cmd);
  const dst_path = get_dst_path(out_dir, src_dir, src_path);
  await fs.rm(dst_path, { recursive: true, force: true }).catch((e) => void 0);
  info("Convert image", src_path, "=>\n    "+ dst_path);
  await exec_cmd(
    real_cmd,
    src_path,
    "-alpha",
    "on",
    "-fill",
    "rgba(0,0,0,0)",
    "-opaque",
    "rgb(0,0,0)",
    "-strip",
    "-define",
    "png:compression-level=9",
    "-define",
    "png:exclude-chunk=time",
    dst_path,
  );
}
convert_whole_image.get_dst_path = get_dst_path;

export function get_dst_path_2(out_dir: string, pic: ILegacyPictureInfo) {
  return out_dir + "/" + pic.path;
}

export async function convert_grid_image(
  dst_path: string,
  src_path: string,
  pic: ILegacyPictureInfo,
) {
  const real_cmd = resolve_magick();
  if (!real_cmd) return;
  await log_magick_once(real_cmd);
  const { col: row, row: col, cell_w, cell_h } = pic;
  const w = (cell_w + 1) * col;
  const h = (cell_h + 1) * row;
  info("Convert grid image", src_path, "=>\n    "+ dst_path);
  const remove_lines: string[] = [];
  for (let col_idx = 0; col_idx < col; ++col_idx) {
    const x = (cell_w + 1) * (col_idx + 1) - 1;
    remove_lines.push("-draw", `line ${x},0 ${x},${h}`);
  }
  for (let row_idx = 0; row_idx < row; ++row_idx) {
    const y = (cell_h + 1) * (row_idx + 1) - 1;
    remove_lines.push("-draw", `line 0,${y} ${w},${y}`);
  }
  const mask_args = w > 0 && h > 0
    ? [
      "(",
      "-size", `${w}x${h}`,
      "xc:none",
      "+antialias",
      "-stroke", "black",
      "-strokewidth", "1",
      ...remove_lines,
      ")",
      "-compose", "Dst_Out",
      "-composite",
    ]
    : [];
  const args = [
    src_path,
    ...(/\.bmp$/i.test(src_path)
      ? ["-alpha", "on", "-fill", "rgba(0,0,0,0)", "-opaque", "rgb(0,0,0)"]
      : []),
    ...mask_args,
    "-strip",
    "-define",
    "png:compression-level=9",
    "-define",
    "png:exclude-chunk=time",
    dst_path,
  ];
  await exec_cmd(real_cmd, ...args);
}

convert_grid_image.get_dst_path = get_dst_path_2;
