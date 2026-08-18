import { useShortcut } from "@fimagine/dom-hooks";
import classNames from "classnames";
import qs from "qs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import { DomAdapter } from "splittings-dom/dist/es/splittings-dom";
import "splittings-dom/dist/es/splittings-dom.css";
import { Workspaces } from "splittings/dist/es/splittings";
import csses from "./App.module.scss";
import { BgScrollerView } from "./BgScrollerView";
import { Button } from "./Component/Buttons/Button";
import { StatusButton } from "./Component/Buttons/StatusButton";
import { ToggleButton } from "./Component/Buttons/ToggleButton";
import { ToggleImgButton } from "./Component/Buttons/ToggleImgButton";
import Combine from "./Component/Combine";
import { InputNumber } from "./Component/Input";
import Select from "./Component/Select";
import Show from "./Component/Show";
import Titled from "./Component/Titled";
import { DanmuOverlay } from "./DanmuOverlay";
import { DevStatsView } from "./DevStatsView";
import { __Pointings, md5 } from "./DittoImpl";
import { BG_INDICATINGS, ENTITY_INDICATINGS } from "./DittoImpl/renderer/INDICATINGS";
import { WorldRenderer } from "./DittoImpl/renderer/WorldRenderer";
import EditorView from "./EditorView";
import GamePad from "./GamePad";
import { Difficulty, type IWorldDataset, LFW, WorldDataset } from "./LFW";
import { CheatEnum, CtrlDevice } from "./LFW/defines";
import { CMD } from "./LFW/defines/CMD";
import { SyncRenderEnum } from "./LFW/defines/SyncRenderEnum";
import { Defines } from "./LFW/defines/defines";
import { Ditto, type IZip } from "./LFW/ditto";
import type { IUIInfo } from "./LFW/ui/IUIInfo.dat";
import { range } from "./LFW/utils/math/range";
import { Loading } from "./LoadingImg";
import { Log } from "./Log";
import { Paths } from "./Paths";
import { PlayerRow } from "./PlayerRow";
import SettingsRows from "./SettingsRows";
import { download } from "./Utils/download";
import { open_file } from "./Utils/open_file";
import img_btn_0_3 from "./assets/btn_0_3.png";
import img_btn_0_4 from "./assets/btn_0_4.png";
import img_btn_1_0 from "./assets/btn_1_0.png";
import img_btn_1_1 from "./assets/btn_1_1.png";
import img_btn_1_2 from "./assets/btn_1_2.png";
import img_btn_1_3 from "./assets/btn_1_3.png";
import img_btn_1_4 from "./assets/btn_1_4.png";
import img_btn_2_0 from "./assets/btn_2_0.png";
import img_btn_2_1 from "./assets/btn_2_1.png";
import img_btn_2_2 from "./assets/btn_2_2.png";
import img_btn_2_3 from "./assets/btn_2_3.png";
import img_btn_2_4 from "./assets/btn_2_4.png";
import img_btn_3_0 from "./assets/btn_3_0.png";
import img_btn_3_1 from "./assets/btn_3_1.png";
import img_btn_3_2 from "./assets/btn_3_2.png";
import img_btn_3_3 from "./assets/btn_3_3.png";
import img_btn_4_3 from "./assets/btn_4_3.png";
import { useForage } from "./hooks/useForage";
import "./init";
import { DatViewer } from "./pages/dat_viewer/DatViewer";
import { useWorkspaces } from "./pages/dat_viewer/useWorkspaces";
import { Networking } from "./pages/network_test/Networking";
import { useCallbacks } from "./pages/network_test/useCallbacks";

type render_size_mode = "fixed" | "fill" | "cover" | "contain"
type debug_ui_pos = "left" | "right" | "top" | "bottom"
type showing_panel = "world_tuning" | "stage" | "bg" | "weapon" | "bot" | "player" | ""

const load_files = async (lfw: LFW, files: File[]) => {
  const zips: IZip[] = []
  const set = new Set(LFW.ZIPS.map(v => typeof v === 'string' ? v : v.name))
  for (const file of files) {
    const zip = await Ditto.Zip.read_file(file).catch(e => {
      Ditto.warn('' + e)
      return null
    })
    if (!zip) continue;
    if (set.has(zip.name)) continue;
    zips.push(zip);
  }
  if (!zips.length) return;


  // Is it stupid? -Gim
  if (lfw.ui?.id === 'entry' || lfw.ui?.id === 'launch' || lfw.ui?.id === 'init') {
    LFW.ZIPS = [...LFW.ZIPS, ...zips]
  } else if (lfw.ui?.id?.toLowerCase().indexOf('loading') == -1) {
    LFW.ZIPS = [...LFW.ZIPS, ...zips]
    lfw.load(...zips)
    lfw.set_ui({ id: 'loading' })
  }
}

const ele_root = document.firstElementChild;
const low_device = ['mobile', 'tablet'].some(v => ele_root?.classList.contains(v))
const init_app_state = () => ({
  show_fps: false,
  show_bg_scroll: false,
  showing_panel: "" as showing_panel,
  dev_ui_open: false,
  cheat_1: false,
  cheat_2: false,
  cheat_3: false,
  muted: false,
  bgm_muted: false,
  sound_muted: false,
  volume: 0.3,
  bgm_volume: 0.5,
  sound_volume: 1,
  render_size_mode: 'contain' as render_size_mode,
  render_fixed_scale: 1,
  custom_render_fixed_scale: 1,
  v_align: document.firstElementChild?.classList.contains("portrait") ? 0.3 : 0.5,
  h_align: 0.5,
  custom_h_align: 0.5,
  custom_v_align: 0.5,
  dev_ui_pos: 'bottom' as debug_ui_pos,
  touchpad: '',
  touchpad_enabled: !!low_device,
  sync_render: low_device ? 1 : 1,
  UPS: low_device ? 30 : 60,
})
const init_world_dataset = (): IWorldDataset => {
  const ret = new WorldDataset(true).dump_dataset();
  ret.sync_render = SyncRenderEnum.FPS_60;
  ret.UPS = low_device ? 30 : 60;
  ret.atom_time = low_device ? 3 : 1;
  ret.bg_flags = 0;
  ret.entity_flags = 0;
  return ret;
}
const world_dataset_version = md5(JSON.stringify(init_world_dataset()))
const app_state_version = '2'


const is_mobile_container = navigator.userAgent.includes('lfw-mobile-container')
function App() {
  const l = useLocation()
  const nav = useNavigate()
  const { params } = useMemo(() => {
    const sobj = qs.parse(l.search.substring(1))
    const hobj = qs.parse(l.hash.substring(1))
    return { sobj, hobj, params: { ...sobj, ...hobj } }
  }, [l])

  const [fullscreen] = useState(() => new Ditto.FullScreen());
  const ref_lfw = useRef<LFW | undefined>(void 0)
  const [lfw, set_lfw] = useState<LFW | undefined>()
  const [ele_game_canvas, set_ele_game_canvas] = useState<HTMLCanvasElement | null>(null)
  // const [ele_game_overlay, set_ele_game_overlay] = useState<HTMLElement | null>(null)
  const [ele_root, set_ele_root] = useState<HTMLDivElement | null>(null)
  const [[workspace, , game_cell, pannel_cell], set_workspace] = useState<
    [Workspaces | null, DomAdapter | null, HTMLElement | null, HTMLElement | null]
  >([null, null, null, null])

  const [loading, set_loading] = useState(false);
  const [loaded, set_loaded] = useState(false);
  const [paused, _set_paused] = useState(false);
  const [bg_id, _set_bg_id] = useState(Defines.VOID_BG.id);
  const [networking, set_networking] = useState(params.network === '1')
  const [dat_viewer_open, set_dat_viewer_open] = useState(false);
  const [editor_open, set_editor_open] = useState(false);

  const [app_state, set_app_state, app_state_ready] = useForage({
    key: 'app_state', version: app_state_version, init: init_app_state,
    preprocess: v => {
      v.cheat_1 = false;
      v.cheat_2 = false;
      v.cheat_3 = false;
      return v;
    }
  })
  const [world_dataset, set_world_dataset, world_dataset_ready] = useForage({
    key: 'world_dataset',
    version: world_dataset_version,
    init: init_world_dataset,
    preprocess: v => {
      v.playrate = 1;
      v.GIM_INK = 0;
      v.LF2_NET = 0;
      v.HERO_FT = 0;
      v.difficulty = Difficulty.Difficult;
      v.bg_flags = 0;
      v.entity_flags = 0;
      return v;
    }
  })

  const [is_maximised, set_is_maximised] = useState(false);
  const [is_fullscreen, _set_is_fullscreen] = useState(false);
  const { entity_flags, bg_flags } = world_dataset;

  useEffect(() => {
    if (!lfw) return;
    lfw.world.dataset.entity_flags = entity_flags;
  }, [entity_flags]);

  useEffect(() => {
    if (!lfw) return;
    lfw.world.dataset.bg_flags = bg_flags ? 1 : 0;
  }, [bg_flags]);

  const [fast_forward, set_fast_forward] = useState(false);
  useEffect(() => {
    if (!lfw) return;
    lfw.world.dataset.playrate = fast_forward ? 100 : 1;
  }, [fast_forward]);

  const toggle_fullscreen = useCallback(() => {
    if (fullscreen.is_fullscreen) fullscreen.exit();
    else fullscreen.enter(document.body.parentElement!);
  }, [fullscreen]);

  const [ui_id, _set_ui] = useState<string | undefined>(void 0);
  const [uis, set_uis] = useState<Readonly<IUIInfo>[]>([
    { id: "", name: "无页面" },
  ]);

  useCallbacks(fullscreen?.callbacks, {
    onChange: (e) => _set_is_fullscreen(!!e),
  }, [])

  useCallbacks(lfw?.callbacks, {
    on_broadcast: (message, lfw) => {
      switch (message) {
        case 'network_game':
          set_networking(prev => {
            const networking = !prev
            // FIXME: ...
            const btns = [
              lfw.ui?.search_node("btn_game_start"),
              lfw.ui?.search_node("btn_custom_game")
            ]
            for (const btn of btns) {
              btn?.blur()
              btn?.set_opacity(networking ? 0.3 : 1)
              btn?.set_disabled(networking)
            }
            return networking
          });
          break;
        case 'select_extra_data':
        case 'select_mods':
          open_file({ accept: '.zip', multiple: true }).then(async (files) => {
            if (!files.length || networking) return;
            load_files(lfw, files)
          });
          break;
        case 'custom_game':
          nav(Paths.All.custom_game)
          break;
      }
    },
    on_ui_loaded: (ui) => {
      const layout_data_list = ui.map((l) => ({
        id: l.id,
        name: l.name,
      }));
      layout_data_list.unshift({ id: "", name: "无页面" });
      set_uis(layout_data_list);
      if (layout_data_list.length > 1)
        _set_ui((v) => v || layout_data_list[1].id);
    },
    on_ui_changed: (v) => _set_ui(v?.id ?? ""),
    on_loading_start: () => set_loading(true),
    on_loading_end: () => {
      set_loaded(true);
      set_loading(false);
    },
    on_cheat_changed: (cheat_name, enabled) => {
      switch (cheat_name) {
        case CheatEnum.LF2_NET:
          set_app_state(d => { d.cheat_1 = enabled })
          break;
        case CheatEnum.HERO_FT:
          set_app_state(d => { d.cheat_2 = enabled })
          break;
        case CheatEnum.GIM_INK:
          set_app_state(d => {
            d.cheat_3 = d.dev_ui_open = d.show_fps = enabled
          })
          break;
      }
    },
    on_prel_loaded: (lf2) => {
      const { page } = params
      if (typeof page === 'string') lf2.set_ui({ id: page })
    },
  })

  useCallbacks(lfw?.world.callbacks, {
    on_stage_change: (s) => _set_bg_id(s.bg.id),
    on_pause_change: (v) => _set_paused(v),
    on_dataset_change: (key, value) => {
      set_world_dataset(d => { d[key] = value as any })
    },
  })

  useCallbacks(lfw?.sounds.callbacks, {
    on_muted_changed: v => set_app_state(d => { d.muted = v }),
    on_bgm_muted_changed: v => set_app_state(d => { d.bgm_muted = v }),
    on_sound_muted_changed: v => set_app_state(d => { d.sound_muted = v }),
    on_volume_changed: v => set_app_state(d => { d.volume = v }),
    on_bgm_volume_changed: v => set_app_state(d => { d.bgm_volume = v }),
    on_sound_volume_changed: v => set_app_state(d => { d.sound_volume = v }),
  })

  useEffect(() => {
    if (!app_state_ready) return
    if (!world_dataset_ready) return

    let { lang, dev } = params;
    if (typeof lang !== 'string') lang = navigator.language.toLowerCase()
    const lf2 = ref_lfw.current = new LFW(dev == '1');
    if (
      location.pathname.endsWith('demo') ||
      location.pathname.endsWith('demo/') ||
      location.search.indexOf('demo=0') > 0 ||
      location.hash.indexOf('demo=0') > 0
    ) {
      lf2.first_ui = 'init_demo'
    }
    lf2.lang = lang;
    Object.assign(window, {
      LFW, lf2, world: lf2.world
    })

    function print_ui_tree(node = LFW.ui) {
      console.group('id: ' + node?.id + ', name: ' + node?.name);
      console.log("node:      ", node);
      if (node?.components.length)
        console.log("components:", Array.from(node?.components));
      if (node?.children.length)
        for (const child of node?.children)
          print_ui_tree(child)
      console.groupEnd();
    };

    Object.defineProperty(window, 'ui_tree', {
      get() { print_ui_tree() },
      configurable: true
    })

    lf2.load(LFW.ZIPS[0]).catch(LFW.IgnoreDisposed);
    set_lfw(lf2)
    lf2.sounds.set_volume(app_state.volume);
    lf2.sounds.set_bgm_muted(app_state.bgm_muted);
    lf2.sounds.set_bgm_volume(app_state.bgm_volume);
    lf2.sounds.set_sound_muted(app_state.sound_muted);
    lf2.sounds.set_sound_volume(app_state.sound_volume);
    Object.assign(lf2.world, world_dataset);
    _set_bg_id(lf2.world.stage.bg.id);
    const on_touchstart = () => set_app_state(d => {
      d.touchpad_enabled = true;
      d.touchpad = d.touchpad || Array.from(lf2.players.keys())[0]
    })
    window.addEventListener("touchstart", on_touchstart);
    const del_lf2_callback = lf2.callbacks.add({
      controller_detected: ({ id }) => set_app_state(draft => {
        if (draft.touchpad === id)
          draft.touchpad_enabled = false
      }),
      keyboard_detected: ({ id }) => set_app_state(draft => {
        if (draft.touchpad === id)
          draft.touchpad_enabled = false
      }),
    })
    for (const [id, player] of lf2.players) {
      player.callbacks.add({
        on_ctrl_changed(value, prev) {
          set_app_state(draft => {
            if (value === CtrlDevice.TouchScreen && draft.touchpad !== id) {
              draft.touchpad_enabled = true
              draft.touchpad = id
            } else if (value !== CtrlDevice.TouchScreen && draft.touchpad === id) {
              draft.touchpad_enabled = false
              draft.touchpad = ''
            }

          })
        },
      })
    }
    _set_is_fullscreen(!!fullscreen.target);
    _set_paused(lf2.world.paused);

    const visibilitychange = () => lf2.sounds.set_muted(document.hidden)
    const blur = () => lf2.sounds.set_muted(true)
    const focus = () => lf2.sounds.set_muted(false)
    document.addEventListener('visibilitychange', visibilitychange);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    lf2.sounds.set_muted(!document.hasFocus() || document.hidden);

    return () => {
      window.removeEventListener("touchstart", on_touchstart)
      document.removeEventListener('visibilitychange', visibilitychange);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      del_lf2_callback();
      lf2.dispose()
    };
  }, [LFW, params, app_state_ready, world_dataset_ready]);

  const on_click_load_local_zip = () => {
    if (!lfw) return;
    open_file({ accept: ".zip" })
      .then((v) => Ditto.Zip.read_file(v[0]))
      .then((v) => lfw.load(v))
      .catch((e) => Log.print("App -> on_click_load_local_zip", e));
  };

  const on_click_download_zip = () => {
    download('data.zip.json?time=' + Date.now())
    download('data.zip?time=' + Date.now())
    download('prel.zip.json?time=' + Date.now())
    download('prel.zip?time=' + Date.now())
  };

  const on_click_load_builtin = async () => {
    if (!lfw) return;
    lfw
      .load(...LFW.ZIPS)
      .catch((e) => Log.print("App -> on_click_load_builtin", e));
  };

  useEffect(() => {
    const ele = ele_game_canvas;
    const contaner = ele?.parentElement
    if (!ele || !contaner) return;
    const scale: number = app_state.render_fixed_scale || app_state.custom_render_fixed_scale;
    const on_resize = () => {
      const screen_w = 794;
      const screen_h = 450;
      const { width, height } = contaner.getBoundingClientRect()
      const win_w = Math.floor(width);
      const win_h = Math.floor(height);
      let view_w = win_w;
      let view_h = win_h;
      const s_1 = screen_w / screen_h;
      const s_2 = win_w / win_h;
      switch (app_state.render_size_mode) {
        case "fill":
          ele.style.width = win_w + "px";
          ele.style.height = win_h + "px";
          break;
        case "cover":
          if (s_1 > s_2) {
            ele.style.height = win_h + "px";
            ele.style.width = (view_w = win_h * s_1) + "px";
          } else {
            ele.style.width = win_w + "px";
            ele.style.height = (view_h = win_w / s_1) + "px";
          }
          break;
        case "contain":
          if (s_1 > s_2) {
            ele.style.width = win_w + "px";
            ele.style.height = (view_h = win_w / s_1) + "px";
          } else {
            ele.style.height = win_h + "px";
            ele.style.width = (view_w = win_h * s_1) + "px";
          }
          break;
        case "fixed":
        default:
          ele.style.width = (view_w = scale * screen_w) + "px";
          ele.style.height = (view_h = scale * screen_h) + "px";
          break;
      }
      const h_align_ = app_state.h_align < -1 ? app_state.custom_h_align : app_state.h_align;
      const v_align_ = app_state.v_align < -1 ? app_state.custom_v_align : app_state.v_align;
      ele.style.left = Math.floor((win_w - view_w) * h_align_) + "px";
      ele.style.top = Math.floor((win_h - view_h) * v_align_) + "px";
    };
    window.addEventListener("resize", on_resize);
    on_resize();

    const resize_ob = new ResizeObserver(on_resize)
    if (game_cell) resize_ob.observe(game_cell)

    return () => {
      window.removeEventListener("resize", on_resize)
      resize_ob.disconnect()
    };
  }, [
    game_cell,
    app_state.render_size_mode,
    app_state.render_fixed_scale,
    app_state.custom_render_fixed_scale,
    app_state.v_align,
    app_state.h_align,
    app_state.custom_h_align,
    app_state.custom_v_align,
    ele_game_canvas
  ]);

  const player_infos = lfw?.players;
  const players = useMemo(() => {
    if (!player_infos) return [];
    return Array.from(player_infos.values());
  }, [player_infos]);

  const touch_pad_player_items = useMemo(
    () => [
      { value: "", label: "触控: 关闭" },
      ...players.map((v) => ({ value: v.id, label: "触控: 玩家" + v.id })),
    ],
    [players],
  );

  useShortcut("Escape", 0, () => lfw?.push_cmd(CMD.F4));
  useShortcut("F8", 0, () => lfw?.push_cmd(CMD.F8));
  useShortcut("F9", 0, () => lfw?.push_cmd(CMD.F9));
  useShortcut("F10", 0, () => lfw?.push_cmd(CMD.F10));
  useShortcut("F11", 0, () => toggle_fullscreen());
  useShortcut("ctrl+F1", 0, () => lfw?.is_cheat(CheatEnum.GIM_INK) && set_app_state(d => { d.dev_ui_open = !d.dev_ui_open }));
  useShortcut("ctrl+F3", 0, () => lfw?.is_cheat(CheatEnum.GIM_INK) && set_app_state(d => {
    d.show_fps = !d.show_fps;
  }));
  useEffect(() => {
    const ele = ele_game_canvas;
    if (!ele) return;
    if (ui_id) {
      ele.style.transition = "opacity 1000ms";
      ele.style.opacity = "1";
    } else {
      ele.style.opacity = "0";
    }
  }, [ui_id, ele_game_canvas]);

  useEffect(() => {
    if (!lfw) return;
    (lfw.pointings as __Pointings).set_element(ele_game_canvas);
    (lfw.world.renderer as WorldRenderer).set_canvas(ele_game_canvas);
  }, [lfw, ele_game_canvas])

  useWorkspaces({ container: ele_root })

  useEffect(() => {
    if (!ele_root) return;
    const adpater = new DomAdapter(ele_root)
    const workspace = new Workspaces(adpater)
    const game_slot = workspace.root;

    workspace.on_leaves_changed = () => {
      for (const leaf of workspace.leaves) {
        const cell = workspace.adapter.get_cell(leaf)
        if (!cell || cell.children.length) continue;
        if (!cell.parentElement) workspace.adapter.container.appendChild(cell)
      }
      const pannel_slot = workspace.find("panel")
      set_workspace([
        workspace,
        adpater,
        adpater.get_cell(game_slot) ?? null,
        pannel_slot ? adpater.get_cell(pannel_slot) || null : null
      ])
    }
    workspace.confirm()
    return () => {
      workspace.on_leaves_changed = void 0
      workspace.root.release()
      workspace.release()
    }
  }, [ele_root])

  useEffect(() => {
    if (!workspace) return;
    workspace.del("panel");
    if (app_state.dev_ui_open) {
      switch (app_state.dev_ui_pos) {
        case "left": workspace.add("slot_1", app_state.dev_ui_pos, { id: "panel" }); break;
        case "right": workspace.add("slot_1", app_state.dev_ui_pos, { id: "panel" }); break;
        case "top": workspace.add("slot_1", "up", { id: "panel" }); break;
        case "bottom": workspace.add("slot_1", "down", { id: "panel" }); break;
      }
      workspace.root.keep = true
    }
    workspace.confirm()
  }, [workspace, app_state.dev_ui_pos, app_state.dev_ui_open])


  const on_drop = async (e: React.DragEvent) => {
    if (!lfw || networking) return;
    const { items } = e.dataTransfer;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const file = items[i].getAsFile()
      if (!file) continue;
      files.push(file);
    }
    load_files(lfw, files);
  }
  const game_cell_view = game_cell ? createPortal(
    <div className={csses.game_contiainer}>
      <canvas
        ref={set_ele_game_canvas}
        tabIndex={-1}
        className={csses.game_canvas}
        width={794}
        height={450}
        draggable={false}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
        onContextMenuCapture={e => { e.preventDefault(); e.stopPropagation(); }}
        onDragOver={e => { if (lfw?.ui?.id === 'entry') e.preventDefault() }}
        onDrop={on_drop}
      />
      <div className={classNames(csses.game_overlay, { [csses.gone]: !app_state.show_fps })} >
        {app_state.show_fps && <DevStatsView lf2={lfw} />}
        {app_state.show_bg_scroll && <BgScrollerView lfw={lfw} />}
      </div>
      <DanmuOverlay lfw={lfw} />
      <GamePad
        id='game_pad'
        player_id={app_state.touchpad}
        enabled={!!app_state.touchpad && app_state.touchpad_enabled}
        lf2={lfw}
        container={() => ele_game_canvas?.parentElement} />
      <Loading loading={!ui_id} big className={csses.loading_img} />
      <div className={csses.top_bar}>
        <div className={csses.wails_drag} />
        <Show show={lfw?.is_cheat(CheatEnum.GIM_INK)}>
          <ToggleImgButton
            checked={app_state.dev_ui_open}
            onClick={() => set_app_state(d => { d.dev_ui_open = !d.dev_ui_open })}
            src={[img_btn_1_2, img_btn_1_3]} />
        </Show>
        <Show show={ui_id && Number(lfw?.ui_stacks[0]?.uis?.length) > 1}>
          <ToggleImgButton
            onClick={() => lfw?.push_cmd(CMD.F4)}
            src={[img_btn_2_3]} />
        </Show>
        <ToggleImgButton
          checked={app_state.bgm_muted}
          onClick={() => lfw?.sounds?.set_bgm_muted(!app_state.bgm_muted)}
          src={[img_btn_2_0, img_btn_3_0]} />
        <ToggleImgButton
          checked={app_state.sound_muted}
          onClick={() => lfw?.sounds?.set_sound_muted(!app_state.sound_muted)}
          src={[img_btn_0_3, img_btn_1_0]} />

        <Show show={bg_id !== Defines.VOID_BG.id && ui_id !== "settings"}>
          <ToggleImgButton
            checked={paused}
            onClick={() => lfw?.push_cmd(CMD.F1)}
            src={[img_btn_2_1, img_btn_2_2]} />
        </Show>
        <Show show={bg_id !== Defines.VOID_BG.id && ui_id !== "settings" && (window as any).first_ui == 'init_demo'}>
          <ToggleImgButton
            checked={lfw?.world.dataset.playrate != 1}
            onClick={() => lfw?.push_cmd(CMD.F5)}
            src={[img_btn_4_3, img_btn_4_3]} />
        </Show>
        <Show show={!networking}>
          <ToggleImgButton
            onClick={() => {
              if (!lfw) return;
              lfw.push_cmd(CMD.F2)
              if (lfw.ui?.id == 'settings')
                lfw.pop_ui_safe()
              else
                lfw.set_ui({ id: "settings" }, 1);
            }}
            src={[img_btn_1_1, img_btn_1_1]}
          />
        </Show>
        <Show show={!is_mobile_container && (window as any).first_ui != 'init_demo'}>
          <ToggleImgButton
            checked={is_fullscreen}
            onClick={() => toggle_fullscreen()}
            src={[img_btn_3_1, img_btn_3_2]} />
        </Show>
        <Show show={!is_fullscreen && window.runtime?.WindowMinimise}>
          <ToggleImgButton
            onClick={() => window.runtime?.WindowMinimise?.()}
            src={[img_btn_0_4, img_btn_0_4]} />
        </Show>
        <Show show={!is_fullscreen && window.runtime?.WindowToggleMaximise}>
          <ToggleImgButton
            checked={is_maximised}
            onClick={async () => {
              const f = await window.runtime?.WindowIsFullscreen?.()
              if (f) return fullscreen.exit();
              const m = await window.runtime?.WindowIsMaximised?.()
              set_is_maximised(!m)
              window.runtime?.WindowToggleMaximise?.()
            }}
            src={[img_btn_1_4, img_btn_2_4]} />
        </Show>
        <Show show={
          !is_fullscreen &&
          window.runtime?.Quit
        }>
          <ToggleImgButton
            checked={is_fullscreen}
            onClick={() => window.runtime?.Quit?.()}
            src={[img_btn_3_3, img_btn_3_3]} />
        </Show>
      </div>
    </div>, game_cell, null) : null

  const pannel_cell_view = pannel_cell ? createPortal(
    <div className={classNames(csses.debug_ui, csses["debug_ui_" + app_state.dev_ui_pos])}>
      <div className={csses.settings_row}>
        <Button onClick={on_click_download_zip}>下载数据包</Button>
        <Button onClick={on_click_load_local_zip} disabled={loading}>
          加载数据包
        </Button>
        <Button onClick={on_click_load_builtin} disabled={loading}>
          加载内置数据
        </Button>
        <Button onClick={() => set_dat_viewer_open(true)}>查看dat文件</Button>
        <Button onClick={() => set_editor_open(true)}>查看数据包</Button>
        <Select
          options={["top", "bottom", "left", "right"] as const}
          parse={(v) => [v, "位置：" + v]}
          value={app_state.dev_ui_pos}
          onChange={v => set_app_state(d => { d.dev_ui_pos = v! })}
        />
        <Button
          style={{ marginLeft: "auto" }}
          onClick={() => set_app_state(d => { d.dev_ui_open = false })}
        >
          ✕
        </Button>
      </div>
      <div className={csses.settings_row}>
        <Combine>
          <ToggleButton
            onChange={(v) => lfw?.sounds.set_muted(v)}
            value={app_state.muted} >
            <>音量</>
            <>静音</>
          </ToggleButton>
          <Show show={!app_state.muted}>
            <InputNumber
              precision={0}
              min={0}
              max={100}
              step={1}
              value={Math.ceil(app_state.volume * 100)}
              onChange={(e) =>
                lfw?.sounds.set_volume(e! / 100)
              }
            />
          </Show>
          <ToggleButton
            onChange={(v) => lfw?.sounds.set_bgm_muted(v)}
            value={app_state.bgm_muted}>
            <>音乐</>
            <>音乐(已禁用)</>
          </ToggleButton>
          <Show show={!app_state.bgm_muted}>
            <InputNumber
              precision={0}
              min={0}
              max={100}
              step={1}
              value={Math.ceil(app_state.bgm_volume * 100)}
              onChange={(e) =>
                lfw?.sounds.set_bgm_volume(e! / 100)
              }
            />
          </Show>
          <ToggleButton
            onChange={(v) => lfw?.sounds.set_sound_muted(v)}
            value={app_state.sound_muted}>
            <>音效</>
            <>音效(已禁用)</>
          </ToggleButton>
          <Show show={!app_state.sound_muted}>
            <InputNumber
              precision={0}
              min={0}
              max={100}
              step={1}
              value={Math.ceil(app_state.sound_volume * 100)}
              onChange={(e) =>
                lfw?.sounds.set_sound_volume(e! / 100)
              }
            />
          </Show>
        </Combine>
      </div>
      <div className={csses.settings_row}>
        <Select
          placeholder="页面"
          value={ui_id}
          onChange={v => lfw?.set_ui({ id: v })}
          options={uis}
          parse={(o) => [o.id!, o.name]}
        />
        <Titled float_label="显示模式">
          <Select
            value={app_state.render_size_mode}
            onChange={(e) => set_app_state(d => { d.render_size_mode = e! })}
            placeholder="显示模式"
            parse={i => [i, i]}
            options={["fixed", "fill", "cover", "contain"] as const}
          />
        </Titled>
        <Show show={app_state.render_size_mode === "fixed"}>
          <Titled float_label="缩放">
            <Combine>
              <Select
                value={app_state.render_fixed_scale}
                onChange={(e) => set_app_state(d => { d.render_fixed_scale = e! })}
                options={range(0, 4, 0.5)}
                parse={(i) => [i, "✕" + (i || "?")]}
              />
              <Show show={!app_state.render_fixed_scale}>
                <InputNumber
                  precision={2}
                  min={0}
                  step={app_state.custom_render_fixed_scale <= 0.5 ? 0.1 : 0.5}
                  value={app_state.custom_render_fixed_scale}
                  onChange={(e) => set_app_state(d => { d.custom_render_fixed_scale = e! })}
                />
              </Show>
            </Combine>
          </Titled>
        </Show>
        <Show show={app_state.render_size_mode !== "fill"}>
          <Titled float_label="对齐">
            <Combine>
              <Select
                value={app_state.v_align}
                onChange={(e) => set_app_state(d => { d.v_align = e! })}
                options={[-2, 0, 0.5, 1]}
                parse={(v, idx) => [
                  v, v <= -1 ? "?" : ["上", "中", "下"][idx - 1],
                ]}
              />
              <Show show={app_state.v_align < 0}>
                <InputNumber
                  precision={2}
                  min={-1}
                  max={2}
                  step={0.1}
                  value={app_state.custom_v_align}
                  onChange={(e) => set_app_state(d => { d.custom_v_align = e! })}
                />
              </Show>
              <Select
                value={app_state.h_align}
                onChange={(e) => set_app_state(d => { d.h_align = e! })}
                options={[-2, 0, 0.5, 1]}
                parse={(v, idx) => [
                  v,
                  v <= -1 ? "?" : ["左", "中", "右"][idx - 1],
                ]}
              />
              <Show show={app_state.h_align < 0}>
                <InputNumber
                  precision={2}
                  min={-1}
                  max={2}
                  step={0.1}
                  value={app_state.custom_h_align}
                  onChange={(e) => set_app_state(d => { d.custom_h_align = e! })}
                />
              </Show>
            </Combine>
          </Titled>
        </Show>
      </div>
      <div className={csses.settings_row}>
        <Combine>
          <ToggleButton
            value={paused}
            onClick={() => lfw?.push_cmd(CMD.F1)}>
            <>游戏暂停</>
            <>游戏暂停✓</>
          </ToggleButton>
          <Button onClick={() => lfw?.push_cmd(CMD.F2)}>
            更新一帧
          </Button>
          <ToggleButton
            value={fast_forward}
            onClick={() => set_fast_forward(!fast_forward)}
          >
            <>不限速度</>
            <>不限速度✓</>
          </ToggleButton>
        </Combine>
        <Combine>
          {
            Object.keys(ENTITY_INDICATINGS).map(k => {
              const num = ENTITY_INDICATINGS[k as keyof typeof ENTITY_INDICATINGS]
              return (
                <ToggleButton
                  key={k}
                  value={!!(entity_flags & num)}
                  onClick={() => set_world_dataset(v => {
                    v.entity_flags = toggle_bit(v.entity_flags, num)
                  })}>
                  <>{k}</>
                  <>{k}✓</>
                </ToggleButton>
              )
            })
          }
        </Combine>

        <Combine>
          {
            Object.keys(BG_INDICATINGS).map(k => {
              const num = BG_INDICATINGS[k as keyof typeof BG_INDICATINGS]
              return (
                <ToggleButton
                  key={k}
                  value={!!(bg_flags & num)}
                  onClick={() => set_world_dataset(v => {
                    v.bg_flags = toggle_bit(v.bg_flags, num)
                  })}>
                  <>{k}</>
                  <>{k}✓</>
                </ToggleButton>
              )
            })
          }
        </Combine>
        <Combine>
          <ToggleButton
            title="ctrl+F3"
            value={app_state.show_fps}
            onChange={v => set_app_state(d => { d.show_fps = v })}>
            <>FPS</>
            <>FPS ✓</>
          </ToggleButton>
          <ToggleButton
            title="ctrl+F4"
            value={app_state.show_bg_scroll}
            onChange={v => set_app_state(d => { d.show_bg_scroll = v })}>
            <>BG_SCROLLER</>
            <>BG_SCROLLER ✓</>
          </ToggleButton>
          <ToggleButton
            onClick={toggle_fullscreen}
            value={fullscreen.is_fullscreen}
          >
            <>全屏</>
            <>全屏 ✓</>
          </ToggleButton>
        </Combine>
      </div>
      <div className={csses.settings_row}>
        <Combine>
          <ToggleButton
            onChange={() =>
              set_app_state(d => { d.showing_panel = (d.showing_panel === "stage" ? "" : "stage") })
            }
            value={app_state.showing_panel === "stage"}
          >
            <>关卡面板</>
            <>关卡面板✓</>
          </ToggleButton>
          <ToggleButton
            onChange={() =>
              set_app_state(d => { d.showing_panel = (d.showing_panel === "bg" ? "" : "bg") })
            }
            value={app_state.showing_panel === "bg"}
          >
            <>背景面板</>
            <>背景面板✓</>
          </ToggleButton>
          <ToggleButton
            onChange={() =>
              set_app_state(d => { d.showing_panel = (d.showing_panel === "weapon" ? "" : "weapon") })
            }
            value={app_state.showing_panel === "weapon"}
          >
            <>武器面板</>
            <>武器面板✓</>
          </ToggleButton>
          <ToggleButton
            onChange={() =>
              set_app_state(d => { d.showing_panel = (d.showing_panel === "bot" ? "" : "bot") })
            }
            value={app_state.showing_panel === "bot"}
          >
            <>Bot面板</>
            <>Bot面板✓</>
          </ToggleButton>
          <ToggleButton
            onChange={() =>
              set_app_state(d => { d.showing_panel = (d.showing_panel === "player" ? "" : "player") })
            }
            value={app_state.showing_panel === "player"}
          >
            <>玩家面板</>
            <>玩家面板✓</>
          </ToggleButton>
          <ToggleButton
            onChange={() =>
              set_app_state(d => { d.showing_panel = (d.showing_panel === "world_tuning" ? "" : "world_tuning") })
            }
            value={app_state.showing_panel === "world_tuning"}>
            <>世界微调</>
            <>世界微调✓</>
          </ToggleButton>
        </Combine>
        <Combine>
          <StatusButton
            value={app_state.touchpad}
            items={touch_pad_player_items}
            parse={i => [i.value, i.label]}
            onChange={(v) => set_app_state(d => { d.touchpad = v! })} />
          <ToggleButton
            onChange={() => lfw?.set_cheat(CheatEnum.LF2_NET)}
            value={app_state.cheat_1}>
            <>LF2_NET</>
            <>LF2_NET✓</>
          </ToggleButton>
          <ToggleButton
            onChange={() => lfw?.set_cheat(CheatEnum.HERO_FT)}
            value={app_state.cheat_2}>
            <>HERO_FT</>
            <>HERO_FT✓</>
          </ToggleButton>
          <ToggleButton
            onChange={() => lfw?.set_cheat(CheatEnum.GIM_INK)}
            value={app_state.cheat_3}>
            <>GIM_INK</>
            <>GIM_INK✓</>
          </ToggleButton>
        </Combine>
      </div>
      <Show show={app_state.showing_panel === "player"}>
        {players.map((info, idx) => (
          <PlayerRow
            key={idx}
            lfw={lfw!}
            info={info}
            touch_pad_on={app_state.touchpad === info.id}
            on_click_toggle_touch_pad={() => {
              const is_me = app_state.touchpad === info.id;
              set_app_state(draft => { draft.touchpad = is_me ? "" : info.id })
            }}
          />
        ))}
      </Show>
      <SettingsRows
        lf2={lfw}
        show_stage_settings={app_state.showing_panel === "stage"}
        show_bg_settings={app_state.showing_panel === "bg"}
        show_weapon_settings={app_state.showing_panel === "weapon"}
        show_bot_settings={app_state.showing_panel === "bot"}
        show_world_tuning={app_state.showing_panel === "world_tuning"}
      />
    </div >, pannel_cell, null) : null

  return (
    <>
      <div className={csses.app} ref={set_ele_root} />
      {game_cell_view}
      {pannel_cell_view}
      <DatViewer open={dat_viewer_open} onClose={() => set_dat_viewer_open(false)} />
      <EditorView
        open={editor_open}
        onClose={() => set_editor_open(false)}
        style={{ background: 'black', position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, zIndex: 1 }}
        lf2={lfw} />
      {networking && <Networking lf2={lfw} />}
    </>
  );
}
function toggle_bit(v: number, b: number): number {
  return v & b ? v ^ b : v | b
}
export default App;


