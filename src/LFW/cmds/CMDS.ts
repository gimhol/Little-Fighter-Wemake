import { Ditto } from "../ditto";
import type { World } from "../World";

export interface ICMDHandler { (ctx: CMDS): unknown; }

export class CMDS {
  private static readonly handlers = new Map<string, ICMDHandler>();
  private static readonly helps = new Map<string, string>();
  private static inst: CMDS;
  /** 已注册命令：名字（已小写）+ 帮助文本，按名字排序 */
  static list(): readonly { key: string; help: string }[] {
    return [...this.handlers.keys()]
      .sort()
      .map((key) => ({ key, help: this.helps.get(key) ?? '' }));
  }
  static handler(key: string) {
    key = key.toLowerCase();
    return this.handlers.get(key)
  }
  static register(key: string, help: string, handler: ICMDHandler) {
    key = key.toLowerCase();
    this.helps.set(key, help)
    this.handlers.set(key, handler);
  }
  static handle(world: World, cmds: string[]) {
    if (this.inst?.world !== world) this.inst = new CMDS(world);
    for (let i = 0; i < cmds.length; i++) {
      this.inst.set_cmd(cmds[i]);
      const cmd = this.inst.words[0].toLowerCase();
      const handler = this.handler(cmd);
      if (!handler) continue;
      if (this.inst.words[1]?.toLowerCase() === 'help') {
        Ditto.Log(this.helps.get(cmd) ?? '');
        continue;
      }
      handler(this.inst);
    }
  }
  readonly world: World;
  words: string[] = [];
  positionals: string[] = [];
  cmd: string = '';
  private _args: { [name in string]: string } | undefined;
  private constructor(world: World) {
    this.world = world;
  }
  print(msg: string) {
    Ditto.print(msg)
  }
  set_cmd(cmd: string) {
    this.cmd = cmd;
    this.words.length = 0;
    this.positionals.length = 0;
    const parts = cmd.split(' ');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;
      this.words.push(part);
      if (!part.startsWith('--')) {
        this.positionals.push(part)
      }
    }
    this._args = void 0; // 使命名参数缓存失效
  }
  str(index: number): string | undefined {
    return this.positionals[index]
  }
  num(index: number) {
    const str = this.str(index);
    if (str == void 0) return void 0;
    return Number(str);
  }
  nums(index: number): number[] | undefined {
    const str = this.str(index);
    if (str == void 0) return void 0;
    return str.split(',').map(Number);
  }

  private get args(): { [name in string]: string } {
    if (this._args) return this._args;
    const map: { [name in string]: string } = {};
    for (const token of this.words) {
      const eq = token.indexOf('=');
      if (eq > 0) {
        map[token.slice(0, eq)] = token.slice(eq + 1);
      } else {
        map[token] = '';
      }
    }
    return this._args = map;
  }

  private arg_value(name: string): string | undefined {
    const value = this.args[name];
    return value === void 0 ? void 0 : value;
  }

  str_arg(name: string): string | undefined {
    return this.arg_value(name)
  }

  num_arg(name: string): number | undefined {
    const s = this.arg_value(name);
    if (s == void 0) return void 0;
    return Number(s);
  }

  nums_arg(name: string): number[] | undefined {
    const s = this.arg_value(name);
    if (s == void 0) return void 0;
    return s.split(',').map(Number);
  }
}
