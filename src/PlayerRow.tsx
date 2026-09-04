import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./App.module.scss";
import { Button } from "./Component/Buttons/Button";
import { ToggleButton } from "./Component/Buttons/ToggleButton";
import CharacterSelect from "./Component/CharacterSelect";
import Combine from "./Component/Combine";
import { Input } from "./Component/Input";
import Select from "./Component/Select";
import TeamSelect from "./Component/TeamSelect";
import Titled from "./Component/Titled";
import { BaseController, Entity, TeamEnum } from "./LFW";
import { DummyEnum } from "./LFW/bot/DummyEnum";
import { LocalController } from "./LFW/controller/LocalController";
import { CMD } from "./LFW/defines/CMD";
import { GameKey } from "./LFW/defines/GameKey";
import { is_bot_ctrl } from "./LFW/entity/type_check";
import { LFW } from "./LFW";

import { PlayerInfo } from "./LFW/PlayerInfo";
import { useCallbacks } from "./pages/network_test/useCallbacks";
const key_names: Record<GameKey, string> = {
  U: "上", D: "下", L: "左", R: "右", a: "攻", j: "跳", d: "防",
};
const key_name_arr = Object.keys(key_names) as GameKey[];
interface Props {
  lfw: LFW;
  visible?: boolean;
  info: PlayerInfo;
  touch_pad_on?: boolean;
  on_click_toggle_touch_pad?(): void;
}
export function PlayerRow(props: Props) {
  const {
    lfw, info, visible = true, touch_pad_on, on_click_toggle_touch_pad,
  } = props;

  const [keys, set_keys] = useState<Record<GameKey, string>>(info.keys);
  const [name, set_name] = useState<string>(info.name);
  const [editing_key, set_editing_key] = useState<GameKey | undefined>();
  const [team, set_team] = useState<string>();
  const [oid, set_oid] = useState<string>();
  const [puppet, set_puppet] = useState<Entity>()
  const [ctrl, set_ctrl] = useState<BaseController>()
  const [key_settings_show, set_key_settings_show] = useState(false);
  const [dummy, set_dummy] = useState<DummyEnum>(DummyEnum.None)

  useCallbacks(lfw.world.callbacks, {
    on_puppet_add: (pid) => {
      if (pid != info.id) return;
      const p = lfw.world.puppets.get(info.id)
      set_puppet(p)
      set_ctrl(p?.ctrl)
      set_team(p?.team ?? '')
    },
    on_puppet_del: (pid) => {
      if (pid != info.id) return;
      set_puppet(void 0)
      set_ctrl(void 0)
    },
  }, [info])

  useCallbacks(puppet?.callbacks, {
    on_team_changed: (_, value) => set_team(value ?? ''),
    on_ctrl_changed: (value) => set_ctrl(value),
  })
  useEffect(() => {
    const p = lfw.world.puppets.get(info.id)
    set_puppet(p)
    set_team(p?.team ?? '')
    set_ctrl(p?.ctrl)
  }, [lfw, info])
  useEffect(() => {
    if (!puppet) return;
    const ctrl = puppet?.ctrl;
    if (!is_bot_ctrl(ctrl)) return;
    ctrl.dummy = dummy;
  }, [dummy, puppet])

  useCallbacks(info.callbacks, {
    on_key_changed: (name, key) => set_keys((v) => ({ ...v, [name]: key })),
    on_name_changed: (name) => set_name(name)
  })

  useEffect(() => {
    set_keys(info.keys);
    set_name(info.name);
  }, [info, lfw]);

  useEffect(() => {
    if (!editing_key) return;
    const on_keydown = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      e.stopPropagation();
      const key = e.key?.toLocaleLowerCase();
      if (key && key !== "escape") {
        info.set_key(editing_key, e.key.toLowerCase(), true).save();
      }
      set_editing_key(void 0);
    };
    window.addEventListener("keydown", on_keydown, true);
    return () => window.removeEventListener("keydown", on_keydown, true);
  }, [editing_key, info]);

  if (!lfw || visible === false) return null;

  const on_click_toggle = () => {
    if (puppet) { lfw.push_cmd(CMD.DEL_PUPPET, info.id) }
    const _oid = oid ?? lfw.datas.fighters[Math.floor(Math.random() * lfw.datas.fighters.length)]?.id;
    if (!_oid) { debugger; return; }
    lfw.push_cmd(
      CMD.SET_PUPPET,
      `--player_id=${info.id}`,
      `--oid=${_oid}`,
      ...(team ? [`--team=${team}`] : []),
    );
  }
  const { t } = useTranslation()
  return (
    <div className={styles.settings_row}>
      <Titled float_label={t('Player $1').replace('$1', info.id)}>
        <Combine>
          <Input
            prefix={t('Player Name')}
            clearable
            maxLength={50}
            title={t('Enter Player Name')}
            value={name}
            onChange={(e) => info.set_name(e, true)}
            onBlur={(e) => {
              const name = e.target.value.trim() || info.id;
              info.set_name(name, true).save()
              if (puppet) puppet.name = name
            }}
          />
          <CharacterSelect
            lfw={lfw}
            value={oid}
            placeholder={t("Character")}
            onChange={(v) => {
              set_oid(v)
              if (!puppet) return;
              let _oid = v || lfw.datas.fighters[Math.floor(Math.random() * lfw.datas.fighters.length)]?.id
              if (!_oid) return;
              const data = lfw.datas.find_fighter(_oid)
              if (!data) return;
              puppet.transform(data);
            }}
          />
          <TeamSelect
            placeholder={t("Team")}
            value={(team && team in TeamEnum) ? team : TeamEnum.Independent}
            onChange={(v) => {
              set_team(v)
              if (!puppet) return;
              puppet.team = v || lfw.new_team;
            }}
          />
          <Button onClick={on_click_toggle}>{t(puppet ? "Del" : "Add")}</Button>
          <ToggleButton value={touch_pad_on} onClick={on_click_toggle_touch_pad}>
            <>{t('TouchPad')}</>
            <>{t('TouchPad')}✓</>
          </ToggleButton>
        </Combine>
      </Titled>
      <Combine>
        <Button onClick={() => set_key_settings_show((v) => !v)}>{t("Keys")}</Button>
        {!key_settings_show
          ? null
          : key_name_arr.map((k) => {
            const on_click = () =>
              set_editing_key((v) => (v === k ? void 0 : k));
            const name = key_names[k];
            const value = editing_key === k ? "编辑中..." : keys[k];
            return (
              <Button key={k} onClick={on_click}>
                {name}:{" "}
                {{
                  ARROWUP: "↑",
                  ARROWDOWN: "↓",
                  ARROWLEFT: "←",
                  ARROWRIGHT: "→",
                  DELETE: "DEL",
                  PAGEDOWN: "P↓",
                  PAGEUP: "P↑",
                }[value.toUpperCase()] || value.toUpperCase()}
              </Button>
            );
          })}
      </Combine>
      {
        !puppet ? null :
          <Combine>
            <Button
              onClick={() => {
                if (is_bot_ctrl(ctrl)) puppet.ctrl = new LocalController(info.id, puppet);
                else puppet.ctrl = puppet.lfw.factory.create_ctrl(puppet.data.id, info.id, puppet);
              }}>
              {is_bot_ctrl(ctrl) ? <>Bot√</> : <>Bot</>}
            </Button>
            <Select
              options={Object.keys(DummyEnum)}
              parse={(k) => k ? [(DummyEnum as any)[k], k] : ["", "not dummy"]}
              value={dummy}
              onChange={v => set_dummy(v)}
            />
          </Combine>
      }
    </div>
  );


}
