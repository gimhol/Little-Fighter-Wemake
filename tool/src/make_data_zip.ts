import fs, { rm } from "fs/promises";
import JSON5 from "json5";
import path, { join } from "path";
import { Defines } from "../../src/LFW/defines/defines";
import type { ITempDataLists } from "../../src/LFW/defines/IDataLists";
import { suffix_map } from "../../src/LFW/defines/IDatIndex";
import { IDataZipInfo } from "../../src/LFW/defines/IFullGameZipInfo";
import type { ILegacyPictureInfo } from "../../src/LFW/defines/ILegacyPictureInfo";
import { conf } from "./conf";
import { CacheInfos } from "./utils/cache_infos";
import { classify } from "./utils/classify";
import { convert_audio } from "./utils/convert_audio";
import { convert_dat_file, IConvertDatContext } from "./utils/convert_dat_file";
import { convert_data_txt, write_index_file } from "./utils/convert_data_txt";
import { convert_grid_image, convert_whole_image } from "./utils/convert_image";
import { copy_dir } from "./utils/copy_dir";
import { debug, error, log } from "./utils/log";
import { make_zip_and_json } from "./utils/make_zip_and_json";
import { remove_untracked_outputs, reset_output_tracker, track_output } from "./utils/output_tracker";
import { optimize_png } from "./utils/optimize_png";
import { write_file } from "./utils/write_file";
import { make_tool_salt } from "./utils/tool_identity";

export async function make_data() {
  debug(`make_data()`)
  const {
    IN_LF2_DIR,
    CONF_FILE,
    IN_EXTRA_DIR,
    OUT_DIR,
    TMP_DIR,
    TMP_DAT_DIR,
    KEEP_MIRROR,
    COPYS_SUFFIX,
    AUDIO_SUFFIX,
    IMAGE_SUFFIX,
    INDEX_FILE,
  } = conf();
  if (!IN_LF2_DIR)
    return log(`'data' will not be created, because 'IN_LF2_DIR' is not set in '${CONF_FILE}'.`)
  if (!OUT_DIR)
    return log(`'data' will not be created, because 'OUT_DIR' is not set in '${CONF_FILE}'.`)
  if (!TMP_DIR)
    return log(`'data' will not be created, because 'TMP_DIR' is not set in '${CONF_FILE}'.`)
  if (!TMP_DAT_DIR)
    return log(`'data' will not be created, because 'TMP_DAT_DIR' is not set in '${CONF_FILE}'.`)
  if (!COPYS_SUFFIX)
    return log(`'data' will not be created, because 'COPYS_SUFFIX' is not set in '${CONF_FILE}'.`)
  if (!AUDIO_SUFFIX)
    return log(`'data' will not be created, because 'AUDIO_SUFFIX' is not set in '${CONF_FILE}'.`)
  if (!IMAGE_SUFFIX)
    return log(`'data' will not be created, because 'IMAGE_SUFFIX' is not set in '${CONF_FILE}'.`)
  if (!INDEX_FILE)
    return log(`'data' will not be created, because 'IMAGE_SUFFIX' is not set in '${INDEX_FILE}'.`)

  reset_output_tracker();
  const cache_infos = await CacheInfos.create(
    path.join(TMP_DIR, "cache_infos.json5"),
    await make_tool_salt(),
  );
  const ress = classify(IN_LF2_DIR);
  let indexes: ITempDataLists | undefined;
  try {
    indexes = await convert_data_txt(IN_LF2_DIR, TMP_DAT_DIR, INDEX_FILE);
  } catch (e) {
    return error(`'data' will not be created, reason: ${e}\n`, e)
  }
  for (const src_path of ress.directories) {
    const dst_path = src_path.replace(IN_LF2_DIR, TMP_DAT_DIR);
    await fs.mkdir(dst_path, { recursive: true }).catch((_) => void 0);
  }

  const pic_list_map = new Map<string, ILegacyPictureInfo[]>();
  const all = [
    ...indexes.objects,
    ...indexes.stages,
    ...indexes.backgrounds,
  ]

  for (const item of all) {
    const { type, src, skipped } = item;
    const suffix = suffix_map[type]
    if (skipped == '1') continue;
    if (!suffix) continue;
    if (suffix === 'bot') continue;
    const src_path = IN_LF2_DIR + '/' + src
    const dst_path = convert_dat_file.get_dst_path(
      TMP_DAT_DIR,
      IN_LF2_DIR,
      src_path,
      suffix,
      conf().OUT_TYPE ?? void 0,
    );
    const cache_info = await cache_infos.get_info(src_path, [dst_path]);
    // TODO: 日后将bot文件另外生成吧……
    // const is_changed = await cache_info.changed();
    // if (!is_changed) {
    //   log("Not changed:", src_path, "=>\n    " + dst_path);
    //   continue;
    // }
    const ctx: IConvertDatContext = {
      out_dir: TMP_DAT_DIR,
      src_path,
      dst_path,
      indexes,
    }
    const json = await convert_dat_file(ctx);
    if (!Array.isArray(json) && json.type !== 'background') {
      let edited = false;
      for (const pic_name in json.base.files) {
        const file = json.base.files[pic_name];
        if (
          'row' in file &&
          'col' in file &&
          'cell_w' in file &&
          'cell_h' in file
        ) {
          const key = file.path;
          const arr = pic_list_map.get(key);
          if (arr) {
            file.path = file.path.replace(/.png$/, `_${arr.length}.png`);
            edited = true;
            arr.push(file as ILegacyPictureInfo);
          } else {
            pic_list_map.set(key, [file as ILegacyPictureInfo]);
          }
        }
      }
      if (edited) {
        await write_file(dst_path, JSON5.stringify(json, null, 2));
      }
    }
    await cache_info.update();
  }

  const bmps = ress.get_files(...IMAGE_SUFFIX.split(','))
  for (const src_path of bmps) {
    const dst_path = convert_whole_image.get_dst_path(
      TMP_DAT_DIR,
      IN_LF2_DIR,
      src_path
    );
    const pic_list = pic_list_map.get(
      dst_path.replace(TMP_DAT_DIR + "/", "")
    );
    if (!pic_list?.length) {
      if (dst_path.endsWith('_mirror.png') && !KEEP_MIRROR) {
        await rm(dst_path).catch(() => void 0)
        log("Mirror image ignored:", src_path);
        continue;
      }
      track_output(dst_path);
      const cache_info = await cache_infos.get_info(src_path, [dst_path]);
      const is_changed = await cache_info.changed();
      if (!is_changed) {
        log("Not changed:", src_path, "=>\n    " + dst_path);
        continue;
      }
      await convert_whole_image(TMP_DAT_DIR, IN_LF2_DIR, src_path);
      await cache_info.update();
    } else {
      for (const pic of pic_list) {
        const dst_path = convert_grid_image.get_dst_path(TMP_DAT_DIR, pic);
        if (dst_path.endsWith('_mirror.png') && !KEEP_MIRROR) {
          await rm(dst_path).catch(() => void 0)
          log("Mirror image ignored:", src_path);
          continue;
        }
        track_output(dst_path);
        const cache_info = await cache_infos.get_info(src_path, [dst_path]);
        const is_changed = await cache_info.changed();
        if (!is_changed) {
          log("Not changed:", src_path, "=>\n    " + dst_path);
          continue;
        }
        await convert_grid_image(dst_path, src_path, pic);
        await cache_info.update();
      }
    }
  }

  const sounds = ress.get_files(...AUDIO_SUFFIX.split(','))
  for (const src_path of sounds) {
    const dst_path = convert_audio.get_dst_path(
      TMP_DAT_DIR,
      IN_LF2_DIR,
      src_path
    );
    track_output(dst_path);
    const cache_info = await cache_infos.get_info(src_path, [dst_path]);
    const is_changed = await cache_info.changed();
    if (!is_changed) {
      log("Not changed:", src_path, "=>\n    " + dst_path);
      continue;
    }
    await convert_audio(dst_path, src_path);
    await cache_info.update();
  }

  for (const src_path of ress.get_files(...COPYS_SUFFIX.split(','))) {
    const dst_path = src_path.replace(IN_LF2_DIR, TMP_DAT_DIR);
    const pic_list = /\.png$/i.test(src_path)
      ? pic_list_map.get(dst_path.replace(TMP_DAT_DIR + "/", ""))
      : void 0;
    if (pic_list?.length) {
      for (const pic of pic_list) {
        const grid_dst_path = convert_grid_image.get_dst_path(TMP_DAT_DIR, pic);
        track_output(grid_dst_path);
        const cache_info = await cache_infos.get_info(src_path, [grid_dst_path]);
        const is_changed = await cache_info.changed();
        if (!is_changed) {
          log("Not changed:", src_path, "=>\n    " + grid_dst_path);
          continue;
        }
        await convert_grid_image(grid_dst_path, src_path, pic);
        await cache_info.update();
      }
      continue;
    }
    track_output(dst_path);
    const cache_info = await cache_infos.get_info(src_path, [dst_path]);
    const is_changed = await cache_info.changed();
    if (!is_changed) {
      log("Not changed:", src_path, "=>\n    " + dst_path);
      continue;
    }
    const optimized = /\.png$/i.test(src_path)
      ? await optimize_png(src_path, dst_path)
      : await fs.copyFile(src_path, dst_path).then(() => false);
    log(optimized ? "Optimize png" : "Copy", src_path, "=>\n    " + dst_path);
    await cache_info.update();
  }
  if (IN_EXTRA_DIR) await copy_dir(IN_EXTRA_DIR, TMP_DAT_DIR);
  await cache_infos.save();
  await write_index_file(indexes, TMP_DAT_DIR);

  const info: IDataZipInfo = {
    type: "DATA",
    title: "Little Fighter Wemake Data Zip",
    version: Defines.DATA_VERSION,
    description: "Little Fighter Wemake Data Zip",
    author: "Gim"
  }
  try {
    const buf =
      await fs.readFile(join(IN_LF2_DIR, "index.json5")).catch(() => null) ||
      await fs.readFile(join(IN_LF2_DIR, "index.json")).catch(() => null);
    if (buf) {
      const raw: object = JSON5.parse(buf.toString())
      if ('title' in raw && typeof raw.title == 'string') info.title = raw.title;
      if ('desc' in raw && typeof raw.desc == 'string') info.description = raw.desc;
      if ('description' in raw && typeof raw.description == 'string') info.description = raw.description;
      if ('author' in raw && typeof raw.author == 'string') info.author = raw.author;
    }
  } catch (e) {
    console.error(e)
  }
  await write_file(join(TMP_DAT_DIR, "index.json5"), JSON.stringify(info))
  track_output(join(TMP_DAT_DIR, "index.json5"));
  track_output(join(TMP_DAT_DIR, "ui/_index.json5"));
  await remove_untracked_outputs(TMP_DAT_DIR);
}
export async function make_data_zip() {
  debug(`make_data_zip()`)
  const { TMP_DAT_DIR, OUT_DIR, OUT_DATA_NAME, CONF_FILE } = conf();
  if (OUT_DATA_NAME) debug({ OUT_DATA_NAME })
  else return log(`'data zip' will not be created, because 'OUT_DATA_NAME' is not set in '${CONF_FILE}'.`)
  if (OUT_DIR) debug({ OUT_DIR })
  else return log(`'${OUT_DATA_NAME}' will not be created, because 'OUT_DIR' is not set in '${CONF_FILE}'.`)
  if (TMP_DAT_DIR) debug({ TMP_DAT_DIR })
  else return log(`'${OUT_DATA_NAME}' will not be created, because 'TMP_DAT_DIR' is not set in '${CONF_FILE}'.`)
  await make_data();
  await make_zip_and_json(TMP_DAT_DIR, OUT_DIR, OUT_DATA_NAME, (inf) => {
    inf.type = 'data';
    return inf;
  });
}
