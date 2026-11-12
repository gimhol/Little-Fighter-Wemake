/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-empty-object-type */
import { round } from "../utils";
import { CheatEnum } from "./CheatType";
import { Difficulty } from "./Difficulty";
import { FacingFlag } from "./FacingFlag";
import { FrameId } from "./FrameId";
import { GK, type GameKey } from "./GameKey";
import type { IBgData } from "./IBgData";
import type { INextFrame } from "./INextFrame";
import type { IPairByFace } from "./IPairByFace";
import type { IStageInfo } from "./IStageInfo";
import { StageGroup as SG } from "./StageGroup";
import { TeamEnum as _TeamEnum } from "./TeamEnum";
import { WT } from "./WeaponType";

/** TFrameIdPair 是否有点蠢？ */
export interface TFrameIdPair extends IPairByFace<string> { }
/** TFrameIdListPair 是否有点蠢？ */
export interface TFrameIdListPair extends IPairByFace<string[]> { }
export type TFace = -1 | 1;
export type TTrend = -1 | 0 | 1;
export namespace Defines {
  export const DATA_VERSION = 20
  export const TeamEnum = _TeamEnum;
  export type TeamEnum = _TeamEnum;
  export const CLASSIC_SCREEN_WIDTH = 794;
  export const CLASSIC_SCREEN_HEIGHT = 550;
  /**
   * UI / 关卡作者坐标系的安全区尺寸
   *
   * 逻辑视口（world.dataset.screen_w/screen_h）可以随比例向外扩，
   * 但安全区始终完整可见；UI 页面按这个尺寸排版并在视口中居中。
   */
  export const SAFE_SCREEN_WIDTH = 794;
  export const SAFE_SCREEN_HEIGHT = 450;
  export const MODERN_SCREEN_WIDTH = SAFE_SCREEN_WIDTH;
  export const MODERN_SCREEN_HEIGHT = SAFE_SCREEN_HEIGHT;
  /**
   * 按目标宽高比生成逻辑视口，保证安全区完整可见：只向外扩，不裁剪安全区。
   *
   * 例：16:9 → 800×450；4:3 → 794×596；21:9 → 1050×450。
   */
  export function viewport_from_aspect(aspect: number): { w: number; h: number } {
    if (!(aspect > 0)) return { w: SAFE_SCREEN_WIDTH, h: SAFE_SCREEN_HEIGHT };
    return {
      w: Math.max(SAFE_SCREEN_WIDTH, Math.round(SAFE_SCREEN_HEIGHT * aspect)),
      h: Math.max(SAFE_SCREEN_HEIGHT, Math.round(SAFE_SCREEN_WIDTH / aspect)),
    };
  }
  /** 解析 `16:9` / `21:9` / `1.7778` 形式的宽高比；无效返回 undefined */
  export function parse_aspect(value: unknown): number | undefined {
    if (typeof value !== "string") return undefined;
    const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
    let aspect: number;
    if (m) {
      const a = parseFloat(m[1]);
      const b = parseFloat(m[2]);
      if (!(a > 0) || !(b > 0)) return undefined;
      aspect = a / b;
    } else {
      aspect = parseFloat(value);
    }
    if (!Number.isFinite(aspect) || aspect < 0.5 || aspect > 4) return undefined;
    return aspect;
  }
  /** 渲染分辨率预设（渲染缓冲的像素尺寸；w/h 都为 0 表示跟随画布显示尺寸） */
  export interface IRenderResolutionPreset {
    w: number;
    h: number;
    /** 展示名：i18n key 或字面量 */
    label: string;
  }
  /** 默认按逻辑分辨率的 4 倍渲染（与历史行为一致） */
  export const DEFAULT_RENDER_RESOLUTION: Readonly<IRenderResolutionPreset> = {
    w: MODERN_SCREEN_WIDTH * 4,
    h: MODERN_SCREEN_HEIGHT * 4,
    label: `${MODERN_SCREEN_WIDTH * 4}×${MODERN_SCREEN_HEIGHT * 4}`,
  };
  /**
   * 渲染分辨率预设
   *
   * 只改渲染缓冲的像素多少，逻辑视口（screen_w/screen_h）与世界范围不变，
   * 因此 UI / 角色 / 背景比例都不会变，只是清晰度与性能不同。
   *
   * 顺序须与 `ui/settings_misc.ui.json5` 的 `render_resolution_row.items` 一致。
   */
  export const RENDER_RESOLUTION_PRESETS: readonly IRenderResolutionPreset[] = [
    { w: 0, h: 0, label: "render_resolution_auto" },
    { w: MODERN_SCREEN_WIDTH, h: MODERN_SCREEN_HEIGHT, label: `${MODERN_SCREEN_WIDTH}×${MODERN_SCREEN_HEIGHT}` },
    { w: 1280, h: 720, label: "1280×720" },
    { w: MODERN_SCREEN_WIDTH * 2, h: MODERN_SCREEN_HEIGHT * 2, label: `${MODERN_SCREEN_WIDTH * 2}×${MODERN_SCREEN_HEIGHT * 2}` },
    { w: 1920, h: 1080, label: "1920×1080" },
    { w: MODERN_SCREEN_WIDTH * 3, h: MODERN_SCREEN_HEIGHT * 3, label: `${MODERN_SCREEN_WIDTH * 3}×${MODERN_SCREEN_HEIGHT * 3}` },
    { ...DEFAULT_RENDER_RESOLUTION },
  ];
  /** 当前 w/h 匹配的预设下标（不匹配时返回 -1） */
  export function render_resolution_index(w: number, h: number): number {
    return RENDER_RESOLUTION_PRESETS.findIndex((v) => v.w === w && v.h === h);
  }
  export const DEFAULT_OPOINT_SPEED_Z = 3.5;
  export const DEFAULT_FIREN_FLAME_SPEED_Z = 0.5;
  export const WT_BOUNCE_MIN_Y: Record<WT, number> = {
    [WT.None]:     /**/ 2,
    [WT.Stick]:    /**/ 2,
    [WT.Heavy]:    /**/ 2,
    [WT.Knife]:    /**/ 2,
    [WT.Baseball]: /**/ 1,
    [WT.Drink]:    /**/ 1,
  }
  export const WT_BOUNCE_MIN_X: Record<WT, number> = {
    [WT.None]:     /**/ 99,
    [WT.Stick]:    /**/ 99,
    [WT.Heavy]:    /**/ 2,
    [WT.Knife]:    /**/ 99,
    [WT.Baseball]: /**/ 2,
    [WT.Drink]:    /**/ 2,
  }
  export const WT_BOUNCE_MIN_Z: Record<WT, number> = {
    [WT.None]:     /**/ 99,
    [WT.Stick]:    /**/ 99,
    [WT.Heavy]:    /**/ 99,
    [WT.Knife]:    /**/ 99,
    [WT.Baseball]: /**/ 99,
    [WT.Drink]:    /**/ 99,
  }
  export const WT_BOUNCE_Y: Record<WT, number> = {
    [WT.None]:     /**/ 0.5,
    [WT.Stick]:    /**/ 0.2,
    [WT.Heavy]:    /**/ 0.3,
    [WT.Knife]:    /**/ 0.2,
    [WT.Baseball]: /**/ 0.45,
    [WT.Drink]:    /**/ 0.45,
  }
  export const WT_BOUNCE_X: Record<WT, number> = {
    [WT.None]:     /**/ 0.5,
    [WT.Stick]:    /**/ 0.5,
    [WT.Heavy]:    /**/ 0.75,
    [WT.Knife]:    /**/ 0.5,
    [WT.Baseball]: /**/ 0.75,
    [WT.Drink]:    /**/ 0.75,
  }
  export const WT_BOUNCE_Z: Record<WT, number> = {
    [WT.None]:     /**/ 0.5,
    [WT.Stick]:    /**/ 0.5,
    [WT.Heavy]:    /**/ 0.75,
    [WT.Knife]:    /**/ 0.5,
    [WT.Baseball]: /**/ 0.75,
    [WT.Drink]:    /**/ 0.75,
  }
  export const WT_FAST_Y: Record<WT, number> = {
    [WT.None]:     /**/ 99,
    [WT.Stick]:    /**/ 99,
    [WT.Heavy]:    /**/ 1,
    [WT.Knife]:    /**/ 99,
    [WT.Baseball]: /**/ 99,
    [WT.Drink]:    /**/ 99,
  }
  export const WT_FAST_X: Record<WT, number> = {
    [WT.None]:      /**/ 99,
    [WT.Stick]:     /**/ 99,
    [WT.Heavy]:     /**/ 1,
    [WT.Knife]:     /**/ 99,
    [WT.Baseball]:  /**/ 4.5,
    [WT.Drink]:     /**/ 4.5,
  }
  export const WT_FAST_Z: Record<WT, number> = {
    [WT.None]:     /**/ 99,
    [WT.Stick]:    /**/ 99,
    [WT.Heavy]:    /**/ 1,
    [WT.Knife]:    /**/ 99,
    [WT.Baseball]: /**/ 99,
    [WT.Drink]:    /**/ 99,
  }
  /**
   * 默认值：当角色fall_value低于DEFAULT_FALL_VALUE_DIZZY时，角色应当进入眩晕状态
   *
   * @memberof World
   */
  export const DEFAULT_FALL_VALUE_DIZZY = 40;

  /**
   * 默认值：
   */
  export const DEFAULT_FALL_VALUE_CRITICAL: number = 140 - DEFAULT_FALL_VALUE_DIZZY

  export const DAFUALT_QUBE_LENGTH: number = 24;
  export const DAFUALT_QUBE_LENGTH_POW2: number = 576;

  export const DEFAULT_TOUGHNESS_RESTING_MAX: number = 60;

  /**
   * 直接破防值
   */
  export const DEFAULT_FORCE_BREAK_DEFEND_VALUE = 200;

  export const VOID_BG: IBgData = {
    type: "background",
    layers: [],
    id: "VOID_BG",
    base: {
      name: "VOID_BG",
      shadow: "",
      height: CLASSIC_SCREEN_HEIGHT,
      left: 0,
      right: MODERN_SCREEN_WIDTH * 2,
      far: -40,
      near: -0,
      group: [],
      zoom_x: 0.5,
      zoom_y: 0.5,
      zoom_z: 0.5,
      shadow_w: 0,
      shadow_h: 0
    },
  };
  export const RANDOM_BG: IBgData = {
    type: "background",
    layers: [],
    id: "?",
    base: {
      name: "Random",
      shadow: "",
      height: CLASSIC_SCREEN_HEIGHT,
      left: 0,
      right: 794,
      far: -468,
      near: -216,
      group: [],
      shadow_w: 0,
      shadow_h: 0
    },
  };
  export const VOID_STAGE: IStageInfo = {
    bg: VOID_BG.id,
    id: "VOID_STAGE",
    name: "VOID_STAGE",
    phases: [],
    group: [SG.Dev]
  };

  export const NEXT_FRAME_GONE: Readonly<INextFrame> = {
    id: FrameId.Gone,
  };
  export const NEXT_FRAME_AUTO: Readonly<INextFrame> = {
    id: FrameId.Auto,
  };
  export const NEXT_FRAME_SELF: Readonly<INextFrame> = {
    id: FrameId.Self,
  };
  export const NEXT_FRAME_AUTO_BACKWARD: Readonly<INextFrame> = {
    id: FrameId.Auto,
    facing: FacingFlag.Backward,
  };
  export interface ICheatInfo {
    keys: string;
    gkeys: string;
    sound: string;
  }
  export const CheatInfos = new Map<string, ICheatInfo>([
    [CheatEnum.LF2_NET, { keys: "lf2.net", gkeys: [GK.U, GK.U, GK.D, GK.D, GK.L, GK.R, GK.L, GK.R, GK.d, GK.a, GK.d, GK.a].join(''), sound: "data/m_pass.wav.mp3" }],
    [CheatEnum.HERO_FT, { keys: "herofighter.com", gkeys: [GK.U, GK.U, GK.D, GK.D, GK.L, GK.R, GK.L, GK.R, GK.j, GK.a, GK.j, GK.a].join(''), sound: "data/m_end.wav.mp3" }],
    [CheatEnum.GIM_INK, { keys: "gim.ink", gkeys: [GK.U, GK.U, GK.D, GK.D, GK.L, GK.R, GK.L, GK.R, GK.d, GK.j, GK.d, GK.j].join(''), sound: "data/093_r.wav.mp3" }],
  ]);
  export const Sounds = {
    StagePass: "data/m_pass.wav.mp3",
    BattleEnd: "data/m_end.wav.mp3",
  } as const;

  export const DANMU_UID_MARK = 'danmu_uid';

  export const STATE_HEAL_SELF_HP = 104;

  export const DifficultyLabels: Record<Difficulty, string> = {
    [Difficulty.Easy]: "easy",
    [Difficulty.Normal]: "normal",
    [Difficulty.Difficult]: "difficult",
    [Difficulty.Crazy]: "crazy",
  };
  export interface ITeamInfo {
    i18n: string;
    txt_color: string;
    txt_outline_color: string;
    outline_color?: string;
  }

  export interface ITeamInfoMap {
    [TeamEnum.Independent]: ITeamInfo;
    [TeamEnum.Team_1]: ITeamInfo;
    [TeamEnum.Team_2]: ITeamInfo;
    [TeamEnum.Team_3]: ITeamInfo;
    [TeamEnum.Team_4]: ITeamInfo;
    [x: string | number]: ITeamInfo | undefined;
  }
  export const Teams = [
    Defines.TeamEnum.Independent,
    Defines.TeamEnum.Team_1,
    Defines.TeamEnum.Team_2,
    Defines.TeamEnum.Team_3,
    Defines.TeamEnum.Team_4,
  ];
  export const TeamInfoMap: ITeamInfoMap = {
    [TeamEnum.Independent]: {
      i18n: "Independent",
      txt_color: "#ffffff",
      txt_outline_color: "#000000",
    },
    [TeamEnum.Team_1]: {
      i18n: "Team_1",
      txt_color: "#4f9bff",
      txt_outline_color: "#001e46",
      outline_color: "#4f9bff",
    },
    [TeamEnum.Team_2]: {
      i18n: "Team_2",
      txt_color: "#ff4f4f",
      txt_outline_color: "#460000",
      outline_color: "#ff4f4f",
    },
    [TeamEnum.Team_3]: {
      i18n: "Team_3",
      txt_color: "#3cad0f",
      txt_outline_color: "#154103",
      outline_color: "#3cad0f",
    },
    [TeamEnum.Team_4]: {
      i18n: "Team_4",
      txt_color: "#ffd34c",
      txt_outline_color: "#573100",
      outline_color: "#ffd34c",
    },
    [TeamEnum.Team_5]: {
      i18n: "Team_5",
      txt_color: "#ff00bf",
      txt_outline_color: "#2b0020",
      outline_color: "#ff5cd6",
    },
    [TeamEnum.Team_6]: {
      i18n: "Team_6",
      txt_color: "#00ffff",
      txt_outline_color: "#003131",
      outline_color: "#00ffff",
    },
    [TeamEnum.Team_7]: {
      i18n: "Team_7",
      txt_color: "#000000",
      txt_outline_color: "#ff0000",
      outline_color: "#300000",
    },
    [TeamEnum.Team_8]: {
      i18n: "Team_8",
      txt_color: "#000000",
      txt_outline_color: "#ffffff",
      outline_color: "#ffffff",
    },
  };

  export enum BuiltIn_Imgs {
    RFACE = "!sprite/RFACE@4x.png",
    CHARACTER_THUMB = "sprite/CHARACTER_THUMB.png",
  }
  export enum BuiltIn_Dats {
    Spark = "data/spark.obj.json5"
  }
  export enum BuiltIn_Broadcast {
    ResetGPL = "reset_gpl",
    UpdateRandom = "update_random",
    StartGame = "start_game",
    SwitchStage = "switch_stage",
    SwitchStageR = "switch_stage_r",
    SwitchBackground = "switch_background",
    SwitchBackgroundR = "switch_background_r",
    ResetBackground = "reset_background",
  }
  export enum BuiltIn_Sounds {
    Cancel = "cancel",
    End = "end",
    Join = "join",
    Ok = "ok",
    Pass = "pass",
  }
  export type TBuiltIn_Sounds = BuiltIn_Sounds | "cancel" | "end" | "join" | "ok" | "pass"


  export type TKeys = Record<GameKey, string>;
  export const default_keys_map: ReadonlyMap<string, TKeys> = new Map<string, TKeys>([
    ["1", { L: "a", R: "d", U: "w", D: "s", a: "j", j: "k", d: "l" }],
    [
      "2",
      {
        L: "arrowleft",
        R: "arrowright",
        U: "arrowup",
        D: "arrowdown",
        a: "0",
        j: ".",
        d: "enter",
      },
    ],
    ["3", { L: "", R: "", U: "", D: "", a: "", j: "", d: "" }],
    ["4", { L: "", R: "", U: "", D: "", a: "", j: "", d: "" }],
    ["_", { L: "_L", R: "_R", U: "_U", D: "_D", a: "_a", j: "_j", d: "_d" }],
  ]);

  export function get_default_keys(player_id: string): TKeys {
    return default_keys_map.get(player_id) || default_keys_map.get("_")!;
  }
  export const SHORT_KEY_CODES: { [x in string]?: string } = {
    ARROWUP: "↑",
    ARROWDOWN: "↓",
    ARROWLEFT: "←",
    ARROWRIGHT: "→",
    DELETE: "DEL",
    PAGEDOWN: "PG↓",
    PAGEUP: "PG↑",
  }

  export const DEFAULT_BREAK_DEFEND_VALUE = 32;

  export const MAX_AI_DESIRE = 10000 as const;

  export function desire(ratio: number): number {
    return round(Defines.MAX_AI_DESIRE * ratio)
  }

  /**
   * 盔甲生效时，仍扣除多少比例的血
   *
   * @type {number}
   */
  export const DEFAULT_ARMOR_INJURY_RATIO: number = 0.1

  /**
   * 盔甲生效时，攻击方停顿多少比例的时间
   *
   * @type {number}
   */
  export const DEFAULT_ARMOR_MOTIONLESS_RATIO: number = 1.5

  /**
   * 盔甲生效时，受伤方停顿多少比例的时间
   *
   * @type {number}
   */
  export const DEFAULT_ARMOR_SHAKING_RATIO: number = 2

  export const WEAPON_WEIGHT_HEAVY = 1.1;
  export const WEAPON_WEIGHT_ARROW = 0.74;
  export const WEAPON_WEIGHT_HOE = 1;
  export const WEAPON_WEIGHT_NOMRAL = 0.9;
  export const WEAPON_WEIGHT_LIGHT = 0.74;
  export const WEAPON_WEIGHT_BASEBALL = 0.6;

  /**
   * stay下敌人距离多近才追击
   */
  export const AI_STAY_CHASING_RANGE = 200;

  export const AI_COME_RANGE_IN_X = 75;
  export const AI_COME_RANGE_IN_Z = 76;
  export const AI_COME_RANGE_OUT_X = 120;
  export const AI_COME_RANGE_OUT_Z = 120;

  export const AI_FOLLOWING_RANGE_IN_X = 100;
  export const AI_FOLLOWING_RANGE_IN_Z = 100;
  export const AI_FOLLOWING_RANGE_OUT_X = 250;
  export const AI_FOLLOWING_RANGE_OUT_Z = 250;

  export const AI_MAX_CHASINGS_ENEMIES = 1;
  export const AI_MAX_AVOIDING_ENEMIES = 1;
  export const AI_MAX_DEFENDS_ENEMIES = 3;
}