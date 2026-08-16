import { make_entity_special, make_fighter_special, make_weapon_special, xml_x_entity_data } from "../dat_translator";
import { make_ball_special } from "../dat_translator/make_ball_special";
import type { IEntityData } from "../defines";
import { Ditto } from "../ditto";
import { is_ball_data, is_fighter_data, is_weapon_data } from "../entity";
import { is_non_blank_str, max } from "../utils";
import { traversal } from "../utils/container_help/traversal";
import { check_frame } from "./check_frame";
import type { IEntityDataContext } from "./IEntityDataContext";
import { preprocess_bot_data } from "./preprocess_bot_data";
import { preprocess_frame } from "./preprocess_frame";
import { preprocess_next_frame } from "./preprocess_next_frame";
import { preprocess_pic } from "./preprocess_pic";
export async function preprocess_entity_data(ctx: IEntityDataContext): Promise<IEntityData> {
  const { lfw, data, jobs, errors } = ctx;

  if (data.processed != false) { }
  if (is_ball_data(data)) make_ball_special(data)
  else if (is_weapon_data(data)) make_weapon_special(data)
  else if (is_fighter_data(data)) make_fighter_special(data)

  const { images, sounds } = lfw;
  const { small, head } = data.base;
  is_non_blank_str(small) && jobs.push(images.load_img(small, small));
  is_non_blank_str(head) && jobs.push(images.load_img(head, head));
  data.base.dead_sounds?.forEach(i => is_non_blank_str(i) && sounds.load(i, i));
  data.base.drop_sounds?.forEach(i => is_non_blank_str(i) && sounds.load(i, i));
  data.base.hit_sounds?.forEach(i => is_non_blank_str(i) && sounds.load(i, i));

  if (data.pre_hitkeys) {
    const map = new Map();
    traversal(data.pre_hitkeys, (k, v, o) => {
      if (!v) return;
      if (k.length < 2) return;
      if (k[0] == k[1]) return;
      const nf = preprocess_next_frame(v)
      map.set(k, o[k] = nf)
    });
    if (map.size) data.__pre_hitkeys_map = map;
  }
  if (data.post_hitkeys) {
    const map = new Map();
    traversal(data.post_hitkeys, (k, v, o) => {
      if (!v) return;
      if (k.length < 2) return;
      if (k[0] == k[1]) return;
      const nf = preprocess_next_frame(v);
      map.set(k, o[k] = nf);
    });
    if (map.size) data.__post_hitkeys_map = map;
  }
  if (data.on_dead) data.on_dead = preprocess_next_frame(data.on_dead);
  if (data.on_exhaustion) data.on_exhaustion = preprocess_next_frame(data.on_exhaustion);
  const { frames, base: { files, portraits } } = data;

  traversal(files, (_, v) => jobs.push(images.load_by_pic_info(v)));
  if (jobs.length) await Promise.all(jobs);

  traversal(portraits, (k, v, o) => o[k] = preprocess_pic(lfw, data, v));
  traversal(frames, (fid, frame, o) => {
    o[fid] = preprocess_frame({ ...ctx, frame });
    check_frame(data, frame, errors);
    const pics = frame.pics?.length;
    if (pics) data.__pics = max(pics, data.__pics || 0);
  });
  if (data.base.bot)
    data.base.bot = preprocess_bot_data(data.base.bot)
  else make_entity_special(data);
  data.processed = true;
  if (errors.length) Ditto.warn(errors);

  (data as any).xml = () => xml_x_entity_data(Ditto.XML, data).stringify()
  return data;
}



