import fs from "fs/promises";
import { exec_cmd, exec_cmd_capture } from "./exec_cmd";
import { resolve_magick } from "./convert_image";

export async function optimize_png(src_path: string, dst_path: string): Promise<boolean> {
  const real_cmd = resolve_magick();
  if (real_cmd) {
    const tmp_path = dst_path + ".opt";
    try {
      await fs.rm(tmp_path, { force: true });
      await exec_cmd(
        real_cmd,
        src_path,
        "-strip",
        "-define",
        "png:compression-level=9",
        "-define",
        "png:exclude-chunk=time",
        tmp_path,
      );
      const metric = await exec_cmd_capture(real_cmd, "compare", "-metric", "AE", src_path, tmp_path, "null:");
      const diff = parseFloat(metric);
      const src_size = (await fs.stat(src_path)).size;
      const tmp_size = (await fs.stat(tmp_path)).size;
      if (diff === 0 && tmp_size < src_size) {
        await fs.rm(dst_path, { force: true });
        await fs.rename(tmp_path, dst_path);
        return true;
      }
    } catch (e) {
      console.error(e);
    } finally {
      await fs.rm(tmp_path, { force: true }).catch(() => void 0);
    }
  }
  await fs.copyFile(src_path, dst_path);
  return false;
}
