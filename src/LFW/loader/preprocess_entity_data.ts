import { make_entity_special, make_fighter_special, make_weapon_special, xml_from_entity_data } from "../dat_translator";
import { make_ball_special } from "../dat_translator/make_ball_special";
import type { IEntityData } from "../defines";
import { Ditto } from "../ditto";
import { is_ball_data, is_fighter_data, is_weapon_data } from "../entity";
import { LFW } from "../LFW";
import { is_non_blank_str, max } from "../utils";
import { traversal } from "../utils/container_help/traversal";
import { check_frame } from "./check_frame";
import { preprocess_bot_data } from "./preprocess_bot_data";
import { preprocess_frame } from "./preprocess_frame";
import { preprocess_next_frame } from "./preprocess_next_frame";
import { preprocess_pic } from "./preprocess_pic";

export async function preprocess_entity_data(lfw: LFW, data: IEntityData, jobs: Promise<any>[]): Promise<IEntityData> {
  const errors: string[] = []
  const { images, sounds } = lfw;
  const { small, head } = data.base;
  is_non_blank_str(small) && jobs.push(images.load_img(small, small));
  is_non_blank_str(head) && jobs.push(images.load_img(head, head));
  data.base.dead_sounds?.forEach(i => is_non_blank_str(i) && sounds.load(i, i));
  data.base.drop_sounds?.forEach(i => is_non_blank_str(i) && sounds.load(i, i));
  data.base.hit_sounds?.forEach(i => is_non_blank_str(i) && sounds.load(i, i));

  if (data.on_dead) data.on_dead = preprocess_next_frame(data.on_dead);
  if (data.on_exhaustion) data.on_exhaustion = preprocess_next_frame(data.on_exhaustion);
  const { frames, base: { files, portraits } } = data;

  traversal(files, (_, v) => jobs.push(images.load_by_pic_info(v)));
  if (jobs.length) await Promise.all(jobs);

  traversal(portraits, (k, v, o) => o[k] = preprocess_pic(lfw, data, v));

  if (data.processed != false) { }
  if (is_ball_data(data)) make_ball_special(data)
  else if (is_weapon_data(data)) make_weapon_special(data)
  else if (is_fighter_data(data)) make_fighter_special(data)

  traversal(frames, (fid, frame, o) => {
    o[fid] = preprocess_frame(lfw, data, frame, jobs)
    check_frame(data, frame, errors);
    const pics = frame.pics?.length;
    if (pics) data.__pics = max(pics, data.__pics || 0);
  });
  if (data.base.bot)
    data.base.bot = preprocess_bot_data(data.base.bot)
  else make_entity_special(data);
  data.processed = true;
  if (errors.length) Ditto.warn(errors);

  (data as any).xml = () => xml_from_entity_data(Ditto.XML, data)
  return data;
}



