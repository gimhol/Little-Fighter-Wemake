import fs from "fs/promises";

async function find_components(file, clazz_list, out) {
  const buf = await fs.readFile(file);
  const str = buf.toString();
  for (const clazz of clazz_list) {
    const regexp1 = new RegExp(`export\\s*class\\s*(.*?)\\s*extends\\s*${clazz}[\\s|<|{]`, 'g')
    const regexp2 = new RegExp(regexp1, '')
    const clazz_names = str.match(regexp1)?.map(v => v.match(regexp2).at(1).split('<').at(0).trim())
    if (clazz_names?.length) out.push(...clazz_names.map(v => [v, clazz]))
  }
  return out;
}
export async function auto_components(dir, clazz_list, out) {
  const files = await fs.readdir(dir);
  for (const file of files) {
    if (file === `index.ts`) continue;
    if (file === `_.ts`) continue;
    const sub = `${dir}/${file}`
    const s = await fs.stat(sub)
    if (s.isDirectory()) {
      await auto_components(sub, clazz_list, out)
      continue;
    }
    if (s.isFile() && file.endsWith('.ts')) {
      await find_components(sub, clazz_list, out)
    }
  }
  return out.length
}
async function main() {
  const outs = []
  let names = ['UIComponent'];
  const useds = new Set(names)
  while (names.length) {
    const pairs = []
    await auto_components(`./src/LFW/ui/component`, names, pairs)
    if (!pairs.length) break;
    names.length = 0;
    for (const pair of pairs) {
      const [n] = pair;
      if (useds.has(n)) continue;
      useds.add(n)
      names.push(n)
      outs.push(pair)
    }
  }
  let str = `
/*** AUTO REGISTER COMPONENTS START ***/
import { Factory } from "../../Factory";
import * as _ from "./index";
let _registed = false
export const regist_components = () => {
  if (_registed) return;
  _registed = true;
  [
${outs.map(v => `    _.${v[0]}`).sort().join(',\n')}
  ].map(v => Factory.register_component(v));
}
/*** AUTO REGISTER COMPONENTS END ***/
`.trim();

  await fs.writeFile(`./src/LFW/ui/component/_.ts`, str)
}
main();
