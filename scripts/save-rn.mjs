import { zip } from "compressing";
import { run } from "./run.mjs";
import { rm } from "fs/promises";

async function main() {
  const src = './lf2s/rn';
  const dst = `./lf2s/rn.zip`
  await zip.compressDir(src, dst);
  await run(`fdeploy`, [`-s`, `oss`, `--REMOTE_DIR`, `convertings`, `--LOCAL_PATH`, dst])
  await rm(dst);
}
main()
