import { zip } from "compressing";
import { rm } from "node:fs/promises";
import { download } from "./download.mjs";

async function main() {
  const path = await download('https://lf.gim.ink/convertings/rn.zip', './lf2s')
  await rm('./lf2s/rn', { recursive: true }).catch(e => { })
  await zip.uncompress(path, './lf2s')
  await rm(path);

}
main()