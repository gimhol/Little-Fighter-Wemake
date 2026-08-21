import { accessSync, constants, readFileSync, writeFileSync } from "fs";
import JSON5 from "json5";
import { dirname, join, resolve } from "path";
import { find_real_cmd } from "./utils/find_real_cmd";
import { Logger } from "./utils/log";

export interface IConf {
  CONF_FILE?: string;

  IN_LF2_DIR?: string;

  IN_PREL_DIR?: string;

  IN_EXTRA_DIR?: string;

  /**
   * 临时输出目录
   *
   * @default "./temp"
   * @type {string}
   * @memberof IConf
   */
  TMP_DIR?: string;

  /**
   * 临时文本输出目录（用于 dat-2-txt）
   * 
   * @default `${TMP_DIR}/lf2_txt` lf2_data
   * @type {string}
   * @memberof IConf
   */
  TMP_TXT_DIR?: string;

  /**
   * 临时数据输出目录（用于make-data）
   * 
   * @default `${TMP_DIR}/lf2_data`
   * @type {string}
   * @memberof IConf
   */
  TMP_DAT_DIR?: string;

  /**
   * 临时数据输出目录（用于make-prel）
   * 
   * @default `${TMP_DIR}/lf2_prel`
   * @type {string}
   * @memberof IConf
   */
  TMP_PREL_DIR?: string;
  TMP_FULL_DIR?: string;
  /**
   * 输出目录（用于make-data）
   * 
   * @default `${TMP_DIR}/lf2_data`
   * @type {string}
   * @memberof IConf
   */
  OUT_DIR?: string;
  OUT_DATA_NAME?: string;
  OUT_PREL_NAME?: string;

  /**
   * @default `lfw.full.zip`
   * @type {string}
   * @memberof IConf
   */
  OUT_FULL_NAME?: string;

  /**
   * 
   * @default `ffmpeg`
   * @type {string}
   * @memberof IConf
   */
  FFMPEG_CMD?: string;
  FFMPEG_OPTS?: string;
  /**
   * 
   * @default `magick`
   * @type {string}
   * @memberof IConf
   */
  MAGICK_CMD?: string;

  KEEP_MIRROR?: string;
  DONT_WAIT?: string;
  DEBUG?: string;
  COPYS_SUFFIX?: string;
  AUDIO_SUFFIX?: string;
  IMAGE_SUFFIX?: string;
  INDEX_FILE?: string;
  IN_LFW_DIR?: string;
  IN_LFW_INDEX?: string;
  OUT_LFW_INDEX?: string;
  LFW_PICKS?: string;

  /**
   * 输出格式后缀（*.bg.${OUT_TYPE} / *.obj.${OUT_TYPE} / *.stage.${OUT_TYPE}）
   * 
   * 例如：设 `"xml"` 则输出 `*.bg.xml`
   * 
   * 默认不设（undefined）时输出 JSON5（*.bg.json5 / *.obj.json5 / *.stage.json5）
   * 
   * @type {string}
   */
  OUT_TYPE?: string;
}
interface IClazz<C extends Object = {}, V extends Object = {}> {
  new(...args: any): C;
  valueOf(): V
}
interface IArgInfo<C extends Object = {}, T extends IClazz<C> = IClazz<C>> {
  key: keyof IConf;
  alias?: string[];
  type: T,
  default?: string | (() => string);
  description?: string;
}
class Path {

}

const txt_a = `If it doesn't exist, it will be created.`
const key_arg_records: Record<keyof IConf, Omit<IArgInfo, 'key'>> = {
  CONF_FILE: { alias: ['-c', '--conf'], type: Path },
  IN_LF2_DIR: {
    alias: ['-i', '--input'], type: Path,
    description: "A path that points to an LF2 directory (or a directory similar to LF2), and it doesn't need to be a complete LF2 directory."
  },
  INDEX_FILE: { type: Path },
  IN_PREL_DIR: { type: Path },
  IN_EXTRA_DIR: { type: Path },

  TMP_DIR: {
    alias: ['-t', '--temp'], type: Path, default: './temp',
    description: `A path that points to a directory used for storing some temporary files. ${txt_a}`
  },
  TMP_TXT_DIR: { type: Path },
  TMP_DAT_DIR: { type: Path },
  TMP_PREL_DIR: { type: Path },
  TMP_FULL_DIR: { type: Path },
  OUT_DIR: {
    alias: ['-o', '--output'], type: Path, default: './public',
    description: `A path that points to a directory for storing final output files. ${txt_a}`
  },
  OUT_DATA_NAME: { type: String, default: 'data.zip' },
  OUT_PREL_NAME: { type: String, default: 'prel.zip' },
  OUT_FULL_NAME: { type: String, default: 'lfw.full.zip' },

  OUT_TYPE: { type: String, default: 'json5' },

  FFMPEG_CMD: {
    type: String,
    alias: ['--ffmpeg'],
    default: () => {
      const subpaths = ['tools/ffmpeg.exe', 'ffmpeg.exe']
      const fallback = 'ffmpeg'
      const dir = dirname(process.execPath)
      return subpaths.find(v => find_real_cmd(join(dir, v))) || fallback;
    }
  },
  FFMPEG_OPTS: {
    type: String,
    default: '-codec:a libmp3lame -b:a 128k -ar 44100'
  },
  MAGICK_CMD: {
    type: String,
    alias: ['--magick'],
    default: () => {
      const subpaths = ['tools/magick.exe', 'magick.exe']
      const fallback = 'magick'
      const dir = dirname(process.execPath)
      return subpaths.find(v => find_real_cmd(join(dir, v))) || fallback;
    }
  },
  KEEP_MIRROR: { type: Boolean },
  DONT_WAIT: { alias: ['-d', '--dont-wait'], type: Boolean },
  DEBUG: { type: Boolean },
  COPYS_SUFFIX: { type: String, default: 'txt,md,png,mp3,jpg,jpeg' },
  AUDIO_SUFFIX: { type: String, default: 'wav,wave,aiff,aif,aifc,flac,m4a,alac,mpga,mp2,aac,ogg,oga,wma,opus,amr,dsf,dff,3gp' },
  IMAGE_SUFFIX: { type: String, default: 'bmp' },

  IN_LFW_DIR: { type: String, },
  IN_LFW_INDEX: { type: String, },
  OUT_LFW_INDEX: { type: String, },
  LFW_PICKS: { type: String, }
}
const alias_arg_map = new Map<string, IArgInfo>();

Object.keys(key_arg_records).map(k => {
  const key = k as keyof IConf;
  const arg: IArgInfo = { key, ...key_arg_records[key] }
  if (!arg.alias) arg.alias = [];
  arg.alias.unshift(`--${k}`);
  for (const a of arg.alias) alias_arg_map.set(a, arg)
})


function read_argv_conf() {
  const argv_conf: Partial<IConf> = {}
  for (let i = 3; i < process.argv.length; i++) {
    const key = process.argv[i];
    const info = alias_arg_map.get(key);
    if (!info) continue;
    if (info.type === Boolean) {
      argv_conf[info.key] = '1'
    } else {
      const value = process.argv[i + 1];
      argv_conf[info.key] = value ?? ''
      ++i
    }
  }
  return argv_conf;
}
export const argv_conf: Partial<IConf> = read_argv_conf()

function override_by_argv(conf: Partial<IConf>) {
  Object.assign(conf, argv_conf)
  Logger.verbose = !!conf.DEBUG
}

export const dont_wait = () => !!(argv_conf.DONT_WAIT || _conf?.DONT_WAIT)
export function make_conf(): Partial<IConf> {
  const conf: Partial<IConf> = {}
  Object.keys(key_arg_records).forEach((k) => {
    const key = k as keyof IConf;
    const info = key_arg_records[key]
    conf[key] = typeof info.default === 'string' ? info.default : info.default?.() || '';
  })
  override_by_argv(conf)
  return conf;
}
function read_conf(file?: string, handle_new_conf?: (conf: IConf) => void): IConf {
  const conf: Partial<IConf> = make_conf();
  i_hate_backslash(conf)

  const conf_files: string[] = [
    file ?? '', conf.CONF_FILE ?? '',
    './conf.json5', './conf.json'
  ].filter(Boolean);

  // 确定是否存在可读写的配置文件
  for (const conf_file of conf_files) {
    try {
      accessSync(conf_file, constants.R_OK)
      conf.CONF_FILE = resolve(conf_file)
    } catch (e) {
      Logger.debug(`Cannot access "${conf_file}".`)
    }
  }

  // 看来没有可读写的配置文件，弄个默认的。
  if (!conf.CONF_FILE) conf.CONF_FILE = file ? resolve(file) : resolve("./conf.json5");

  let conf_file_exists = false;
  // 再次检查配置文件是否存在
  try {
    accessSync(conf.CONF_FILE, constants.R_OK)
    conf_file_exists = true
  } catch (e) {
  }

  // 配置文件不存在，生成个默认的，方便用户填写
  if (!conf_file_exists) {
    Logger.warn(`Cannot access "${conf.CONF_FILE}",\n    will try to create it for you.`)
    try {
      handle_new_conf?.(conf)
      i_hate_backslash(conf)
      const temp: IConf = { ...conf };
      delete temp.CONF_FILE;
      writeFileSync(conf.CONF_FILE, JSON.stringify(temp, null, 2))
      Logger.warn(`"${conf.CONF_FILE}" created,\n    you can edit it now.`)
    } catch (e) {
      Logger.error(`Write "${conf.CONF_FILE}" failed!`)
      throw e;
    }
  }

  // 配置文件存在，尝试解析它
  if (conf_file_exists) {
    Logger.log(`Reading from "${conf.CONF_FILE}"...`)
    try {
      const conf_str = readFileSync(conf.CONF_FILE).toString();
      const more = JSON5.parse(conf_str);
      delete more.CONF_FILE;
      // TODO: 此处应严格检查一下more对象
      Object.assign(conf, more)
      override_by_argv(conf)
      i_hate_backslash(conf)
    } catch (e) {
      Logger.error(`Failed to read json from "${conf.CONF_FILE}"!`)
      throw e;
    }
  }
  if (conf.TMP_DIR && !conf.TMP_TXT_DIR) conf.TMP_TXT_DIR = join(conf.TMP_DIR, 'lf2_txt').replace(/\\/g, '/')
  if (conf.TMP_DIR && !conf.TMP_DAT_DIR) conf.TMP_DAT_DIR = join(conf.TMP_DIR, 'lf2_data').replace(/\\/g, '/')
  if (conf.TMP_DIR && !conf.TMP_PREL_DIR) conf.TMP_PREL_DIR = join(conf.TMP_DIR, 'lf2_prel').replace(/\\/g, '/')
  if (conf.TMP_DIR && !conf.TMP_FULL_DIR) conf.TMP_FULL_DIR = join(conf.TMP_DIR, 'lf2_full').replace(/\\/g, '/')
  if (conf.IN_LF2_DIR && !conf.INDEX_FILE) conf.INDEX_FILE = join(conf.IN_LF2_DIR, 'data/data.txt').replace(/\\/g, '/')

  i_hate_backslash(conf)
  for (const key in conf) {
    const value = conf[key as keyof typeof conf];
    if (!value) continue;
    if (typeof value === 'string')
      conf[key as keyof typeof conf] = value.replace(/\$datenow/g, '' + Date.now())
  }

  return conf
}

const i_hate_backslash = (conf: IConf) => {
  for (const k in conf) {
    const info = key_arg_records[k as keyof IConf]
    if (info?.type !== Path) continue;
    const v = conf[k as keyof IConf];
    if (!v) continue;
    conf[k as keyof IConf] = v.replace(/\\/g, '/')
  }
}
export let _conf: IConf | undefined = void 0;
export const conf: typeof read_conf = (file, handle_new_conf) => _conf ? _conf : _conf = read_conf(file, handle_new_conf)
export function set_conf(conf_file: string): IConf {
  _conf = Object.assign(_conf ?? {}, read_conf(conf_file))
  override_by_argv(_conf)
  i_hate_backslash(_conf)
  return _conf;
}
