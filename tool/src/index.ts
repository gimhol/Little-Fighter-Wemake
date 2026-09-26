
import path, { join } from "path";
import package_json from "../../package.json";
import { conf, dont_wait, make_conf } from "./conf";
import { data_2_txt } from "./data_2_txt";
import { make_data, make_data_zip } from "./make_data_zip";
import { make_full_zip } from "./make_full_zip";
import { make_prel_zip } from "./make_prel_zip";
import { show_main_usage } from "./show_main_usage";
import { print_magick_hints } from "./utils/convert_image";
import { print_ffmpeg_hints } from "./utils/convert_audio";
import { is_dir } from "./utils/is_dir";
import { is_json } from "./utils/is_file";
import { log } from "./utils/log";
import { read_dir_info_json } from "./utils/read_dir_info_json";
import { waitForKeyPress } from "./waitForKeyPress";
import { make_pick_zip } from "./make_pick_zip";

enum CMDEnum {
  MAIN = "main",
  HELP = 'help',
  DAT_2_TXT = 'dat-2-txt',
  MAKE_DATA = 'make-data',
  MAKE_DATA_ZIP = 'make-data-zip',
  MAKE_PREL = 'make-prel',
  ZIP_FULL = 'zip-full',
  PRINT_CONF = 'print-conf',
  VERSION = 'version',
  PICK = 'pick'
}

async function main(): Promise<any> {
  const argv_2 = process.argv[2]
  switch (argv_2) {
    case CMDEnum.VERSION:
      log(package_json.version)
      return 'DONT_WAIT'
    case CMDEnum.MAKE_DATA:
      await make_data();
      return
    case CMDEnum.MAKE_DATA_ZIP:
      await make_data_zip();
      return
    case CMDEnum.MAKE_PREL:
      await make_prel_zip();
      return;
    case CMDEnum.ZIP_FULL:
      await make_full_zip();
      return;
    case CMDEnum.MAIN:
      await make_data_zip();
      await make_prel_zip();
      await make_full_zip();
      return;
    case CMDEnum.DAT_2_TXT:
      const { IN_LF2_DIR, TMP_TXT_DIR } = conf();
      if (!IN_LF2_DIR) return log("Failed! because 'IN_LF2_DIR' is not set in 'conf file'.")
      if (!TMP_TXT_DIR) return log("Failed! because 'TMP_TXT_DIR' is not set in 'conf file'.")
      return data_2_txt(IN_LF2_DIR, TMP_TXT_DIR);
    case CMDEnum.PRINT_CONF:
      const json = {
        description: "You can copy it into json file. or run 'lf2w-tool print-conf > conf.json' to write it into 'conf.json'",
        ...make_conf()
      }
      delete json.CONF_FILE;
      log(JSON.stringify(json, null, 2))
      return;
    case CMDEnum.PICK:
      return await make_pick_zip();
    case CMDEnum.HELP:
      return show_main_usage();
    default:
      if (!argv_2) {
        return show_main_usage();
      } else if (await is_dir(argv_2)) {
        log(`Got a dir`)
        const basename = path.basename(argv_2)
        const dir_info = await read_dir_info_json(argv_2)
        const c = conf(`./${basename}.conf.json`, conf => {
          if (dir_info.info_file_ok) {
            log(dir_info.info_file, dir_info)
          }
          if (dir_info.type === 'prel') {
            conf.IN_PREL_DIR = argv_2
            if (typeof dir_info.output === 'string') conf.OUT_PREL_NAME = dir_info.output
            else conf.OUT_PREL_NAME = `${path.basename(argv_2)}.prel.zip`
          } else {
            conf.TMP_DIR = argv_2 + '.temp';
            conf.OUT_DIR = argv_2 + '.output';
            conf.IN_LF2_DIR = argv_2
            if (typeof dir_info.output === 'string') conf.OUT_DATA_NAME = dir_info.output
            else conf.OUT_DATA_NAME = `${path.basename(argv_2)}.data.zip`
          }
        })
        if (dir_info.type === 'prel') {
          log(`Will try to zip it to "prel zip", path:\n    "${join(c.OUT_DIR!, c.OUT_PREL_NAME!).replace(/\\/g, '/')}"`)
        } else {
          log(`Will try to zip it to "data zip", path:\n    "${join(c.OUT_DIR!, c.OUT_DATA_NAME!).replace(/\\/g, '/')}"`)
        }
        await make_data_zip();
        await make_prel_zip();
        await make_full_zip();
      } else if (await is_json(argv_2)) {
        conf(argv_2)
        log(`Got a json file, will try to use it as 'conf file'`)
        await make_data_zip();
        await make_prel_zip();
        await make_full_zip();
      } else {
        log(`unknown cmd, should be one of those: [${Object.keys(CMDEnum).map(k => (CMDEnum as any)[k]).join(', ')}]`)
        show_main_usage();
      }
      break
  }
}

main().then((r) => {
  print_ffmpeg_hints();
  print_magick_hints();
  if (!dont_wait() && r != 'DONT_WAIT') waitForKeyPress();
}).catch((e) => {
  log(e)
  // 以前只是打印，进程仍以 0 退出，CI 会把“缺少 magick/ffmpeg 的残缺数据包”当成成功
  process.exitCode = 1
  if (!dont_wait()) waitForKeyPress();
})

