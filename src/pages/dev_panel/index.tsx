// import { Button } from "@/Component/Buttons/Button";
// import { StatusButton } from "@/Component/Buttons/StatusButton";
// import { ToggleButton } from "@/Component/Buttons/ToggleButton";
// import Combine from "@/Component/Combine";
// import { InputNumber } from "@/Component/Input";
// import Select from "@/Component/Select";
// import Show from "@/Component/Show";
// import Titled from "@/Component/Titled";
// import { Indicating, INDICATINGS } from "@/DittoImpl/renderer/FrameIndicators";
// import { arithmetic_progression, CheatType, Ditto, LF2 } from "@/LFW";
// import { Log } from "@/Log";
// import { PlayerRow } from "@/PlayerRow";
// import SettingsRows from "@/SettingsRows";
// import { open_file } from "@/Utils/open_file";
// import { useLocalString } from "@fimagine/dom-hooks";
// import classNames from "classnames";
// import { useState } from "react";
// import styles from "./styles.module.scss";

// export default function DevPannel(props: { lf2?: LF2 }) {
//   const { lf2 } = props;
//   const [debug_ui_pos, set_debug_ui_pos] = useLocalString<"left" | "right" | "top" | "bottom">("debug_ui_pos", "bottom");
//   const [dat_viewer_open, set_dat_viewer_open] = useState(false);
//   const [editor_open, set_editor_open] = useState(false);

//   const on_click_download_zip = () => {
//     const download = (url: string) => {
//       const a = document.createElement("a");
//       a.href = url;
//       a.download = url;
//       a.click();
//     }
//     download("data.zip.json")
//     download("data.zip")
//     download("prel.zip.json")
//     download("prel.zip")
//   };

//   const on_click_load_local_zip = () => {
//     if (!lf2) return;
//     open_file({ accept: ".zip" })
//       .then((v) => Ditto.Zip.read_file(v[0]))
//       .then((v) => lf2.load(v))
//       .catch((e) => Log.print("App -> on_click_load_local_zip", e));
//   };
//   const on_click_load_builtin = async () => {
//     if (!lf2) return;
//     lf2
//       .load("prel.zip.json")
//       .then(() => lf2.load("data.zip.json"))
//       .catch((e) => Log.print("App -> on_click_load_builtin", e));
//   };

//   return (
//     <div className={classNames(styles.debug_ui, styles["debug_ui_" + debug_ui_pos])}>
//       <div className={styles.settings_row}>
//         <Button onClick={on_click_download_zip}>下载数据包</Button>
//         <Button onClick={on_click_load_local_zip} disabled={loading}>
//           加载数据包
//         </Button>
//         <Button onClick={on_click_load_builtin} disabled={loading}>
//           加载内置数据
//         </Button>
//         <Button onClick={() => set_dat_viewer_open(true)}>查看dat文件</Button>
//         <Button onClick={() => set_editor_open(true)}>查看数据包</Button>
//         <Select
//           items={["top", "bottom", "left", "right"] as const}
//           parse={(v) => [v, "位置：" + v]}
//           value={debug_ui_pos}
//           onChange={v => set_debug_ui_pos(v!)}
//         />
//         <Button
//           style={{ marginLeft: "auto" }}
//           onClick={() => set_control_panel_visible(false)}
//         >
//           ✕
//         </Button>
//       </div>
//       <div className={styles.settings_row}>
//         <Combine>
//           <ToggleButton
//             onChange={(v) => lf2?.sounds.set_muted(v)}
//             value={muted}
//           >
//             <>音量</>
//             <>静音</>
//           </ToggleButton>
//           <Show show={!muted}>
//             <InputNumber
//               precision={0}
//               min={0}
//               max={100}
//               step={1}
//               value={Math.ceil(volume * 100)}
//               onChange={(e) =>
//                 lf2?.sounds.set_volume(e! / 100)
//               }
//             />
//           </Show>
//           <ToggleButton
//             onChange={(v) => lf2?.sounds.set_bgm_muted(v)}
//             value={bgm_muted}>
//             <>音乐</>
//             <>音乐(已禁用)</>
//           </ToggleButton>
//           <Show show={!bgm_muted}>
//             <InputNumber
//               precision={0}
//               min={0}
//               max={100}
//               step={1}
//               value={Math.ceil(bgm_volume * 100)}
//               onChange={(e) =>
//                 lf2?.sounds.set_bgm_volume(e! / 100)
//               }
//             />
//           </Show>
//           <ToggleButton
//             onChange={(v) => lf2?.sounds.set_sound_muted(v)}
//             value={sound_muted}>
//             <>音效</>
//             <>音效(已禁用)</>
//           </ToggleButton>
//           <Show show={!sound_muted}>
//             <InputNumber
//               precision={0}
//               min={0}
//               max={100}
//               step={1}
//               value={Math.ceil(sound_volume * 100)}
//               onChange={(e) =>
//                 lf2?.sounds.set_sound_volume(e! / 100)
//               }
//             />
//           </Show>
//         </Combine>
//       </div>
//       <div className={styles.settings_row}>
//         <Select
//           placeholder="页面"
//           value={ui_id}
//           onChange={v => lf2?.set_ui(v!)}
//           items={uis}
//           parse={(o) => [o.id!, o.name]}
//         />
//         <Titled float_label="显示模式">
//           <Select
//             value={render_size_mode}
//             onChange={v => set_render_size_mode(v!)}
//             placeholder="显示模式"
//             parse={i => [i, i]}
//             items={["fixed", "fill", "cover", "contain"] as const}
//           />
//         </Titled>
//         <Show show={render_size_mode === "fixed"}>
//           <Titled float_label="缩放">
//             <Combine>
//               <Select
//                 value={render_fixed_scale}
//                 onChange={v => set_render_fixed_scale(v!)}
//                 items={arithmetic_progression(0, 4, 0.5)}
//                 parse={(i) => [i, "✕" + (i || "?")]}
//               />
//               <Show show={!render_fixed_scale}>
//                 <InputNumber
//                   precision={2}
//                   min={0}
//                   step={custom_render_fixed_scale <= 0.5 ? 0.1 : 0.5}
//                   value={custom_render_fixed_scale}
//                   onChange={(e) =>
//                     set_custom_render_fixed_scale(e!)
//                   } />
//               </Show>
//             </Combine>
//           </Titled>
//         </Show>
//         <Show show={render_size_mode !== "fill"}>
//           <Titled float_label="对齐">
//             <Combine>
//               <Select
//                 value={v_align}
//                 onChange={v => set_v_align(v!)}
//                 items={[-2, 0, 0.5, 1]}
//                 parse={(v, idx) => [
//                   v, v <= -1 ? "?" : ["上", "中", "下"][idx - 1],
//                 ]}
//               />
//               <Show show={v_align < 0}>
//                 <InputNumber
//                   precision={2}
//                   min={-1}
//                   max={2}
//                   step={0.1}
//                   value={custom_v_align}
//                   onChange={(e) => set_custom_v_align(e!)}
//                 />
//               </Show>
//               <Select
//                 value={h_align}
//                 onChange={v => set_h_align(v!)}
//                 items={[-2, 0, 0.5, 1]}
//                 parse={(v, idx) => [
//                   v,
//                   v <= -1 ? "?" : ["左", "中", "右"][idx - 1],
//                 ]}
//               />
//               <Show show={h_align < 0}>
//                 <InputNumber
//                   precision={2}
//                   min={-1}
//                   max={2}
//                   step={0.1}
//                   value={custom_h_align}
//                   onChange={(e) => set_custom_h_align(e!)}
//                 />
//               </Show>
//             </Combine>
//           </Titled>
//         </Show>
//       </div>
//       <div className={styles.settings_row}>
//         <Combine>
//           <ToggleButton
//             value={paused}
//             onClick={() => { if (lf2) lf2.world.paused = !paused }}
//           >
//             <>游戏暂停</>
//             <>游戏暂停✓</>
//           </ToggleButton>
//           <Button onClick={update_once}>
//             更新一帧
//           </Button>
//           <ToggleButton
//             value={fast_forward}
//             onClick={() => set_fast_forward(!fast_forward)}
//           >
//             <>不限速度</>
//             <>不限速度✓</>
//           </ToggleButton>
//         </Combine>

//         <Combine>
//           {
//             Object.keys(INDICATINGS).map(k => {
//               const key = k as Indicating;
//               const num = INDICATINGS[key]
//               return (
//                 <ToggleButton
//                   key={key}
//                   value={!!(entity_indicator & num)}
//                   onClick={() => set_entity_indicator(v => toggle_bit(v, num))}>
//                   <>{k}</>
//                   <>{k}✓</>
//                 </ToggleButton>
//               )
//             })
//           }
//         </Combine>
//         <Combine>
//           <ToggleButton
//             title="ctrl+F3"
//             value={game_overlay}
//             onChange={set_game_overlay}
//           >
//             <>游戏覆盖</>
//             <>游戏覆盖✓</>
//           </ToggleButton>
//           <ToggleButton
//             onClick={toggle_fullscreen}
//             value={fullscreen.is_fullscreen}
//           >
//             <>全屏</>
//             <>全屏✓</>
//           </ToggleButton>
//           <StatusButton
//             items={[
//               { value: 0, label: "非同步渲染✓" },
//               { value: 1, label: "同步渲染✓" },
//               { value: 2, label: "同步渲染(x0.5)✓" },
//             ]}
//             parse={i => [i.value, i.label]}
//             value={sync_render}
//             onClick={() => { if (lf2) lf2.world.sync_render = (lf2.world.sync_render + 1) % 3 }}
//           />

//         </Combine>
//       </div>
//       <div className={styles.settings_row}>
//         <Combine>
//           <ToggleButton
//             onChange={() =>
//               set_showing_panel((v) => (v === "stage" ? "" : "stage"))
//             }
//             value={showing_panel === "stage"}
//           >
//             <>关卡面板</>
//             <>关卡面板✓</>
//           </ToggleButton>
//           <ToggleButton
//             onChange={() =>
//               set_showing_panel((v) => (v === "bg" ? "" : "bg"))
//             }
//             value={showing_panel === "bg"}
//           >
//             <>背景面板</>
//             <>背景面板✓</>
//           </ToggleButton>
//           <ToggleButton
//             onChange={() =>
//               set_showing_panel((v) => (v === "weapon" ? "" : "weapon"))
//             }
//             value={showing_panel === "weapon"}
//           >
//             <>武器面板</>
//             <>武器面板✓</>
//           </ToggleButton>
//           <ToggleButton
//             onChange={() =>
//               set_showing_panel((v) => (v === "bot" ? "" : "bot"))
//             }
//             value={showing_panel === "bot"}
//           >
//             <>Bot面板</>
//             <>Bot面板✓</>
//           </ToggleButton>
//           <ToggleButton
//             onChange={() =>
//               set_showing_panel((v) => (v === "player" ? "" : "player"))
//             }
//             value={showing_panel === "player"}
//           >
//             <>玩家面板</>
//             <>玩家面板✓</>
//           </ToggleButton>
//           <ToggleButton
//             onChange={() =>
//               set_showing_panel((v) =>
//                 v === "world_tuning" ? "" : "world_tuning",
//               )
//             }
//             value={showing_panel === "world_tuning"}>
//             <>世界微调</>
//             <>世界微调✓</>
//           </ToggleButton>
//         </Combine>
//         <Combine>
//           <StatusButton
//             value={touch_pad_on}
//             items={touch_pad_player_items}
//             parse={i => [i.value, i.label]}
//             onChange={(v) => set_touch_pad_on(v!)} />
//           <ToggleButton
//             onChange={() => lf2?.toggle_cheat_enabled(CheatType.LF2_NET)}
//             value={cheat_1}>
//             <>LF2_NET</>
//             <>LF2_NET✓</>
//           </ToggleButton>
//           <ToggleButton
//             onChange={() => lf2?.toggle_cheat_enabled(CheatType.HERO_FT)}
//             value={cheat_2}>
//             <>HERO_FT</>
//             <>HERO_FT✓</>
//           </ToggleButton>
//           <ToggleButton
//             onChange={() => lf2?.toggle_cheat_enabled(CheatType.GIM_INK)}
//             value={cheat_3}>
//             <>GIM_INK</>
//             <>GIM_INK✓</>
//           </ToggleButton>
//         </Combine>
//       </div>
//       <Show show={showing_panel === "player"}>
//         {players.map((info, idx) => (
//           <PlayerRow
//             key={idx}
//             lf2={lf2!}
//             info={info}
//             touch_pad_on={touch_pad_on === info.id}
//             on_click_toggle_touch_pad={() =>
//               set_touch_pad_on(touch_pad_on === info.id ? "" : info.id)
//             }
//           />
//         ))}
//       </Show>
//       <SettingsRows
//         lf2={lf2}
//         show_stage_settings={showing_panel === "stage"}
//         show_bg_settings={showing_panel === "bg"}
//         show_weapon_settings={showing_panel === "weapon"}
//         show_bot_settings={showing_panel === "bot"}
//         show_world_tuning={showing_panel === "world_tuning"}
//       />
//     </div>
//   )
// }
export { }