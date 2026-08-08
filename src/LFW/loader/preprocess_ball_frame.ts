import { CondMaker, cook_ball_frame_state_3000, cook_ball_frame_state_3001, cook_ball_frame_state_3005, cook_ball_frame_state_3006 } from "../dat_translator";
import { ActionType, C_Val, EntityEnum, type IEntityData, type IFrameInfo, ItrKind, StateEnum } from "../defines";
import { ensure, foreach } from "../utils";

export function preprocess_ball_frame(frame: IFrameInfo, data: IEntityData) {
  if (frame.itr) {
    for (const itr of frame.itr) {
      if (itr.kind === ItrKind.JohnShield) {
        if (frame.on_dead) {
          itr.actions = ensure(itr.actions, {
            type: ActionType.A_NEXT_FRAME,
            test: new CondMaker<C_Val>()
              .add(C_Val.VictimType, "==", EntityEnum.Fighter)
              .done(),
            data: frame.on_dead
          });
        }
      }
      const hit_sound = data.base.hit_sounds?.[0];
      if (hit_sound &&
        itr.kind !== ItrKind.Whirlwind &&
        itr.kind !== ItrKind.Freeze &&
        itr.kind !== ItrKind.Block &&
        itr.kind !== ItrKind.Heal) {
        itr.actions = ensure(itr.actions, {
          type: ActionType.A_SOUND,
          data: { path: [hit_sound] }
        });
      }
    }
  }
  frame.gravity_enabled = frame.gravity_enabled ?? false;
  switch (frame.state) {
    case StateEnum.Ball_Flying:
      cook_ball_frame_state_3000(data, frame);
      break;
    case StateEnum.Ball_Hitting:
      cook_ball_frame_state_3001(data, frame);
      break;
    case StateEnum.Ball_3005:
      cook_ball_frame_state_3005(data, frame);
      break;
    case StateEnum.Ball_3006:
      cook_ball_frame_state_3006(data, frame);
      break;
  }
  foreach(frame.itr, itr => {
    switch (itr.kind as ItrKind) {
      case ItrKind.Normal:
      case ItrKind.JohnShield:
      case ItrKind.CharacterThrew:
      case ItrKind.WeaponSwing:
        if (data.base.hit_sounds?.length)
          itr.actions = ensure(itr.actions, {
            type: ActionType.A_SOUND,
            data: { path: data.base.hit_sounds }
          });
        break;
    }
  });
}
preprocess_ball_frame.TAG = 'preprocess_ball_frame'