import { useEffect, useState } from "react";
import { useImmer } from "use-immer";
import csses from "./App.module.scss";
import { Button } from "./Component/Buttons/Button";
import CharacterSelect from "./Component/CharacterSelect";
import Combine from "./Component/Combine";
import { InputNumber } from "./Component/Input";
import Select from "./Component/Select";
import Show from "./Component/Show";
import TeamSelect from "./Component/TeamSelect";
import Titled from "./Component/Titled";
import { type IWorldDataset, world_dataset_fields } from "./LFW/defines/IWorldDataset";
import { LFW } from "./LFW";
import { BotController } from "./LFW/bot/BotController";
import { BaseController } from "./LFW/controller/BaseController";
import { InvalidController } from "./LFW/controller/InvalidController";
import { Defines, Difficulty, type IStageInfo, type IStagePhaseInfo } from "./LFW/defines";
import { CMD } from "./LFW/defines/CMD";
import { Entity } from "./LFW/entity/Entity";
import { Stage } from "./LFW/stage/Stage";
import { is_num } from "./LFW/utils/type_check";
import { WorldDatasetView } from "./pages/dev_panel/world_dataset";
import { useLocalNumber, useLocalString } from "./useLocalStorage";
const bot_controllers: { [x in string]?: (e: Entity) => BaseController } = {
  OFF: (e: Entity) => new InvalidController("", e),
  "enemy chaser": (e: Entity) => new BotController("", e),
};

export interface ISettingsRowsProps {
  lf2?: LFW;
  visible?: boolean;
  show_stage_settings?: boolean;
  show_bg_settings?: boolean;
  show_weapon_settings?: boolean;
  show_bot_settings?: boolean;
  show_world_tuning?: boolean;
}

export default function SettingsRows(props: ISettingsRowsProps) {
  const { lf2, visible = true } = props;
  const _stage = lf2?.world.stage;
  const _stage_data = _stage?.data;

  const [stage_list, set_stage_list] = useState<IStageInfo[]>();
  const [bg_id, set_bg_id] = useState(Defines.VOID_BG.id);
  const [stage_id, set_stage_id] = useState(Defines.VOID_STAGE.id);

  const [bgm, set_bgm] = useState<string>(lf2?.sounds.bgm() ?? "");
  const [stage_phase_list, set_stage_phases] = useState<IStagePhaseInfo[]>(
    _stage_data?.phases ?? [],
  );
  const [stage_phase_idx, set_stage_phase_idx] = useState<number>(
    _stage?.phase_idx ?? -1,
  );
  const [difficulty, set_difficulty] = useState<Difficulty>(
    lf2?.world.dataset.difficulty ?? Difficulty.Difficult,
  );
  useEffect(() => {
    set_bgm(lf2?.sounds.bgm() ?? "");
    set_difficulty(lf2?.world.dataset.difficulty ?? Difficulty.Difficult);
    set_stage_list(lf2?.datas.stages);
    const on_stage_change = (stage: Stage | undefined) => {
      set_stage_id(stage?.data.id ?? Defines.VOID_STAGE.id);
      set_bg_id(stage?.bg.data.id ?? Defines.VOID_BG.id);
      set_stage_phases(stage?.data.phases ?? []);
      set_stage_phase_idx(stage?.phase_idx ?? -1);
      stage?.callbacks.add({
        on_phase_changed(stage, curr) {
          set_stage_phase_idx(stage.data.phases?.indexOf(curr!) ?? -1);
        },
      });
    };
    on_stage_change(lf2?.world.stage);

    if (!lf2) return;
    const a = [
      lf2.callbacks.add({
        on_loading_end: () => set_stage_list(lf2.datas.stages),
      }),
      lf2.world.callbacks.add({
        on_stage_change,
        on_dataset_change: (k, v) => {
          if (k === 'difficulty') set_difficulty(v as Difficulty)
        }
      }),
    ];

    return () => a.forEach((b) => b());
  }, [lf2]);

  useEffect(() => {
    if (!lf2) return;
    if (!bgm) lf2.sounds.stop_bgm();
    else lf2.sounds.play_bgm(bgm);
  }, [bgm, lf2]);

  const min_rwn = 1;
  const max_rwn = 100;
  const [rwn, set_rwn] = useLocalNumber<number>("debug_rwn", 10);

  const min_rcn = 1;
  const max_rcn = 100;
  const [rcn, set_rcn] = useLocalNumber<number>("debug_rcn", 10);

  const [weapon_id, set_weapon_id] = useState<string>("");
  const [c_id, set_character_id] = useState<string>("");
  const [team, set_team] = useLocalString<string>("debug_bot_team", "");
  const [bot_ctrl, set_bot_ctrl] = useLocalString<string>("debug_bot_ctrl", "");
  const [dwds, set_dwds] = useImmer<Partial<IWorldDataset>>({})
  const [cwds, set_cwds] = useImmer<Partial<IWorldDataset>>({})
  const [ready, set_ready] = useState(false)



  useEffect(() => {
    if (!lf2) return;
    if (!lf2?.world) return;
    if (!ready) return;
    Object.assign(lf2.world, cwds)
  }, [ready, cwds, lf2])

  useEffect(() => {
    if (!lf2?.world) return;
    set_dwds(d => {
      for (const [k] of world_dataset_fields) {
        const key = k as keyof IWorldDataset;
        d[key] = lf2.world.dataset[key]
      }
    })
    set_cwds(d => {
      for (const [k] of world_dataset_fields) {
        const key = k as keyof IWorldDataset;
        d[key] = lf2.world.dataset[key]
      }
    })
    set_ready(true);
  }, [lf2, set_dwds, set_cwds])

  if (!lf2 || visible === false) return <></>;
  const on_click_add_weapon = () => {
    weapon_id ? lf2.weapons.add(weapon_id, rwn) : lf2.weapons.add_random(rwn);
  };
  const on_click_del_weapon = () => {
    lf2.weapons.all.forEach(v => v.hp = v.hp_r = 0)
  };
  const on_click_add_bot = () => {
    (c_id
      ? lf2.fighters.add(c_id, rcn, team)
      : lf2.fighters.add_random(rcn, team)
    ).forEach((e) => {
      e.name = "bot";
      const controller_creator = bot_controllers[bot_ctrl];
      if (controller_creator) e.ctrl = controller_creator(e);
    });
  };
  const phase_desc = stage_phase_list[stage_phase_idx]?.desc;
  return (
    <>
      <Show.Div
        className={csses.settings_row}
        show={props.show_stage_settings !== false}
      >
        <Titled float_label="关卡">
          <Combine>
            <Select
              value={stage_id}
              onChange={v => lf2.change_stage(v || '')}
              options={stage_list}
              parse={(i) => [i.id!, i.name]}
            />
            {!stage_phase_list.length ? null : (
              <Select
                title={phase_desc}
                onChange={v => set_stage_phase_idx(v!)}
                value={stage_phase_idx}
                options={stage_phase_list}
                parse={(i, idx) => [
                  idx,
                  [`No.${1 + idx}, bound: ${i.bound}`].filter(Boolean).join(" "),
                ]}
              />
            )}
          </Combine>
        </Titled>
        <Combine>
          <Button onClick={() => lf2?.cmds.push(CMD.HERO_FT, '1', CMD.KILL_ENEMIES)}>
            杀死全部敌人
          </Button>
          <Button onClick={() => lf2?.cmds.push(CMD.HERO_FT, '1', CMD.KILL_BOSS)}>
            杀死Boss
          </Button>
          <Button onClick={() => lf2?.cmds.push(CMD.HERO_FT, '1', CMD.KILL_SOLIDERS)}>
            杀死士兵
          </Button>
          <Button onClick={() => lf2?.cmds.push(CMD.HERO_FT, '1', CMD.KILL_OTHERS)}>
            杀死其他
          </Button>
        </Combine>
      </Show.Div>

      <Show.Div className={csses.settings_row} show={props.show_bg_settings !== false}>
        <Titled float_label="背景">
          <Select
            value={bg_id}
            onChange={v => lf2.change_bg(v ?? '')}
            options={lf2.datas.backgrounds}
            parse={(i) => [i.id, i.base.name]}
          />
        </Titled>
        <Titled float_label="难度">
          <Select
            value={difficulty}
            onChange={v => set_difficulty(v!)}
            options={[
              Difficulty.Easy,
              Difficulty.Normal,
              Difficulty.Difficult,
              Difficulty.Crazy,
            ]}
            parse={(i) => [i, Defines.DifficultyLabels[i]]}
          />
        </Titled>
        <Button onClick={(v) => lf2.entities.del_all()}>清场</Button>
      </Show.Div>

      <Show.Div
        className={csses.settings_row}
        show={props.show_weapon_settings !== false}
      >

        <Titled float_label="添加武器">
          <Combine>
            <InputNumber
              placeholder="数量"
              prefix="数量"
              min={min_rwn}
              max={max_rwn}
              step={1}
              value={rwn}
              onChange={(e) => set_rwn(o => e ?? o)}
              onBlur={() =>
                set_rwn((v) =>
                  Math.min(Math.max(Math.floor(v), min_rwn), max_rwn),
                )
              }
            />
            <Select
              value={weapon_id}
              onChange={v => set_weapon_id(v!)}
              options={[0, ...lf2.datas.weapons]}
              parse={i => is_num(i) ? ["", "Random"] : [i.id, i.base.name]} >
            </Select>
            <Button onClick={on_click_add_weapon}>
              添加
            </Button>
            <Button onClick={on_click_del_weapon}>
              移除
            </Button>
          </Combine>
        </Titled>
      </Show.Div>

      <Show.Div
        className={csses.settings_row}
        show={props.show_bot_settings !== false}
      >
        <Titled float_label="添加BOT">
          <Combine>
            <InputNumber
              prefix="数量"
              min={min_rcn}
              max={max_rcn}
              step={1}
              value={rcn}
              onChange={v => set_rcn(o => v ?? o)}
              onBlur={() =>
                set_rcn((v) =>
                  Math.min(Math.max(Math.floor(v), min_rcn), max_rcn),
                )
              }
            />
            <CharacterSelect
              lfw={lf2} value={c_id} onChange={v => set_character_id(v!)} />
            <TeamSelect value={team} onChange={v => set_team(v!)} />
            <Select
              value={bot_ctrl}
              onChange={v => set_bot_ctrl(v!)}
              options={Object.keys(bot_controllers)}
              parse={(i) => [i, i]}
            />
            <Button onClick={on_click_add_bot}>添加</Button>
          </Combine>
        </Titled>
      </Show.Div >

      <Show.Div
        className={csses.settings_row}
        show={props.show_world_tuning !== false}>
        <WorldDatasetView lf2={lf2} />
      </Show.Div>
    </>
  );
}


