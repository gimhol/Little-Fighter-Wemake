import { FacingFlag as FF, type IFrameInfo, ItrKind, SE, StateEnum, type TNextFrame, WeaponEnum as WT } from "../defines";
import { ActionType } from "../defines/actions/ActionType";
import { BdyKind } from "../defines/BdyKind";
import { EntityEnum } from "../defines/EntityEnum";
import { EntityVal as EV } from "../defines/EntityVal";
import type { IDatContext } from "../defines/IDatContext";
import type { IEntityData } from "../defines/IEntityData";
import type { IFrameIndexes } from "../defines/IFrameIndexes";
import type { INextFrame } from "../defines/INextFrame";
import { ensure, foreach } from "../utils";
import { take_number } from "../utils/container_help/take_number";
import { traversal } from "../utils/container_help/traversal";
import { is_num, is_str } from "../utils/type_check";
import { CondMaker } from "./CondMaker";
import { FrameEditing } from "./FrameEditing";
import { cook_file_variants } from "./cook_file_variants";
import { cook_next_frame_cost } from "./cook_next_frame_cost";
import { add_next_frame, edit_next_frame } from "./edit_next_frame";
import {
  get_next_frame_by_raw_id,
} from "./get_the_next";
import { hit_next_frame } from "./hit_next_frame";
import { make_frame_state } from "./make_frame_state";
import { take } from "./take";
import { take_raw_frame_mp } from "./take_raw_frame_mp";
const k_9 = ["Fa", "Fj", "Da", "Dj", "Ua", "Uj", "ja"] as const;

export function make_fighter_data(ctx: IDatContext): IEntityData {
  const { base, frames, index: datIndex } = ctx
  const walking_frame_rate = take_number(base, "walking_frame_rate", 3);
  const running_frame_rate = take_number(base, "running_frame_rate", 3);
  const walking_speed = take_number(base, "walking_speed", 0);
  const walking_speedz = take_number(base, "walking_speedz", 0);
  const running_speed = take_number(base, "running_speed", 0);
  const running_speedz = take_number(base, "running_speedz", 0);
  const heavy_walking_speed = take_number(base, "heavy_walking_speed", 0);
  const heavy_walking_speedz = take_number(base, "heavy_walking_speedz", 0);
  const heavy_running_speed = take_number(base, "heavy_running_speed", 0);
  const heavy_running_speedz = take_number(base, "heavy_running_speedz", 0);
  const round_trip_frames_map: any = {};
  const frame_mp_hp_map = new Map<string, { mp: number, hp: number }>();

  traversal(frames, (frame_id, frame) => {
    frame_mp_hp_map.set(frame_id, take_raw_frame_mp(frame));
  });

  for (const [frame_id, frame] of traversal(frames)) {
    if (Array.isArray(frame.next)) {
      for (const n of frame.next)
        cook_next_frame_cost(n, "next", frame_mp_hp_map);
    } else {
      cook_next_frame_cost(frame.next, "next", frame_mp_hp_map);
    }

    const editing = new FrameEditing(frame, frame_mp_hp_map);
    const hit_a = take(frame, "hit_a");
    const hit_j = take(frame, "hit_j");
    const hit_d = take(frame, "hit_d");

    if (hit_a) editing.hit('a', hit_a)
    if (hit_j) editing.hit('j', hit_j)
    if (hit_d) editing.hit('d', hit_d)

    k_9.forEach((k) => {
      const next = take(frame, `hit_${k}`);
      if (!is_str(next) && !is_num(next)) return;
      if (next === "0" || next === 0) return;
      editing.seq(k, next);
    });

    switch (Number(frame.id)) {
      /** standing */
      case 0: case 1: case 2: case 3: case 4: break;
      /** walking */
      case 5: case 6: case 7: case 8: {
        editing.hit('a', {
          // weapon throw
          id: "45", facing: FF.Ctrl, desc: "weapon throw",
          mp_mode: 1,
          expression: new CondMaker<EV>()
            .add(EV.Holding_W_Type, "==", WT.Baseball)
            .or(c => c
              .add(EV.Holding_W_Type, "==", WT.Knife)
              .and(EV.PressFB, "!=", 0),
            ).done(),
        }, { // weapon swing
          id: ["20", "25"], facing: FF.Ctrl, desc: "weapon swing",
          mp_mode: 1,
          expression: new CondMaker<EV>()
            .one_of(EV.Holding_W_Type, WT.Knife, WT.Stick)
            .done(),
        },
          ...hit_next_frame.drink(),
          ...hit_next_frame.super_punch(),
          ...hit_next_frame.punch())
          .hit('j', "210") // jump
          .hit('d', "110") // defend
          .keydown('j', "210") // jump
          .keydown('d', "110") // defend
          .hit('FF', "running_0")
        frame.dvx = walking_speed;
        frame.dvz = walking_speedz;
        frame.ctrl_z = 1;
        frame.ctrl_x = 1;
        break;
      }
      /** running */
      case 9: case 10: case 11: {
        editing.hit('a', {
          // 丢出武器
          id: "45",
          expression: new CondMaker<EV>()
            .add(EV.Holding_W_Type, "==", WT.Baseball)
            .or(c => c
              .add(EV.PressFB, "==", 1)
              .and(EV.Holding_W_Type, "!=", WT.None),
            ).done(),
        }, ...hit_next_frame.drink(), {
          id: "35",
          expression: new CondMaker<EV>()
            .one_of(EV.Holding_W_Type, WT.Knife, WT.Stick)
            .done()
        }, { // run_atk
          id: "85"
        }).hit('j', "213") // dash
          .hit('d', "102") // rowing
          .hit('B', "218") // running_stop
          .keydown('j', "213")
          .keydown('d', "102")
          .keydown('B', "218")
        frame.dvx = running_speed;
        frame.dvz = running_speedz;
        frame.ctrl_z = 1;
        break;
      }
      /** heavy_obj_walk */
      case 12: case 13: case 14: case 15: {
        editing
          .hit('FF', 'heavy_obj_run_0')
          .hit('a', { id: "50", facing: FF.Ctrl })
        frame.dvx = heavy_walking_speed;
        frame.dvz = heavy_walking_speedz;
        frame.ctrl_x = frame.ctrl_z = 1;
        break;
      }
      /** heavy_obj_run */
      case 16: case 17: case 18: {
        editing
          .hit('a', '50') // throw
          .hit('B', '19') // running_stop
          .keydown('a', '50') // throw
          .keydown('B', '19') // running_stop
        frame.dvx = heavy_running_speed;
        frame.dvz = heavy_running_speedz;
        frame.ctrl_z = 1;
        break;
      }
      /*
        defend 110
        defend_hit 111
       */
      case 110: case 111: {
        if (frame.bdy?.length)
          for (const bdy of frame.bdy) {
            bdy.actions = ensure(bdy.actions,
              { type: ActionType.V_BROKEN_DEFEND, data: { id: "112" } },
              { type: ActionType.V_DEFEND, data: { id: "111" } }
            );
          }
        break;
      }
      /** broken_defend */
      case 112: { break; }
      /** jump */
      case 210: case 211: case 212: {
        if (frame_id === "211") frame.jump_flag = 1;
        if (frame_id === "212") add_key_down_jump_atk(frame); // jump_atk
        break;
      }
      /** dash */
      case 213: case 214:
      case 216: case 217: {
        if (frame_id === "213" && frames[214]) hit_next_frame.turn_back(frame, "214"); // turn back;
        if (frame_id === "216" && frames[217]) hit_next_frame.turn_back(frame, "217"); // turn back;
        if (frame_id === "214" && frames[213]) hit_next_frame.turn_back(frame, "213"); // turn back;
        if (frame_id === "217" && frames[216]) hit_next_frame.turn_back(frame, "216"); // turn back;
        // julian和knight的dash非常特殊……
        if (frame.state === StateEnum.Dash && (frame_id === "213" || frame_id === "216")) {
          editing.keydown('a', {
            id: "52", facing: FF.Ctrl,
            expression: new CondMaker<EV>()
              .one_of(
                EV.Holding_W_Type,
                WT.Baseball,
                WT.Drink,
              )
              .done(),
          }, {
            id: "40", facing: FF.Ctrl,
            expression: new CondMaker<EV>()
              .one_of(
                EV.Holding_W_Type,
                WT.Knife,
                WT.Stick,
              ).done(),
          }, { id: "90" },
          ); // dash_atk
        }
        if (frame.state === StateEnum.Jump) {
          add_key_down_jump_atk(frame)
          frame.state = StateEnum.Dash
        }
        break;
      }

      /** catching */
      case 120: case 121: case 122: case 123:
        if (frame.cpoint) {
          if (frame.cpoint.vaction)
            (frame.cpoint?.vaction as INextFrame).facing =
              FF.OpposingCatcher;
          const a_action = take(frame.cpoint, "aaction");
          const t_action = take(frame.cpoint, "taction");
          const s_hit_a = frame.hit?.a;
          let t_hit_a: INextFrame[] | undefined;
          let a_hit_a: INextFrame | undefined;
          if (t_action) {
            t_hit_a = [{
              ...get_next_frame_by_raw_id(t_action, 'frame'),
              facing: FF.Ctrl,
              expression: new CondMaker<EV>()
                .add(EV.Catching, "==", 1)
                .and((c) => {
                  return c
                    .add(EV.PressFB, "!=", 0)
                    .or(EV.PressUD, "!=", 0);
                })
                .done(),
            },];
          }
          if (a_action)
            a_hit_a = {
              ...get_next_frame_by_raw_id(a_action, 'frame'),
              expression: new CondMaker<EV>()
                .add(EV.Catching, "==", 1)
                .done(),
            };
          if (Array.isArray(s_hit_a)) {
            t_hit_a && s_hit_a.unshift(...t_hit_a);
            a_hit_a && s_hit_a.unshift(a_hit_a);
          } else {
            let c = 0;
            if (s_hit_a) ++c;
            if (t_hit_a) ++c;
            if (a_hit_a) ++c;
            if (c >= 2) {
              const hit_a: INextFrame[] = [];
              s_hit_a && hit_a.push(s_hit_a);
              t_hit_a && hit_a.push(...t_hit_a);
              a_hit_a && hit_a.push(a_hit_a);
              editing.hit('a', ...hit_a);
            } else if (c === 1) {
              frame.hit = frame.hit || {};
              if (s_hit_a) editing.hit('a', s_hit_a)
              else if (t_hit_a) editing.hit('a', ...t_hit_a);
              else if (a_hit_a) editing.hit('a', a_hit_a);
            }
          }
        }

        break;
      /** throw_lying_man */
      case 232: case 233: case 234:
        if (frame.cpoint?.vaction)
          (frame.cpoint?.vaction as INextFrame).facing =
            FF.OpposingCatcher;
        break;
      case 100:
      case 108:
        // frame.dvy = -rowing_height / frame.wait;
        // frame.dvy = -rowing_height / frame.wait;
        break;
      /** （180~185）falling 向前 */
      case 180:
        break;
      case 181:
      case 182:
        // 受身，预加载时会用，参见preprocess_frame.ts
        if (!frame.hit?.j) editing.hit('j', { id: "100" });
        break;
      case 183:
      case 184:
      case 185:
        break;
      /** （186~191）falling 向后 */
      case 186: break;
      case 187:
      case 188:
        // 受身，预加载时会用，参见preprocess_frame.ts
        if (!frame.hit?.j) editing.hit('j', { id: "108" });
        break;
      case 189:
      case 190:
      case 191:
        break;
      /** crouch */
      case 215:
        editing
          .hit('d', { id: "102", facing: FF.Ctrl })
          .hit('j', { // dash
            id: "214",
            expression: new CondMaker<EV>()
              .add(EV.PressLR, "==", 0)
              .and(EV.TrendX, "==", -1)
              .done(),
          }, { // dash
            id: "213",
            expression: new CondMaker<EV>()
              .add(EV.PressLR, "!=", 0)
              .or(EV.TrendX, '!=', 0)
              .done(),
            facing: FF.Trend,
          })
        break;
      case 200:
        frame.state = StateEnum.Frozen;
        break;
      /** injured */
      case 220:
      case 221:
      case 222:
      case 223:
      case 224:
      case 225: {
        frame.state = StateEnum.Injured;
        const state_name = StateEnum[frame.state!]
        if (state_name) (frame as any).state_name = `StateEnum.${state_name}`
        make_frame_state(frame)
        break;
      }
      /** dizzy */
      case 226: case 227: case 228: case 229: {
        frame.state = StateEnum.Tired;
        const state_name = StateEnum[frame.state!]
        if (state_name) (frame as any).state_name = `StateEnum.${state_name}`
        make_frame_state(frame)
        break;
      }
    }

    switch (frame.state) {
      case StateEnum.Standing:
      case StateEnum.Jump:
      case StateEnum.Defend:
      case StateEnum.Walking:
        hit_next_frame.turn_back(frame)
        break;
    }

    switch (frame.state) {
      case StateEnum.Frozen:
        edit_next_frame(frame.next, (i) => {
          const f = typeof i.id === "string" && frames[i.id];
          if (!f) return;
          if (f.state !== StateEnum.Frozen) {
            i.blink_time = 60;
          }
        });
        break;
      case StateEnum.Standing:
        editing
          .hit("a",
            ...hit_next_frame.weapon_atk(),
            ...hit_next_frame.drink(),
            ...hit_next_frame.super_punch(),
            ...hit_next_frame.punch(),
          )
          .hit('j', ...hit_next_frame.jump())
          .hit('d', ...hit_next_frame.defend())
          .hit('FF', 'running_0')
          .keydown(
            ['U', 'D', 'L', 'R'], // walking
            { id: "walking_0", facing: FF.Ctrl }
          )
        break;
      case StateEnum.BurnRun:
      case StateEnum.Z_Moveable:
        frame.dvz = running_speedz;
        frame.ctrl_z = 1;
        break;
      case StateEnum.Defend: {
        if (frame.bdy?.length)
          for (const bdy of frame.bdy) {
            bdy.kind = BdyKind.Defend;
            bdy.kind_name = BdyKind[bdy.kind];
            if (!bdy.actions?.find(v => v.type === ActionType.V_BROKEN_DEFEND)) {
              bdy.actions = ensure(bdy.actions, {
                type: ActionType.V_BROKEN_DEFEND,
                data: { id: "112" }
              })
            }
          }
        break;
      }
      case StateEnum.Walking:
        /** heavy_obj_walk */
        if (
          frame_id !== "12" &&
          frame_id !== "13" &&
          frame_id !== "14" &&
          frame_id !== "15"
        ) {
          editing
            .hit("a",
              ...hit_next_frame.weapon_atk(),
              ...hit_next_frame.drink(),
              ...hit_next_frame.super_punch(),
              ...hit_next_frame.punch(),
            )
            .hit('j', ...hit_next_frame.jump())
            .hit('d', ...hit_next_frame.defend())
            .hit('FF', 'running_0')
          frame.dvx = walking_speed;
          frame.dvz = walking_speedz;
          frame.ctrl_x = frame.ctrl_z = 1;
          frame.wait = walking_frame_rate * 2 - 1;
        }
        round_trip_frames_map[frame.name] =
          round_trip_frames_map[frame.name] || [];
        round_trip_frames_map[frame.name].push(frame);
        delete frames[frame_id];
        break;
      case StateEnum.Running: {
        /** heavy_obj_run */
        if (frame_id !== "16" && frame_id !== "17" && frame_id !== "18") {
          editing.hit('a', { // run_atk
            // 丢出武器
            id: "45",
            expression: new CondMaker<EV>()
              .add(EV.Holding_W_Type, "==", WT.Baseball)
              .or((v) => v
                .add(EV.PressFB, "==", 1)
                .and(EV.Holding_W_Type, "!=", WT.None),
              ).done(),
          }, ...hit_next_frame.drink(), {
            id: "35", facing: FF.Ctrl,
            expression: new CondMaker<EV>()
              .one_of(
                EV.Holding_W_Type,
                WT.Knife,
                WT.Stick,
              ).done(),
          }, { id: "85" })
            .hit('j', "213") // dash
            .hit('d', "102") // rowing
            .keydown('B', '218') // running_stop
          frame.dvx = running_speed;
          frame.dvz = running_speedz;
          frame.ctrl_z = 1;
          /* 
            NOTE: 
              在原版LF2中，角色走路和跑步是用帧的往返切换来实现的。
              这打破了wait next的规则。
              我不希望打破这个规则。
              从原版数据转换过来时，帮助生成额外的帧来实现相同的效果。
              这样，在WEMAKE中，可以实现更合理的走路和跑步动画。
              
              原版：0 ==> 1 ==> 2 ==> 1 ==>0
              WEMAKE: 0 ==> 1 ==> 2 ==> copy_1 ==> 0
          */
          frame.wait = running_frame_rate * 2 - 1;
        }
        round_trip_frames_map[frame.name] =
          round_trip_frames_map[frame.name] || [];
        round_trip_frames_map[frame.name].push(frame);
        delete frames[frame_id];
        break;
      }
      case StateEnum.LandGoto94: {
        frame.on_landing = { id: "94" };
        break;
      }
    }
  }
  const make_round_trip_frames = (prefix: string, src_frames: IFrameInfo[]) => {
    for (let i = 0; i < 2 * src_frames.length - 2; ++i) {
      const frame =
        i < src_frames.length
          ? src_frames[i]
          : { ...src_frames[2 * (src_frames.length - 1) - i] };
      frame.id = `${prefix}_${i}`;
      frame.next = {
        id: `${prefix}_${i === 2 * src_frames.length - 3 ? 0 : i + 1}`,
      };
      if (
        frame.state === StateEnum.Standing ||
        frame.state === StateEnum.Walking
      ) {
        frame.next.facing = FF.Ctrl
      }
      frames[frame.id] = frame;
    }
  };
  for (const key in round_trip_frames_map)
    make_round_trip_frames(key, round_trip_frames_map[key]);

  const indexes: IFrameIndexes = {
    heavy_obj_walk: "heavy_obj_walk_0",
    ice: "200",
    fire: ["203", "205"],
    injured: {
      [-1]: "220",
      1: "222",
    },
    dizzy: "226",
    lying: {
      [-1]: "230",
      1: "231",
    },
    grand_injured: {
      [-1]: ["220"],
      1: ["222"],
    },
    in_the_skys: ["212"],
    critical_hit: {
      [-1]: ["180"],
      1: ["186"],
    },
    falling: {
      [-1]: ["181", "182", "183"],
      1: ["187", "188", "189"],
    },
    bouncing: {
      [-1]: ["184", "185"],
      1: ["190", "191"],
    },
    landing_1: "215",
    landing_2: "219",
  };

  const ret: IEntityData = {
    id: datIndex.id,
    type: EntityEnum.Fighter,
    base,
    indexes,
    frames,
    processed: false,
  };
  cook_transform_begin_expression_to_hit(ret.frames);
  cook_file_variants(ret);
  if (datIndex.bot) ret.base.bot_id = datIndex.bot
  return ret;
}
function add_key_down_jump_atk(frame: IFrameInfo) {
  frame.key_down = frame.key_down || {}
  frame.key_down.a = add_next_frame(
    frame.key_down.a,
    ...hit_next_frame.jump_atk());
}

function cook_transform_begin_expression_to_hit(frames: Record<string, IFrameInfo>) {
  const tframes = new Map<string, IFrameInfo>();
  foreach(frames, (frame) => {
    if (frame.state == SE.TransformToCatching_Begin) {
      tframes.set(frame.id, frame);
    }
  })

  if (!tframes.size) return;

  const edit_next_frame = (n: TNextFrame | undefined) => {
    if (!n) return;
    n = Array.isArray(n) ? n : [n];
    for (const i of n) {
      if (!i.id) continue;
      if (Array.isArray(i.id)) continue;
      if (!tframes.has(i.id)) continue;
      i.expression = new CondMaker()
        .add(EV.HAS_TRANSFORM_DATA, "==", 1)
        .done();
    }
  };
  foreach(frames, (frame) => {
    foreach(frame.key_down, (n) => edit_next_frame(n));
    foreach(frame.key_up, (n) => edit_next_frame(n));
    foreach(frame.hit, (n) => edit_next_frame(n));
    foreach(frame.seqs, (n) => edit_next_frame(n));
  })
}

