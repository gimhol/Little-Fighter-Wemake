import { Difficulty as DF } from "../defines/Difficulty";
import { stage_info_new, type IStageInfo } from "../defines/IStageInfo";
import type { IStageObjectInfo } from "../defines/IStageObjectInfo";
import { stage_phase_info_new, type IStagePhaseInfo } from "../defines/IStagePhaseInfo";
import { StageActions } from "../defines/StageActions";
import { match_colon_value } from "../utils/string_parser/match_colon_value";
import { match_hash_end } from "../utils/string_parser/match_hash_end";
import { take_blocks } from "../utils/string_parser/take_blocks";
import { to_num } from "../utils/type_cast/to_num";

export function make_stage_info_list(full_str: string): IStageInfo[] {
  full_str = full_str.replace(/\\\\/g, "/");
  full_str = full_str.replace(
    /<phase_end>[\n|\s|\r]*<stage>/g,
    "<phase_end><stage_end><stage>",
  );
  const stage_infos: IStageInfo[] = [];
  const r_0 = take_blocks(full_str, "<stage>", "<stage_end>")
  full_str = r_0.remains;
  for (let stage_str of r_0.blocks) {
    const phases: IStagePhaseInfo[] = []
    const stage_info = stage_info_new();
    stage_info.phases = phases;
    const r1 = take_blocks(stage_str, "<phase>", "<phase_end>")
    stage_str = r1.remains
    for (let phase_str of r1.blocks) {
      const phase_info = stage_phase_info_new();
      for (let line of phase_str.trim().split("\n")) {
        line = line.trim();
        if (!line) continue;
        if (line.startsWith("bound")) {
          for (const [key, value] of match_colon_value(line)) {
            if (key === "bound")
              phase_info.bound = to_num(value) ?? phase_info.bound;
            if (key === "music")
              phase_info.music = value.replace(/\\/g, "/") + ".mp3";
          }
          phase_info.desc = match_hash_end(line)?.trim() ?? "";
        } else if (line.startsWith("music")) {
          for (const [key, value] of match_colon_value(line)) {
            if (key === "music")
              phase_info.music = value.replace(/\\/g, "/") + ".mp3";
          }
        } else if (line.startsWith("id")) {
          const object: IStageObjectInfo = {
            id: [],
            x: phase_info.bound,
          };
          if (line.indexOf("<soldier>") >= 0) object.is_soldier = true;
          if (line.indexOf("<boss>") >= 0) object.is_boss = true;
          for (const [key, value] of match_colon_value(line)) {
            if (key === "id") object.id = [value];
            else if (key === "act") object.act = value;
            else (object as any)[key] = to_num(value) ?? (object as any)[key];
            object.facing = (object.x && object.x < 0) ? 1 : -1;
          }
          if (object.is_soldier && !object.times)
            object.times = 50;
          phase_info.objects ??= []
          phase_info.objects?.push(object);
        }
      }
      stage_info.phases.push(phase_info);
    }
    const head = stage_str.replace(/\s+\n+/g, "\n").trim();
    for (const [key, value] of match_colon_value(head)) {
      (stage_info as any)[key] = value;
    }
    const nid = Number(stage_info.id);
    stage_info.name = (match_hash_end(head) ?? stage_info?.id)?.
      replace(/stage/gi, "").
      trim();

    if (nid % 10 === 0) {
      stage_info.is_starting = true;
      stage_info.starting_name = "" + (1 + nid / 10);
    }
    for (let i = 0; i < stage_info.phases.length; i++) {
      const p = stage_info.phases[i];
      p.enemy_r = (p.bound ?? 0) + 300;
      p.enemy_l = -300;
      p.on_end = [StageActions.EnterNextPhase]
      if (i == stage_info.phases.length - 1)
        p.on_end = [StageActions.LoopGoGoGoRight]
      else if (i > 0)
        p.on_start = [StageActions.GoGoGoRight]

    }
    if (nid < 49 && stage_info.phases[0]) {
      stage_info.phases[0]!.health_up = stage_info.phases[0]!.respawn = {
        [DF.Easy]: 200,
        [DF.Normal]: 150,
        [DF.Difficult]: 100,
        [DF.Crazy]: 50,
      };
      stage_info.phases[0]!.mp_up = {
        [DF.Easy]: 500,
        [DF.Normal]: 500,
        [DF.Difficult]: 500,
        [DF.Crazy]: 500,
      };
    }
    if (nid === 50) {
      for (const p of stage_info.phases) {
        p.respawn = {
          [DF.Easy]: 200,
          [DF.Normal]: 100,
          [DF.Difficult]: 5,
          [DF.Crazy]: 5,
        };
        p.respawn_r = {
          [DF.Easy]: 500,
          [DF.Normal]: 400,
          [DF.Difficult]: 300,
          [DF.Crazy]: 250,
        };
        p.respawn_x = {
          [DF.Easy]: 100,
          [DF.Normal]: 100,
          [DF.Difficult]: 100,
          [DF.Crazy]: 100,
        }
      }
    }

    if (nid === 50) {
      stage_info.starting_name = "Survival";
      stage_info.chapter = "survival"
      stage_info.bg = "bg_8";
      stage_info.title = 'SURVIVAL STAGE'
      for (let i = 0; i < stage_info.phases.length; i++) {
        const p = stage_info.phases[i];
        p.drink_l = 0;
        p.drink_r = p.bound;
        p.title = `Survival Stage ${i}`
        p.on_start = void 0;
        p.on_end = [StageActions.EnterNextPhase];
      }
    }
    if (nid <= 9) {
      stage_info.bg = "bg_2";
      stage_info.chapter = "chapter_1"
      stage_info.title = `STAGE 1-${nid + 1}`
      if (nid < 9) stage_info.next = "" + (nid + 1);
    } else if (nid <= 19) {
      stage_info.bg = "bg_3";
      stage_info.chapter = "chapter_2"
      stage_info.title = `STAGE 2-${nid + 1 - 10}`
      if (nid < 19) stage_info.next = "" + (nid + 1);
    } else if (nid <= 29) {
      stage_info.bg = "bg_5";
      stage_info.chapter = "chapter_3"
      stage_info.title = `STAGE 3-${nid + 1 - 20}`
      if (nid < 29) stage_info.next = "" + (nid + 1);
    } else if (nid <= 39) {
      stage_info.bg = "bg_6";
      stage_info.chapter = "chapter_4"
      stage_info.title = `STAGE 4-${nid + 1 - 30}`
      if (nid < 39) stage_info.next = "" + (nid + 1);
    } else if (nid <= 49) {
      stage_info.bg = "bg_7";
      stage_info.chapter = "chapter_5"
      stage_info.title = `STAGE 5-${nid + 1 - 40}`
      if (nid < 49) stage_info.next = "" + (nid + 1);
    }
    stage_infos.push(stage_info);
  }

  for (const stage_info of stage_infos) {
    const first_phase = stage_info.phases?.[0];
    if (!first_phase) continue;
    first_phase.cam_jump_to_x = 0;
    first_phase.player_jump_to_x = 0;
    first_phase.player_facing = 1;
  }
  stage_infos.sort((a, b) => Number(a.id) - Number(b.id));
  for (const s of stage_infos) {
    if (!s.next) continue;
    const next_ok = !!stage_infos.find(v => v.id === s.next)
    if (next_ok) continue;
    delete s.next;
    const nid = Number(s.id);
    if (nid <= 9) { s.next = '10' }
    else if (nid <= 19) { s.next = '20' }
    else if (nid <= 29) { s.next = '30' }
    else if (nid <= 39) { s.next = '40' }
    else if (nid <= 49) { s.next = 'end' }
  }
  for (const s of stage_infos) {
    const next = stage_infos.find(v => v.id === s.next)
    const is_stage_end = s.next === 'end' || !s.next || next?.chapter !== s.chapter;
    if (!is_stage_end) continue;
    const last_phase = s.phases?.[s.phases.length - 1]
    if (!last_phase) continue;
    last_phase.on_end = void 0;
  }
  return stage_infos
}
