import classNames from "classnames";
import { Fragment, useEffect, useRef, useState } from "react";
import type { LFW } from "./LFW";
import type { PlayerInfo } from "./LFW/PlayerInfo";
import { CtrlDevice } from "./LFW/defines/CtrlDevice";
import { GameKey } from "./LFW/defines/GameKey";
import { SyncRenderEnum } from "./LFW/defines/SyncRenderEnum";
import { Defines } from "./LFW/defines/defines";
import { NICKNAME_MAX_LENGTH } from "./Net";
import { current_connection } from "./Net/current_connection";
import { useNickname } from "./pages/network_test/nickname_store";
import csses from "./NetSettings.module.scss";

const PLAYER_IDS = ["1", "2", "3", "4"];
const KEY_ROWS: GameKey[] = [GameKey.U, GameKey.D, GameKey.L, GameKey.R, GameKey.a, GameKey.j, GameKey.d];
const KEY_I18N: Record<GameKey, string> = {
  [GameKey.U]: "ctrl_settings.key_up",
  [GameKey.D]: "ctrl_settings.key_down",
  [GameKey.L]: "ctrl_settings.key_left",
  [GameKey.R]: "ctrl_settings.key_right",
  [GameKey.a]: "ctrl_settings.key_attack",
  [GameKey.j]: "ctrl_settings.key_jump",
  [GameKey.d]: "ctrl_settings.key_defend",
};

const CTRL_ICON_PATHS = [
  "sprite/CS6.png",
  "sprite/CS2.png",
  "sprite/CS3.png",
  "sprite/CS4.png",
  "sprite/CS5.png",
  "sprite/CS7.png",
];
const RENDER_RATE_OPTIONS = [
  SyncRenderEnum.Half,
  SyncRenderEnum.Sync,
  SyncRenderEnum.FPS_60,
  SyncRenderEnum.FPS_120,
  SyncRenderEnum.Unlimited,
];
const RENDER_RATE_ITEMS = ["sync_1", "sync_2", "sync_3", "sync_4", "sync_0"];
const LANG_CODES = ["", "zh-hans", "zh-hant", "de", "es", "fr", "hu", "it", "ja", "ko", "nl", "pl", "pt", "ro", "ru"];
const LANG_ITEMS = LANG_CODES.map((v) => (v ? `lang.${v}` : "lang.en"));

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

function set_sync_render(lfw: LFW, v: SyncRenderEnum) {
  lfw.world.dataset.sync_render = v;
}

function toggle_team_outline(lfw: LFW) {
  lfw.world.dataset.outline_enabled = lfw.world.dataset.outline_enabled ? 0 : 1;
}

function HSlider(props: { value: number; onChange(v: number): void }) {
  const { value, onChange } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, set_dragging] = useState(false);
  const value_from_x = (client_x: number) => {
    const el = ref.current;
    if (!el) return value;
    const r = el.getBoundingClientRect();
    return r.width > 0 ? clamp((client_x - r.x) / r.width, 0, 1) : value;
  };
  const pct = Math.round(clamp(value, 0, 1) * 100);
  return (
    <div
      ref={ref}
      className={classNames(csses.slider, { [csses.dragging]: dragging })}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        set_dragging(true);
        onChange(value_from_x(e.clientX));
      }}
      onPointerMove={(e) => { if (dragging) onChange(value_from_x(e.clientX)); }}
      onPointerUp={() => set_dragging(false)}
      onPointerCancel={() => set_dragging(false)}
      onLostPointerCapture={() => set_dragging(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={csses.slider_handle} style={{ left: `clamp(22px, ${pct}%, calc(100% - 22px))` }}>{pct}</div>
    </div>
  );
}

function key_text(player: PlayerInfo | undefined, gk: GameKey): string {
  if (!player) return "None";
  const kc = player.keys[gk]?.toUpperCase();
  return Defines.SHORT_KEY_CODES[kc] || kc || "None";
}

export function NetSettings(props: { lfw: LFW; on_close(): void }) {
  const { lfw, on_close } = props;
  const [tab, set_tab] = useState<"ctrl" | "misc">("ctrl");
  const [editing, set_editing] = useState<{ pid: string; key: GameKey }>();
  const [ctrl_icons, set_ctrl_icons] = useState<string[]>([]);
  const [stats_visible, set_stats_visible] = useState(false);
  const [, force_update] = useState(0);
  const [nickname, set_nickname] = useNickname();

  useEffect(() => {
    const bump = () => force_update((v) => v + 1);
    const handler = { on_key_changed: bump, on_name_changed: bump, on_ctrl_changed: bump };
    const watched: PlayerInfo[] = [];
    for (const pid of PLAYER_IDS) {
      const player = lfw.players.get(pid);
      if (!player) continue;
      watched.push(player);
      player.callbacks.add(handler);
    }
    return () => {
      for (const player of watched) player.callbacks.del(handler);
    };
  }, [lfw]);

  useEffect(() => {
    const bump = () => force_update((v) => v + 1);
    const sounds_handler = {
      on_volume_changed: bump,
      on_bgm_volume_changed: bump,
      on_sound_volume_changed: bump,
      on_bgm_muted_changed: bump,
      on_sound_muted_changed: bump,
    };
    const world_handler = { on_dataset_change: bump };
    const lfw_handler = {
      on_lang_changed: bump,
      on_broadcast: (msg: string) => {
        if (msg === "stats_visible:1") set_stats_visible(true);
        else if (msg === "stats_visible:0") set_stats_visible(false);
      },
    };
    lfw.sounds.callbacks.add(sounds_handler);
    lfw.world.callbacks.add(world_handler);
    lfw.callbacks.add(lfw_handler);
    lfw.broadcast("stats_visible_get");
    return () => {
      lfw.sounds.callbacks.del(sounds_handler);
      lfw.world.callbacks.del(world_handler);
      lfw.callbacks.del(lfw_handler);
    };
  }, [lfw]);

  useEffect(() => {
    if (!editing) return;
    const { pid, key } = editing;
    const on_key_down = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      e.stopPropagation();
      const k = e.key?.toLowerCase();
      if (k && k !== "escape") lfw.players.get(pid)?.set_key(key, k, true).save();
      set_editing(void 0);
    };
    const on_pointer_down = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest(`[data-cell="${pid}:${key}"]`)) return;
      set_editing(void 0);
    };
    window.addEventListener("keydown", on_key_down, true);
    window.addEventListener("pointerdown", on_pointer_down, true);
    return () => {
      window.removeEventListener("keydown", on_key_down, true);
      window.removeEventListener("pointerdown", on_pointer_down, true);
    };
  }, [editing, lfw]);

  useEffect(() => {
    let alive = true;
    Promise.all(
      CTRL_ICON_PATHS.map((path) =>
        lfw.resources.import_resource(path, false).then((r) => r.data).catch(() => "")
      )
    ).then((urls) => { if (alive) set_ctrl_icons(urls); });
    return () => { alive = false; };
  }, [lfw]);

  const cycle_ctrl = (pid: string, dir: -1 | 1) => {
    const player = lfw.players.get(pid);
    if (!player) return;
    const ctrl = (((player.ctrl + dir) % 6) + 6) % 6 as CtrlDevice;
    if (ctrl === CtrlDevice.TouchScreen) {
      for (const [, p] of lfw.players) {
        if (p === player) continue;
        if (p.ctrl !== CtrlDevice.TouchScreen) continue;
        p.set_ctrl(CtrlDevice.Keyboard, true).save();
      }
    }
    player.set_ctrl(ctrl, true).save();
  };

  const lang_index = Math.max(0, LANG_CODES.indexOf(lfw.canonical_lang()));
  const render_index = Math.max(0, RENDER_RATE_OPTIONS.indexOf(lfw.world.dataset.sync_render));
  const owner = !current_connection.driver || current_connection.driver.is_owner();

  const step_lang = (dir: -1 | 1) =>
    lfw.set_lang(LANG_CODES[(lang_index + dir + LANG_CODES.length) % LANG_CODES.length]);
  const step_render = (dir: -1 | 1) => {
    set_sync_render(
      lfw,
      RENDER_RATE_OPTIONS[(render_index + dir + RENDER_RATE_OPTIONS.length) % RENDER_RATE_OPTIONS.length]
    );
  };

  return (
    <div className={csses.mask} onClick={on_close}>
      <div className={csses.panel} onClick={(e) => e.stopPropagation()}>
        <div className={csses.tabs}>
          <button
            className={classNames(csses.tab, { [csses.active]: tab === "ctrl" })}
            onClick={() => { set_tab("ctrl"); set_editing(void 0); }}
          >
            {lfw.string("ctrl_settings")}
          </button>
          <button
            className={classNames(csses.tab, { [csses.active]: tab === "misc" })}
            onClick={() => { set_tab("misc"); set_editing(void 0); }}
          >
            {lfw.string("misc_settings")}
          </button>
          <button className={csses.close} onClick={on_close}>✕</button>
        </div>
        {tab === "ctrl" && (
        <div className={csses.grid}>
          <div />
          {PLAYER_IDS.map((pid) => {
            const player = lfw.players.get(pid);
            return (
              <input
                key={pid}
                className={csses.name_input}
                defaultValue={player?.name ?? pid}
                maxLength={10}
                onBlur={(e) => lfw.players.get(pid)?.set_name(e.target.value, true).save()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") e.currentTarget.blur();
                  else if (e.key === "Escape") {
                    e.currentTarget.value = lfw.players.get(pid)?.name ?? pid;
                    e.currentTarget.blur();
                  }
                }}
                onKeyUp={(e) => e.stopPropagation()}
              />
            );
          })}
          <div className={csses.label} />
          {PLAYER_IDS.map((pid) => {
            const player = lfw.players.get(pid);
            const ctrl = player?.ctrl ?? CtrlDevice.Keyboard;
            const icon = ctrl_icons[ctrl];
            return (
              <div
                key={pid}
                className={csses.ctrl_cell}
                onClick={() => cycle_ctrl(pid, 1)}
                onContextMenu={(e) => { e.preventDefault(); cycle_ctrl(pid, -1); }}
              >
                {icon ? <img className={csses.ctrl_icon} src={icon} draggable={false} /> : null}
              </div>
            );
          })}
          {KEY_ROWS.map((gk) => (
            <Fragment key={gk}>
              <div className={csses.label}>{lfw.string(KEY_I18N[gk])}</div>
              {PLAYER_IDS.map((pid) => {
                const player = lfw.players.get(pid);
                const text = key_text(player, gk);
                const is_editing = editing?.pid === pid && editing?.key === gk;
                return (
                  <div
                    key={pid}
                    data-cell={`${pid}:${gk}`}
                    className={classNames(csses.cell, {
                      [csses.editing]: is_editing,
                      [csses.empty]: text === "None",
                    })}
                    onClick={() =>
                      set_editing((cur) =>
                        cur?.pid === pid && cur?.key === gk ? void 0 : { pid, key: gk }
                      )
                    }
                  >
                    {text}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
        )}
        {tab === "misc" && (
        <>
          <div className={csses.misc_row}>
            <div className={csses.misc_label}>{lfw.string("nickname")}</div>
            <input
              className={classNames(csses.name_input, csses.misc_input)}
              value={nickname}
              maxLength={NICKNAME_MAX_LENGTH}
              onChange={(e) => set_nickname(e.target.value)}
              onBlur={() => {
                const conn = current_connection.conn;
                if (conn && conn.nickname !== nickname) conn.set_nickname(nickname);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              onKeyUp={(e) => e.stopPropagation()}
            />
          </div>
          <div className={csses.misc_row}>
            <div className={csses.misc_label}>{lfw.string("language")}</div>
            <div className={csses.switcher}>
              <button className={csses.arrow} onClick={() => step_lang(-1)}>◀</button>
              <div className={csses.switcher_label}>{lfw.string(LANG_ITEMS[lang_index])}</div>
              <button className={csses.arrow} onClick={() => step_lang(1)}>▶</button>
            </div>
          </div>
          <div className={csses.misc_row}>
            <div className={csses.misc_label}>{lfw.string("main_volume")}</div>
            <HSlider value={lfw.sounds.volume()} onChange={(v) => lfw.sounds.set_volume(v)} />
          </div>
          <div className={csses.misc_row}>
            <div className={csses.misc_label}>{lfw.string("bgm")}</div>
            <div className={csses.toggle_cell} onClick={() => lfw.sounds.set_bgm_muted(!lfw.sounds.bgm_muted())}>
              {lfw.string(lfw.sounds.bgm_muted() ? "disable" : "enable")}
            </div>
          </div>
          <div className={csses.misc_row}>
            <div className={csses.misc_label}>{lfw.string("bgm_volume")}</div>
            <HSlider value={lfw.sounds.bgm_volume()} onChange={(v) => lfw.sounds.set_bgm_volume(v)} />
          </div>
          <div className={csses.misc_row}>
            <div className={csses.misc_label}>{lfw.string("sfx")}</div>
            <div className={csses.toggle_cell} onClick={() => lfw.sounds.set_sound_muted(!lfw.sounds.sound_muted())}>
              {lfw.string(lfw.sounds.sound_muted() ? "disable" : "enable")}
            </div>
          </div>
          <div className={csses.misc_row}>
            <div className={csses.misc_label}>{lfw.string("sfx_volume")}</div>
            <HSlider value={lfw.sounds.sound_volume()} onChange={(v) => lfw.sounds.set_sound_volume(v)} />
          </div>
          <div className={csses.misc_row}>
            <div className={csses.misc_label}>{lfw.string("team_outline")}</div>
            <div
              className={classNames(csses.toggle_cell, { [csses.disabled]: !owner })}
              onClick={() => {
                if (!owner) return;
                toggle_team_outline(lfw);
              }}
            >
              {lfw.string(lfw.world.dataset.outline_enabled ? "enable" : "disable")}
            </div>
          </div>
          <div className={csses.misc_row}>
            <div className={csses.misc_label}>{lfw.string("render_fps")}</div>
            <div className={csses.switcher}>
              <button className={csses.arrow} onClick={() => step_render(-1)}>◀</button>
              <div className={csses.switcher_label}>{lfw.string(RENDER_RATE_ITEMS[render_index])}</div>
              <button className={csses.arrow} onClick={() => step_render(1)}>▶</button>
            </div>
          </div>
          <div className={csses.misc_row}>
            <div className={csses.misc_label}>{lfw.string("stats_visible")}</div>
            <div
              className={csses.toggle_cell}
              onClick={() => lfw.broadcast("stats_visible_set:" + (stats_visible ? 0 : 1))}
            >
              {lfw.string(stats_visible ? "enable" : "disable")}
            </div>
          </div>
        </>
        )}
      </div>
    </div>
  );
}
