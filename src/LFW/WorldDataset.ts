import { SyncRenderEnum } from './defines';
import { CheatEnum } from './defines/CheatType';
import { Defines } from './defines/defines';
import { Difficulty } from './defines/Difficulty';
import { type IWorldDataset, world_dataset_fields } from "./defines/IWorldDataset";
import { make_private_properties } from "./utils/make_private_properties";
import wdataset from './world.wdataset.json';

export class WorldDataset implements IWorldDataset {
  static readonly TAG: string = 'WorldDataset';
  itr_fall: number = 40
  itr_shaking: number = 6;
  itr_motionless: number = 6;
  ball_itr_motionless: number = 2;

  fvx_f: number = 0.5;
  fvy_f: number = -0.5;
  fvz_f: number = 1;

  ivx_f: number = 0.5;
  ivy_f: number = -0.54;
  ivz_f: number = 1;

  ivy_d: number = -7;
  ivx_d: number = 0;

  cvy_d: number = 3;
  cvx_d: number = 2;
  tvx_f: number = 0.5;
  tvy_f: number = -0.625;
  tvz_f: number = 0.5;
  begin_blink_time: number = 144;
  lying_blink_time: number = 32;
  gone_blink_time: number = 56;
  vrest_offset: number = -6;
  itr_arest: number = 20;
  min_arest: number = 2;
  min_vrest: number = 2;
  arest_offset: number = 0;
  wait_offset: number = 0;

  cha_bc_spd: number = 2;
  cha_bc_tst_spd_x: number = 5;
  cha_bc_tst_spd_y: number = -2.6;
  hp_recoverability: number = 0.66;
  hp_r_ticks: number = 24;
  hp_r_value: number = 1;
  hp_healing_ticks: number = 16;
  hp_healing_value: number = 8;

  mp_r_ticks: number = 12;
  mp_r_ratio: number = 1;
  double_click_interval: number = 30;
  key_hit_duration: number = 10;
  friction_factor: number = 1;

  friction_x: number = 0.25;
  friction_z: number = 0.25;

  land_friction_factor: number = 1;
  land_friction_x: number = 1;
  land_friction_z: number = 0.5;

  screen_w: number = Defines.MODERN_SCREEN_WIDTH;
  screen_h: number = Defines.MODERN_SCREEN_HEIGHT;
  // gravity: number = 0.5;
  // gravity_d: number = 0.5;
  // weapon_throwing_gravity: number = 0.25;
  gravity: number = 0.4375;
  gravity_d: number = 0.4375;
  weapon_throwing_gravity: number = 0.21875;
  sync_render: number = SyncRenderEnum.FPS_60;
  difficulty: Difficulty = Difficulty.Difficult;
  infinity_mp: number = 0;
  fall_r_ticks: number = 1;
  fall_r_value: number = 1;
  defend_r_ticks: number = 1;
  defend_r_value: number = 1;
  fall_value_max: number = 140;
  catch_time_max: number = 680;
  defend_value_max: number = 90;
  defend_ratio: number = 0.1;
  mp_max: number = 500;
  hp_max: number = 500;
  resting_max: number = 40;
  vrest_after_shaking: number = 1;
  arest_after_motionless: number = 1;
  invisible_blinking: number = 120;
  jump_x_f: number = 0.5;
  jump_z_f: number = 1;
  jump_h_f: number = -0.5;
  dash_x_f: number = 0.5;
  dash_z_f: number = 1;
  dash_h_f: number = -0.5;
  bfall_x_f: number = 0.5;
  bfall_h_f: number = -0.5;

  jump_height: number = -16.299999;
  jump_distance: number = 8;
  jump_distancez: number = 3;
  dash_height: number = -11;
  dash_distance: number = 15;
  dash_distancez: number = 3.750000;
  rowing_height: number = -2.000000;
  rowing_distance: number = 5;
  wvx_f: number = 0.5;
  wvy_f: number = -0.5;
  wvz_f: number = 1;
  whirlwind_vy_max: number = 4;
  whirlwind_acc_y: number = 1;
  whirlwind_acc_x: number = 0.5;
  whirlwind_acc_z: number = 0.5;
  outline_enabled: number = 1;
  entity_flags: number = 0;
  bg_flags: number = 0;
  UPS: number = 60;
  playrate: number = 1;
  atom_time: number = 1;
  [CheatEnum.GIM_INK]: number = 0;
  [CheatEnum.HERO_FT]: number = 0;
  [CheatEnum.LF2_NET]: number = 0;
  toughness_r_value: number = 1;

  constructor(pure: boolean = false) {
    if (!pure) {
      make_private_properties(
        `${WorldDataset.TAG}::constructor`, this,
        (key) => world_dataset_fields.has(key as keyof IWorldDataset),
        (...args) => this.on_dataset_change?.(...args)
      )
      Object.assign(this, wdataset)
    }
  }
  on_dataset_change?: (k: string, curr: any, prev: any) => void;
  dump_dataset() {
    const ret: any = {}
    const keys = Array.from(world_dataset_fields.keys()).sort()
    for (const k of keys) ret[k] = this[k];
    return ret as IWorldDataset;
  }
}