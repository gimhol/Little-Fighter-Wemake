// 自绘标题栏（本文件**不碰任何引擎类型**，DESIGN §G5）：Electron 端那份顶栏在引擎侧的等价几何。
//
// 对位 `src/App.tsx:705-813` 的 **11 个控件**（`src/App.module.scss:33-81` 的 `.top_bar`：绝对定位
// top/left/right 0、`display:flex`、**`justify-content: flex-end`** ⇒ 右对齐、DOM 次序 = 从左到右）
// 与 `.wails_drag` 拖拽层。那边每个控件都是 `ToggleImgButton`：一张 32×32 的 `btn_*.png`，
// `button { transform: scale(0.6, 0.6) }`、`hover → scale(0.8, 0.8)`、`transition: all 255ms`。
// ⚠ `transform` **不参与布局** ⇒ 每个按钮的盒子是 32×32（图缩在正中：0.6 时 19.2、0.8 时 25.6）。
//
// 坐标：**DOM 的 CSS 像素**（= OS 的**逻辑**像素 —— Electron 的顶栏就是 CSS 布局，窗口多大条就多宽）。
// ⚠ 与 Godot 的"窗口像素"**不是一回事**：那边是**物理**像素（125% / 150% 缩放的屏上两者差一档）
// ⇒ 宿主在 `_draw` 里把画布换成「`final` 的逆（画布 → 窗口物理像素）× 显示缩放
// （`DisplayServer::screen_get_scale()`）」、在 `_input` 里把窗口物理像素除**同一个**显示缩放映回来
//（`lfw_godot_node.cpp` 的 `titlebar_display_scale()`）⇒ 这一层永远按 CSS 像素判，且画与命中同源。
//
// ⚠ **不变的量**（改窗口尺寸 / `--window-scale` / 游戏 contain 的缩放都不许动它们）：条高 32、
// 控件盒 32、图 19.2（悬停 25.6）、拖拽层 28.8、边缘缩放带 6 —— 全是 CSS 像素，只随**显示缩放**
// 整体放大。`[godot] titlebar:` 那一行的 `bar=宽x32 icon=19.2 scale=…` 就是这三个数的证据。
// 只有「边缘缩放带」是宿主自己加的（照旧按 CSS 像素）。
#pragma once

#include <array>

namespace lfw::host {

// 顶栏上的动作（与 Electron 的 11 个按钮一一对应；次序 = DOM 次序，见 `titlebar_controls()`）。
enum class TitleAction {
  none,
  dev_ui,      //  1 开发者面板开关（`Show show={lfw.is_cheat(GIM_INK)}`；端口没有那个面板 ⇒ 只画不点）
  f4,          //  2 `push_cmd(CMD.F4)`（`src/App.tsx:713-716`）
  bgm_mute,    //  3 BGM 静音；悬停出竖直音量条
  sound_mute,  //  4 音效静音；悬停出竖直音量条
  f1,          //  5 `push_cmd(CMD.F1)`（暂停）
  f5,          //  6 `push_cmd(CMD.F5)`（只出现在 web demo 的 `init_demo` 首页）
  settings,    //  7 `push_cmd(CMD.F2)` + 设置页（`lfw.push_cmd` 后按当前页决定 pop / set_page）
  fullscreen,  //  8 全屏开关
  minimize,    //  9 最小化（宿主自绘的那三个窗口动作之一）
  maximize,    // 10 最大化 ⇄ 还原
  close        // 11 关闭
};

// 窗口边缘（`DisplayServer::window_start_resize` 要的那 8 个方向）。
enum class TitleEdge {
  none,
  top_left,
  top,
  top_right,
  left,
  right,
  bottom_left,
  bottom,
  bottom_right
};

struct TitleBarRect {
  double x = 0;
  double y = 0;
  double w = 0;
  double h = 0;
};

struct TitleBarMetrics {
  // 单位 = **DOM 的 CSS 像素**（宿主按显示缩放换算到窗口物理像素；见文件头那两条 ⚠）。
  // 条高 = 一排 32×32 的按钮（`transform` 不参与布局）⇒ `.top_bar` 的高度就是 32。
  static constexpr double bar_height = 32.0;
  static constexpr double button = 32.0;
  static constexpr double icon_scale = 0.6;        // button { transform: scale(0.6, 0.6) }
  static constexpr double icon_scale_hover = 0.8;  // button:hover { transform: scale(0.8, 0.8) }
  static constexpr double drag_height = 28.8;      // .wails_drag { height: 90% }（32 × 0.9）
  // 边缘缩放带的宽度（**CSS 像素**）。`borderless` 在 Windows 上是 `WS_POPUP` ⇒ 没有原生可拖的
  // 边框（`platform/windows/display_server_windows.cpp` 的 `_get_window_style`），所以自己留一条。
  static constexpr double resize_band = 6.0;
  static constexpr int count = 11;
  // ---- 音量弹层（`.volume_popup` / `.volume_popup_inner` / `VerticalSlider.module.scss`）----
  // `.volume_popup { top: 100%; left: 50%; transform: translateX(-50%); padding-top: 2px }`
  // `.volume_popup_inner { padding: 8px 10px 10px; border-radius: 8px }`
  // `.vertical_slider { width: 6px; height: 84px; border-radius: 3px; --knob_size: 14px }`
  static constexpr double popup_outer_pad = 2.0;
  static constexpr double popup_pad_x = 10.0;
  static constexpr double popup_pad_top = 8.0;
  static constexpr double popup_pad_bottom = 10.0;
  static constexpr double popup_radius = 8.0;
  static constexpr double slider_w = 6.0;
  static constexpr double slider_h = 84.0;
  static constexpr double knob = 14.0;
  static constexpr double popup_w = 2.0 * popup_pad_x + slider_w;                  // 26
  static constexpr double popup_h = popup_outer_pad + popup_pad_top + slider_h +
                                    popup_pad_bottom;                              // 104
};

// 11 个控件（`src/App.tsx:707-811`，DOM 次序 = 从左到右）。每个都是 `ToggleImgButton`，显示哪一张
// **不看变量名、看 CSS 与像素**：`ToggleImgButton.tsx:77-89` 里第一张 `<img>` 的
// `src={unchecked_src}`（= `children[1] ?? children[0]` = `src[1]`）、class 是 `inner_0` + `"" + checked`，
// 而 `ToggleImgButton.module.scss` 是 `.inner_0.false { opacity: 0 }` / `.inner_1.false { opacity: 1 }`：
//
//   `checked == true`  ⇒ 显示 **`src[1]`**（没有 `src[1]` 时回落 `src[0]`）
//   `checked == false` ⇒ 显示 **`src[0]`**
//
// ⚠ 这与"`src[0]` 是 checked 那张"的直觉**相反**（组件里那两个变量的命名本身是反的）。像素与语义
// 只认这一条：静音时看到的是**划掉的那张**（bgm muted ⇒ `btn_3_0` 带斜杠、未静音 ⇒ `btn_2_0` 纯音符；
// sound muted ⇒ `btn_1_0` 喇叭打叉、未静音 ⇒ `btn_0_3` 有声波；最大化后 ⇒ `btn_2_4` 两个方块）。
struct TitleBarControl {
  TitleAction action = TitleAction::none;
  const char* img0 = "";  // `src[0]`（`checked == false` 显示）
  const char* img1 = "";  // `src[1]`（`checked == true` 显示；无这一张时填与 `img0` 相同）
};

// 这个 `checked` 状态该显示哪一张（`children[1] ?? children[0]` 那一条也在里面）。
inline const char* titlebar_control_image(const TitleBarControl& c, bool checked) {
  if (checked) return c.img1[0] != '\0' ? c.img1 : c.img0;
  return c.img0;
}

inline const std::array<TitleBarControl, TitleBarMetrics::count>& titlebar_controls() {
  static const std::array<TitleBarControl, TitleBarMetrics::count> kList = {{
      {TitleAction::dev_ui, "btn_1_2.png", "btn_1_3.png"},
      {TitleAction::f4, "btn_2_3.png", "btn_2_3.png"},
      {TitleAction::bgm_mute, "btn_2_0.png", "btn_3_0.png"},
      {TitleAction::sound_mute, "btn_0_3.png", "btn_1_0.png"},
      {TitleAction::f1, "btn_2_1.png", "btn_2_2.png"},
      {TitleAction::f5, "btn_4_3.png", "btn_4_3.png"},
      {TitleAction::settings, "btn_1_1.png", "btn_1_1.png"},
      {TitleAction::fullscreen, "btn_3_1.png", "btn_3_2.png"},
      {TitleAction::minimize, "btn_0_4.png", "btn_0_4.png"},
      {TitleAction::maximize, "btn_1_4.png", "btn_2_4.png"},
      {TitleAction::close, "btn_3_3.png", "btn_3_3.png"},
  }};
  return kList;
}

// 动作名（诊断行用；与 README 那张表同序同名）。
inline const char* titlebar_action_name(TitleAction action) {
  switch (action) {
    case TitleAction::dev_ui:
      return "dev_ui";
    case TitleAction::f4:
      return "f4";
    case TitleAction::bgm_mute:
      return "bgm";
    case TitleAction::sound_mute:
      return "sound";
    case TitleAction::f1:
      return "f1";
    case TitleAction::f5:
      return "f5";
    case TitleAction::settings:
      return "settings";
    case TitleAction::fullscreen:
      return "fullscreen";
    case TitleAction::minimize:
      return "minimize";
    case TitleAction::maximize:
      return "maximize";
    case TitleAction::close:
      return "close";
    case TitleAction::none:
      break;
  }
  return "-";
}

// 可见性：宿主只填**自己能求值**的那几个（其余保持缺省 ⇒ 视作恒真/恒假并在 README 里点名）。
// 每一条都对得上 `src/App.tsx` 里那个 `Show show=`（或 `show_volume_popup`）。
struct TitleBarConditions {
  bool cheat_gim_ink = false;         // `lfw.is_cheat(CheatEnum.GIM_INK)`（`:707`）
  bool has_ui = false;                // `ui_id`（当前页存在；`:713`）
  int bottom_pages = 0;               // `lfw.layers.bottom.pages.length`（`:713`）
  bool bg_is_void = true;             // `world.stage.bg.id == Defines.VOID_BG.id`（`:755`）
  bool settings_page = false;         // `ui_id == "settings"`（`:755`）
  bool first_page_init_demo = false;  // `first_page == 'init_demo'`（`:761`/`:782`）
  bool fullscreen = false;            // `is_fullscreen`（`:782`/`:788`）
  bool has_window = false;            // `window.runtime`（`:788`/`:793`/`:805`）
  bool mobile_or_toy = false;         // `is_mobile_container || toy_mobile`（`:782`）
};

inline bool titlebar_control_visible(TitleAction action, const TitleBarConditions& c) {
  switch (action) {
    case TitleAction::dev_ui:
      return c.cheat_gim_ink;
    case TitleAction::f4:
      return c.has_ui && c.bottom_pages > 1;
    case TitleAction::bgm_mute:
    case TitleAction::sound_mute:
      return true;
    case TitleAction::f1:
      return !c.bg_is_void && !c.settings_page;
    case TitleAction::f5:
      return !c.bg_is_void && !c.settings_page && c.first_page_init_demo;
    case TitleAction::settings:
      return true;
    case TitleAction::fullscreen:
      return !c.mobile_or_toy && !c.first_page_init_demo;
    case TitleAction::minimize:
    case TitleAction::maximize:
    case TitleAction::close:
      return !c.fullscreen && c.has_window;
    case TitleAction::none:
      break;
  }
  return false;
}

// 布局：只给**可见**的控件排版，右对齐、次序 = DOM 次序（`justify-content: flex-end`）。
struct TitleBarLayout {
  bool visible[TitleBarMetrics::count] = {};
  TitleBarRect rect[TitleBarMetrics::count] = {};  // 只在 `visible[i]` 为真时有效
  int count = 0;
};

inline TitleBarLayout titlebar_layout(double window_w, const TitleBarConditions& c) {
  const auto& list = titlebar_controls();
  TitleBarLayout out;
  for (int i = 0; i < TitleBarMetrics::count; ++i) {
    out.visible[i] = titlebar_control_visible(list[static_cast<std::size_t>(i)].action, c);
    if (out.visible[i]) ++out.count;
  }
  double x = window_w - static_cast<double>(out.count) * TitleBarMetrics::button;
  for (int i = 0; i < TitleBarMetrics::count; ++i) {
    if (!out.visible[i]) continue;
    out.rect[i] = TitleBarRect{x, 0.0, TitleBarMetrics::button, TitleBarMetrics::bar_height};
    x += TitleBarMetrics::button;
  }
  return out;
}

// 图的落点：32×32 的图按 `scale`（0.6 / hover 0.8）缩在按钮盒正中。
inline TitleBarRect titlebar_icon_rect(const TitleBarRect& button, bool hovered) {
  const double s = hovered ? TitleBarMetrics::icon_scale_hover : TitleBarMetrics::icon_scale;
  const double size = TitleBarMetrics::button * s;
  const double inset = (TitleBarMetrics::button - size) * 0.5;
  return TitleBarRect{button.x + inset, button.y + inset, size, size};
}

// 音量弹层：贴着按钮盒子往下挂（`top: 100%` + 水平居中）。
inline TitleBarRect titlebar_popup_rect(const TitleBarRect& button) {
  return TitleBarRect{button.x + button.w * 0.5 - TitleBarMetrics::popup_w * 0.5,
                      button.y + button.h, TitleBarMetrics::popup_w, TitleBarMetrics::popup_h};
}

inline void titlebar_popup_rects(const TitleBarRect& button, TitleBarRect& popup, TitleBarRect& track) {
  popup = titlebar_popup_rect(button);
  track = TitleBarRect{popup.x + TitleBarMetrics::popup_pad_x,
                       popup.y + TitleBarMetrics::popup_outer_pad + TitleBarMetrics::popup_pad_top,
                       TitleBarMetrics::slider_w,
                       TitleBarMetrics::slider_h};
}

// 滑杆值：`VerticalSlider.value_from_y` = `clamp(1 - (y - track.top) / track.height)`。
inline double titlebar_slider_value(const TitleBarRect& track, double y) {
  if (!(track.h > 0.0)) return 0.0;
  const double v = 1.0 - (y - track.y) / track.h;
  return v < 0.0 ? 0.0 : (v > 1.0 ? 1.0 : v);
}

// 滑块（knob）：`bottom: calc(v*100% - v*knob)` ⇒ 圆心距轨道底 = `v * (h - knob) + knob/2`。
inline TitleBarRect titlebar_knob_rect(const TitleBarRect& track, double v) {
  const double bottom = v * (track.h - TitleBarMetrics::knob) + TitleBarMetrics::knob * 0.5;
  return TitleBarRect{track.x + track.w * 0.5, track.y + track.h - bottom, TitleBarMetrics::knob,
                      TitleBarMetrics::knob};
}

// 填充：`.fill { bottom: 0; height: v * 100% }`。
inline TitleBarRect titlebar_fill_rect(const TitleBarRect& track, double v) {
  return TitleBarRect{track.x, track.y + track.h * (1.0 - v), track.w, track.h * v};
}

inline bool titlebar_rect_contains(const TitleBarRect& r, double x, double y) {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

// 命中：坐标都是 CSS 像素。
//   `button` = 落在这个控件盒子里（盒子在最上层：图占满盒子 ⇒ 拖拽层压不住它）；
//   `drag`   = 落在 `.wails_drag` 那一层（0..28.8）⇒ 拖窗口；
//   `none`   = 条上剩下那 3.2 像素的缝**不吞**（`.top_bar` 有 `pointer-events:none`、拖拽层只有 90%
//              高、条自己没有背景 ⇒ 那一带在 Electron 上是漏给画布的）。
// ⚠ 与窗口尺寸**无关**：`layout` 里已经按窗口（CSS）宽排好位了。
enum class TitleHitKind { none, drag, button };

struct TitleHit {
  TitleHitKind kind = TitleHitKind::none;
  int index = -1;  // `button`：控件表下标
};

inline TitleHit titlebar_hit(double x, double y, const TitleBarLayout& layout) {
  for (int i = 0; i < TitleBarMetrics::count; ++i) {
    if (!layout.visible[i]) continue;
    if (titlebar_rect_contains(layout.rect[i], x, y)) return TitleHit{TitleHitKind::button, i};
  }
  if (y >= 0.0 && y < TitleBarMetrics::drag_height) return TitleHit{TitleHitKind::drag, -1};
  return TitleHit{};
}

// 条上那一带要不要吞掉这次点击（`button`/`drag` 吞；剩下那 3.2 像素的缝不吞）。
inline bool titlebar_swallows(double y) { return y >= 0.0 && y < TitleBarMetrics::drag_height; }

// 边缘缩放带：坐标是**窗口像素**（调用方用 `Window::get_final_transform()` 把逻辑点换过去 —— 两者的
// 比值就是窗口缩放，letterbox 时还带偏移）。角优先于边（与原生边框同口径）。
inline TitleEdge titlebar_edge_at(double wx, double wy, double win_w, double win_h,
                                 double band = TitleBarMetrics::resize_band) {
  const bool left = wx < band;
  const bool right = wx >= win_w - band;
  const bool top = wy < band;
  const bool bottom = wy >= win_h - band;
  if (left && top) return TitleEdge::top_left;
  if (right && top) return TitleEdge::top_right;
  if (left && bottom) return TitleEdge::bottom_left;
  if (right && bottom) return TitleEdge::bottom_right;
  if (top) return TitleEdge::top;
  if (bottom) return TitleEdge::bottom;
  if (left) return TitleEdge::left;
  if (right) return TitleEdge::right;
  return TitleEdge::none;
}

// 顶栏的**交互状态**（宿主持有：`titlebar_consume` 里更新、`draw_titlebar` 里读）。
//   `hover`      悬停在哪个控件（控件表下标；-1 = 无）
//   `drag_hover` 悬停在拖拽区（Electron 的 `.wails_drag:hover` ⇒ `#88888855`）
//   `popup`      打开的音量弹层（-1 = 没开）—— 与 Electron 的 `.volume_hover:hover` 同义
//   `slider_drag` 正在拖的滑杆（-1 = 没在拖；拖动期间弹层不关）
struct TitleBarState {
  int hover = -1;
  bool drag_hover = false;
  int popup = -1;
  int slider_drag = -1;
};

}  // namespace lfw::host
