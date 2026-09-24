import { conf } from "../conf";
import { file_md5_str } from "./file_md5_str";
import { find_real_cmd } from "./find_real_cmd";

const md5_cache = new Map<string, Promise<string>>();

const CONVERT_VERSION = 4;

export function tool_md5(path: string): Promise<string> {
  let ret = md5_cache.get(path);
  if (!ret) {
    ret = file_md5_str(path).catch(() => "");
    md5_cache.set(path, ret);
  }
  return ret;
}

export async function make_tool_salt(): Promise<string> {
  const { FFMPEG_CMD, MAGICK_CMD, FFMPEG_OPTS } = conf();
  const ffmpeg = FFMPEG_CMD ? find_real_cmd(FFMPEG_CMD) : "";
  const magick = MAGICK_CMD ? find_real_cmd(MAGICK_CMD) : "";
  const ffmpeg_md5 = ffmpeg ? await tool_md5(ffmpeg) : "";
  const magick_md5 = magick ? await tool_md5(magick) : "";
  return `${ffmpeg_md5};${magick_md5};${FFMPEG_OPTS ?? ""};${CONVERT_VERSION}`;
}
