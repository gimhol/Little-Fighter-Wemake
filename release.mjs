
import { spawn } from "child_process";
import { zip } from "compressing";
import fs from "fs/promises";

export async function exec_cmd(cmd, args = [], opts = []) {
  console.log(...arguments)
  await new Promise((resolve, reject) => {
    const shell = cmd.endsWith('.cmd') || cmd.endsWith('.bat')
    const temp = spawn(cmd, args, { shell, ...opts }).on("exit", resolve).on("error", reject);
    // temp.stderr.on("data", (buf) =>
    //   // console.error("[stderr]: ", buf.toString()),
    // );
  });
}

async function main() {
  const npm = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
  await exec_cmd(npm, ['install'], { cwd: 'tool' })
  await exec_cmd(npm, ['run', 'build'], { cwd: 'tool' })
  await exec_cmd(npm, ['install'], { cwd: 'server' })
  await exec_cmd(npm, ['run', 'build'], { cwd: 'server' })
  await exec_cmd(npm, ['install'])
  await exec_cmd(npm, ['run', 'build:data'])
  await exec_cmd(npm, ['run', 'build'])
  const { version } = await fs.readFile("./package.json").then(b => JSON.parse(b.toString()))
  const output_dir = `./release/${version}`
  const outzip_path = `./release/Little-Fighter-Wemake-${version}.zip`
  await fs.mkdir(`${output_dir}/frontend`, { recursive: true }).catch(e => e)
  await fs.cp("./dist", `${output_dir}/frontend`, { recursive: true })
  await fs.cp("./tool/dist/tool.cjs", `${output_dir}/tool.cjs`)
  await fs.cp("./server/dist/cjs/server.cjs", `${output_dir}/server.cjs`)
  console.log({ output_dir, outzip_path })
  await zip.compressDir(output_dir, outzip_path);
}
main().then(() => {
  console.log('done')
}).catch(e => {
  console.log('failed, reason' + e)
});