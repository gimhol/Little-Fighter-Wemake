// 场景入口（§G1 骨架里「跑起来」的那一半 + §G2 第二半「画出来」）：一个 `Node2D`。
//
//   `_ready()`   → 读命令行（`--` 之后的用户参数）→ 装包 → `boot_scene`（`host/common/lfw_boot.h`
//                  的**同一份**共享装配，不另写一条 boot 路径）
//   `_process()` → 按 §G3 的固定步长累加器推帧；每步之后按 `lfw_thin` 的口径补一次
//                  `World::render_once`（本宿主不装 `IRenderScheduler` ⇒ 世界自己不会渲染）
//                  → `queue_redraw()`；推够 `--frames`（或到了 `--shot-frame`）就打摘要并 `quit()`
//   `_input()`   → 平台事件（鼠标按下/抬起/移动/滚轮）→ `LfwPointingEvent` → `POINTER_*` 命令
//                  （`host/common/ui_input_handle.cpp`）⇒ UI 真的点得动
//   `_draw()`    → 把世界渲染器组好的 `GodotDrawItem` 变成 `draw_*`（**唯一**碰引擎绘制的地方）：
//                  按 `pass` 三趟扫（-1 UI 背景 → 0 世界 → +1 UI 前景 = D1(a) 的五遍次序），
//                  纯色块 / 图片 blit / 文字（`draw_string`，字体是引擎的默认字体）
//
// **两种跑法**（`--play` 是岔路口）：
//   * 开放模式（`--play`；`npm run godot` 用的就是它）：**不** `boot_scene`（由数据自己的入口页
//     `init` 驱动，点进去才算走进游戏）、**不**限帧数（关窗口才结束）、缺省不打帧摘要，节拍用
//     Godot 给的真 `delta`（真时间）。截图仍可用（`--screenshot` + `--shot-frame`）。
//   * 验收模式（`--frames N`；`npm run godot:headless` 用的）：与 `lfw_run` 同形 —— 强制
//     `boot_scene` 造场景、固定步长 + `--delta` 节拍、每 `--every` 帧打一行摘要。**三条摘要靠这一支。**
//
// 引擎侧只有这一个类 + 一个注册函数（`register_types.cpp`）：所有 Godot 类型都止步于此
//（§G5「只在边界转换」）。命令行参数与 `lfw_run` 同名（`--root` / `--zip` / `--fighter` /
// `--stage` / `--players` / `--frames` / `--every` / `--time` / `--vs`），另加：
//   * `--play`：开放模式（= `--frames 0` + 不 boot_scene；见上）；
//   * `--delta`：**只覆盖节拍**（`_process` 的 `delta` 从哪来），从不改变固定步长 —— 默认仍是 Godot
//     给的真 `delta`，headless 验收用它把「15 秒虚拟时间」压成几百个 Godot 帧；
//   * `--click <x>,<y>[@<frame>]` + `--click-frame N`：脚本化点击（坐标是 UI 逻辑像素），与
//     `lfw_run --click` 走同一条注入路径；
//   * `--screenshot <png>` + `--shot-frame N`：画到第 N 帧后存一张视口 PNG（⚠ 别加 `--headless`）。
//   * `--ui-page <id>` + `--ui-dump`：装载后把某一页设到第 0 层（拍 UI 用）/ 逐 UI 节点打一行事实。
//   * `--titlebar <native|none|custom|frame>` + `--window-scale N` + `--icons <dir>`：窗口那一套（见「窗口」）。
//   * `--click-window <x>,<y>[@<frame>]`：`--click` 的窗口像素版（走引擎的真实事件路径，见下）。
//
// **窗口**（Electron 端那一套的引擎侧等价物：`desktop/app/main.mjs` 的 `frame: false` + `src/App.tsx`
// 自绘的那一整簇控件）：`--play`（玩）缺省 = **无边框 + 自绘标题栏 + 1.5× 窗口**（1191×675）；
// 验收/诊断（给 `--frames`、headless）缺省 = 原样（系统边框、794×450）⇒ 三条摘要与既有截图不动。
// 逻辑屏幕**永远是** 794×450（= 数据里的 `dataset.screen_w × screen_h`；`project.godot` 的
// `display/window/size/viewport_*` 只是同一个数，管开窗尺寸）。`project.godot` 的 `stretch/mode` 是
// **disabled** ⇒ 引擎不再替宿主 contain/缩放，`contain_transform()` 是**唯一**一处 contain 几何
//（逻辑像素 → 窗口像素的等比缩放 + 居中偏移）：`_draw()` 用它摆游戏那一层、`_input()` 用它的逆把
// 窗口像素换回逻辑像素、`contain_rect()` 用同一份数字把游戏**裁**在内容矩形里（`clip` +
// `custom_rect`：逻辑屏幕外的绘制不许漏进黑边）。字体过采样补成引擎在 `canvas_items` 下的自动值
//（`MAX(内容缩放)`）⇒ 1.5× 开窗时文字的光栅化与切片之前逐像素一致。
// ⚠ 自绘标题栏那一层反过来：它是 **DOM 的 CSS 像素**（= 窗口像素），绘制时按 `get_final_transform()`
// 的逆换到画布（stretch 关掉后基本就是单位阵）、命中时按正变换换回来，并用 `clip_ignore` **越过**
// 上面那条裁剪（`lfw_godot_titlebar.h` 只管那一套几何）。
#pragma once

#include <filesystem>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include <godot_cpp/classes/audio_effect_panner.hpp>
#include <godot_cpp/classes/audio_stream.hpp>
#include <godot_cpp/classes/audio_stream_player.hpp>
#include <godot_cpp/classes/font.hpp>
#include <godot_cpp/classes/input_event.hpp>
#include <godot_cpp/classes/node2d.hpp>
#include <godot_cpp/variant/color.hpp>
#include <godot_cpp/variant/vector2i.hpp>

#include "host/fs_zip.h"
#include "host/godot/lfw_godot_font.h"
#include "host/godot/lfw_godot_host.h"
#include "host/godot/lfw_godot_models.h"
#include "host/godot/lfw_godot_renderer.h"
#include "host/godot/lfw_godot_textures.h"
#include "host/godot/lfw_godot_titlebar.h"
#include "lfw/base/clock.h"
#include "lfw/lfw.h"

namespace lfw::host {

using godot::Node2D;

// ⚠ 是 `Node2D`（不是 `Node`）：世界画在 `_draw()` 里（§G2 第二半），引擎侧只有这一个类
// 会把 `GodotDrawItem` 变成 `draw_*` 调用（§G5「只在边界转换」）。
class LfwGodot : public Node2D {
  GDCLASS(LfwGodot, Node2D)  // NOLINT

 public:
  LfwGodot() = default;
  // 端口那两个全局槽（`set_clock` / `set_timeout`）指的都是本节点持有的宿主对象
  // ⇒ 节点被回收时先摘掉，别留悬空指针（编辑器里重载场景 / 反复进出都会走到）。
  // 定义写在头里（inline）：MSVC 会在 `register_types.cpp` 那一侧也落一个实例。
  ~LfwGodot() override {
    lfw::set_clock(nullptr);
    lfw::set_timeout(nullptr);
  }

  void _ready() override;
  void _process(double p_delta) override;
  // 平台指针/键盘事件进来的唯一入口（GDExtension 要先 `set_process_input(true)`）：翻成
  // `LfwPointingEvent` 交给 `HeadlessHost::emit_pointer_*`（与 `lfw_run --click` 同一条注入路径）。
  // 自绘标题栏那一带（`--titlebar custom`）先在这里被吞掉，不往下走。
  void _input(const godot::Ref<godot::InputEvent>& p_event) override;
  // 窗口关掉时打一行收尾（开放模式没有帧数上限，正常运行只会这样结束）。
  // ⚠ 不能写 `override`：godot-cpp 的 `Wrapped::_notification` 不是虚函数，靠成员指针比较
  // （`wrapped.hpp:264-275`）认出来 —— 名字隐藏就行。
  void _notification(int p_what);
  void _draw() override;

  // `--titlebar` 的四个取值：
  //   * `native`：系统边框 + **系统**标题栏（"验收/诊断"那一档的缺省，与切片之前逐位一致）；
  //   * `none`  ：无边框、不画栏（只剩 `--window-scale` 那一半）；
  //   * `custom`：无边框（Windows 上 = `WS_POPUP`）+ 本节点自绘的标题栏（`--play` 的缺省）；
  //   * `frame` ：**原生边框**（Windows 上保留 `WS_THICKFRAME` 那一套：原生缩放、Aero Snap、
  //     原生最大化/还原、DWM 阴影）**但不要系统标题栏**（`WINDOW_FLAG_EXTEND_TO_TITLE` 把客户区
  //     顶到标题栏位置）+ 仍由本节点自绘标题栏 —— Electron `frame:false` 在 Windows 上的等价物。
  //     ⚠ 实测（Godot 4.7.1/Windows）：那一枚 flag 是**空操作**（只在 macOS 后端实现）⇒ 这一档
  //     出来的是"系统标题栏 + 我们的自绘栏"两层，**不是**可用的 Electron 等价物；留着是为了
  //     一条命令复现这个结论（`window_setup` 里那行 verdict）。
  enum class TitlebarMode { native, none, custom, frame };

 protected:
  static void _bind_methods();

 private:
  // `lfw_run` 的同名参数 + `delta`（节拍覆盖）+ 截图那两条 + 开放模式/脚本化点击。
  struct Args {
    std::vector<std::filesystem::path> roots;
    std::vector<std::filesystem::path> zips;
    std::vector<std::u16string> fighters;
    std::u16string stage;
    int frames = 600;  // 0 = 不限（开放模式）；> 0 = 推这么多帧就收工
    int players = 2;
    // `--every N`：每 N 帧打一行摘要。缺省 0 = 按跑法自动（开放模式静默、验收模式 60）。
    int every = 0;
    double time = 0.0;
    double delta = 0.0;  // 秒；0 = 用 Godot 给的 `delta`
    bool vs = false;
    // `--play`：开放模式（= `--frames 0` + 不 `boot_scene`）。`npm run godot` 就是它。
    bool play = false;
    // ---- 窗口（Electron 端那一套：无边框 + 自绘标题栏 + 缩放）----
    // `--titlebar <native|none|custom>`：系统边框 / 无边框且**不**画 / 无边框 + 自绘（默认值按跑法
    // 定：`--play` 缺省 `custom`，其余缺省 `native` ⇒ 验收与既有截图的口径不变）。
    TitlebarMode titlebar = TitlebarMode::native;
    bool titlebar_given = false;
    // `--window-scale N`：窗口 = 逻辑屏幕 × N（缺省：`--play` 时 1.5，其余 1.0）。
    double window_scale = 1.0;
    bool window_scale_given = false;
    // `--window-size WxH`：直接给窗口像素尺寸（**允许不等比**；给了就压过 `--window-scale`）。
    // 0 = 没给。窗口可自由拉伸 ⇒ 这两个数只是"开窗时的初始尺寸"，之后由用户拖。
    int window_w = 0;
    int window_h = 0;
    // `--display-scale N`（诊断）：覆盖顶栏那一层用的**显示缩放**（CSS 像素 → 窗口物理像素，
    // 缺省 = `DisplayServer::screen_get_scale()`）。本机屏幕缩放恰为 1 时用它把 DPI 那一档跑起来
    // （`--display-scale 1.5` 下条高 32×1.5=48 物理像素、图 19.2×1.5=28.8）。
    double display_scale = 0.0;
    // `--icons <dir>`：自绘顶栏那 11 个 `btn_*.png` 所在的目录（缺省 = 从仓库根解析出来的
    // `src/assets`，见 `resolve_icons_dir`）。**不在数据包里** ⇒ 打包/导出时得自己带上这些 PNG。
    std::filesystem::path icons;
    bool icons_given = false;
    std::filesystem::path screenshot;  // 空 = 不截图
    int shot_frame = -1;               // < 0 = 缺省（有截图时取 120）
    bool ui_dump = false;              // `--ui-dump`：最后一帧逐 UI 节点打一行事实
    // `--clip-probe`：在**逻辑屏幕**边界上贴一圈内外各 8 像素的洋红框（画在游戏**之上**）——
    // 证明"游戏那一层真的被裁在内容矩形里"的观测量：裁剪生效 ⇒ 黑边干净、只看得到里面那半圈；
    // 裁剪失效 ⇒ 黑边里各多出 8 像素洋红。截图里一眼可辨（见 README「窗口外观」）。
    bool clip_probe = false;
    std::u16string ui_page;             // `--ui-page <id>`：装载后把这一页设到第 0 层（等价点进去）
    // `--lang <code>`：UI 语言码（`LFW::set_lang`，**在 `load` 之前**）。空 = 用系统区域
    //（`OS::get_locale()`；Web 版那一半是 `navigator.language.toLowerCase()`）。
    std::u16string lang;
    // `--version-name <text>`：左下角那行版本号（`VERSION_NAME`）。空 = 从 `<root>/version.json` 拼。
    std::string version_name;
    // `--click <x>,<y>[@<frame>]`：在第 `frame` 帧注入一次完整点击（按下 + 抬起）。坐标是
    // UI 逻辑像素（左上原点，与截图 1:1）。`--click-frame N` 给没写 `@frame` 的定帧（缺省 60）。
    // `--click-window <x>,<y>[@<frame>]`：同一次点击，但坐标是**窗口像素**，走 `push_input(ev,false)`
    // ⇒ 引擎按 `Window::get_final_transform()` 反算回逻辑像素（与 OS 事件同一条）—— 缩放 ≠ 1 时
    // 「换算对不对」靠它证（`--click` 是直接注入逻辑坐标，证不了换算）。
    struct ClickAt {
      int frame = 0;
      double x = 0;
      double y = 0;
      bool window_space = false;
      // `--hover-window`：只推一条 `InputEventMouseMotion`（悬停/移开），不按不抬 ——
      // 顶栏的悬停态（拖拽层高亮 + 控件放大 + 音量弹层）只有它推得动。
      bool hover = false;
    };
    std::vector<ClickAt> clicks;  // `--click` / `--click-window` / `--hover-window` 混在一条队列里
    std::vector<std::string> click_specs;
    std::vector<std::string> window_click_specs;
    std::vector<std::string> hover_specs;
    int click_frame = 60;
    // `--key <name>[@<frame>]` / `--key-down` / `--key-up`：往宿主喂一次键盘事件
    //（`HeadlessHost::key_down/key_up`，与真键盘走 `_input` 同一条）。键名是**小写
    // `KeyboardEvent.key`**（`host/common/key_code.h` 的别名表：`space` / `esc` / `up`…）。
    struct KeyAt {
      int frame = 0;
      bool down = true;
      std::u16string key;
    };
    struct KeySpec {
      std::string kind;  // "tap" / "down" / "up"
      std::string text;  // 原文 `<name>[@<frame>]`
    };
    std::vector<KeyAt> keys;
    std::vector<KeySpec> key_specs;
    int key_frame = 60;
    int key_tap = 2;  // 一次「按一下」的按下 → 抬起间隔（帧）
  };

  static const char* usage();
  static std::vector<std::string> user_args();
  bool parse_args(const std::vector<std::string>& argv, Args& out) const;
  bool setup();  // 装包 + `LFW` + `boot_scene`；失败时已经把错误打出去了
  bool unlimited() const { return _args.frames <= 0; }  // 开放模式：推到窗口关掉为止
  // 文字度量（D4：「字体度量在宿主」）：引擎的默认字体算 `w/h`，装进 `LfwGodotHost`。
  void install_text_metrics();
  void report_frame(int frame) const;
  void render_world_frame(long long renders_before);  // 每步补一次 `render_once` + `take_frame`
  // ---- 指针（`_input` 那一半）----
  // UI 逻辑视口尺寸（数据里的 `dataset.screen_w × screen_h`）；UI 的坐标空间就是它。
  void ui_screen_size(double& w, double& h) const;
  // ---- 窗口像素 ⇄ 逻辑像素：宿主自己做的 contain + 居中（`project.godot` 的 stretch 是 disabled）----
  // 逻辑屏幕尺寸：装载之后 = 端口自己的那一份（`ui_screen_size()`）；装载之前 = `project.godot` 的
  // `display/window/size/viewport_*`（同一个数，`apply_window_setup()` 也按它缩放窗口）。
  void logical_size(double& w, double& h) const;
  // 逻辑像素 → **窗口像素**的矩阵（等比缩放 + 居中偏移）。口径照 `Window::_update_viewport_size()`
  // 的 keep 分支（内容尺寸 `floor`、偏移 `round`、逐轴缩放）⇒ 与切片之前 `canvas_items` 下的数字同值
  //（1400×500 ⇒ 882×500+259+0；1191×675 ⇒ 1191×675+0+0；1191×900 ⇒ 1191×675+0+113）。
  godot::Transform2D contain_transform(const godot::Vector2i& window_size) const;
  godot::Rect2 contain_rect(const godot::Vector2i& window_size) const;  // 同上，窗口像素
  // 当前窗口像素尺寸（真窗口读 `DisplayServer`；headless / 编辑器里退回视口可见矩形）。
  godot::Vector2i window_size_px() const;
  // 画布像素 → 窗口像素（`Viewport::get_final_transform()`：stretch 关掉后平时 = 单位阵，
  // DPI / `display/window/stretch/scale` 非 1 时才不是）。自绘顶栏那一层用它。
  godot::Transform2D final_transform() const;
  // 把游戏那一层裁在 `contain_rect()` 里（`canvas_item_set_custom_rect` + `canvas_item_set_clip`）。
  void apply_game_clip(const godot::Vector2i& window_size);
  // 字体过采样 = `MAX(内容缩放)`（引擎在 `canvas_items` 下自动取的就是它）。
  void apply_font_oversampling(const godot::Transform2D& contain);
  // contain / 过采样那一行的证据（值变了才打一次）。
  void report_stretch(const godot::Transform2D& contain, const godot::Rect2& content);
  // 平台事件 → `LfwPointingEvent`（`none` = 这个事件不是指针事件）。
  enum class PointerKind { none, down, up, move, wheel };
  PointerKind to_pointing_event(const godot::Ref<godot::InputEvent>& event,
                                LfwPointingEvent& out) const;
  Args::ClickAt* inject_clicks(int frame);  // `--click`：返回这一帧点过的第一个（没有则 nullptr）
  // `--key` / `--key-down` / `--key-up`：把这一帧的按键喂进宿主（返回第一条，供日志）。
  const Args::KeyAt* inject_keys(int frame);
  // `--click-window`：把一次完整点击按**窗口像素**推进引擎（`push_input(ev, /*local=*/false)`）。
  void push_window_click(double x, double y);
  // `--hover-window`：只推一条 `InputEventMouseMotion`（同一套窗口像素口径）—— 顶栏的悬停态靠它。
  void push_window_hover(double x, double y);
  std::string ui_pages_text() const;
  // ⚠ 镜像绘制要**在这个矩阵里**做（见 `lfw_godot_node.cpp` 的 `draw_item`）：`draw_set_transform*` 是
  // **绝对**设置（不叠加），落在绘制项中间就会把这一层的 contain 变换冲掉。
  void draw_item(const GodotDrawItem& item);
  godot::Transform2D _item_xform;  // 当前这一批绘制项用的矩阵（`_draw()` 设、`draw_item` 镜像后还回去）
  void draw_text_item(const GodotDrawItem& item);
  // `--clip-probe` 那一圈（逻辑屏幕边界内外各 8 像素；见 `Args::clip_probe`）。
  void draw_clip_probe(const godot::Transform2D& contain);
  // ---- 窗口 / 自绘标题栏（`--titlebar` / `--window-scale`）----
  // 无边框 + 窗口尺寸（`_ready` 里、装包之前就跑：别让系统边框闪一下）。逻辑屏幕不动，见头注释。
  void apply_window_setup();
  bool titlebar_visible() const;  // `custom`/`frame` 且**不全屏**（镜像 Electron：全屏时整簇按钮消失）
  // 自绘栏由我们画：`custom`（无边框）与 `frame`（原生边框 + `EXTEND_TO_TITLE`）两档。
  bool titlebar_drawn() const {
    return _args.titlebar == TitlebarMode::custom || _args.titlebar == TitlebarMode::frame;
  }
  // `frame` 档：窗口仍有 Windows 的原生边框（`WS_THICKFRAME` 那一套）⇒ 缩放 / Aero Snap / 最大化
  // 都归系统，宿主那条 6 像素自绘缩放带与"自己做的最大化"在这一档**不参与**（否则两套会打架）。
  bool native_frame() const { return _args.titlebar == TitlebarMode::frame; }
  // 条上/边缘的事件处理：true = 已吞掉（调用方把它标成 handled，别再喂给游戏/UI）。
  bool titlebar_consume(const godot::Ref<godot::InputEvent>& event);
  void draw_titlebar();
  // ---- 自绘顶栏的 11 个控件（`lfw_godot_titlebar.h` 只管几何；这里管"能不能求值/点了干什么"）----
  // 从端口现有的状态填那张可见性表（`src/App.tsx` 的 `Show show=` 逐条对位）。
  lfw::host::TitleBarConditions titlebar_conditions() const;
  // 每个控件的 `checked`（`ToggleImgButton` 的 `src[0]` / `src[1]` 选哪张）。
  bool titlebar_checked(lfw::host::TitleAction action) const;
  // 点下去干什么（`f1`/`f4`/`f5`/`f2` 走 `LFW::push_cmd`，静音/全屏/窗口那三个各有对应 API）。
  void titlebar_activate(int index);
  // 音量滑杆：读当前值 / 写回去（`VerticalSlider` 那两句：设音量 + "拖起来就取消静音"）。
  double titlebar_volume(int index) const;
  void titlebar_set_volume(int index, double v);
    // 悬停态：指针在哪（控件 / 拖拽层 / 自己的弹层里）⇒ 刷 `_bar`（变了就 `queue_redraw()`）。
    // 移动与按下都调它（按下的位置就是指针的位置，等价于真实事件流里那条 move）。
    void titlebar_update_hover(const lfw::host::TitleBarLayout& layout,
                               const lfw::host::TitleHit& hit, double bx, double by);
  // 圆角矩形（Godot 的 `draw_rect` 没有半径）：两块矩形 + 四个角上的圆。
  void draw_rounded_rect(const lfw::host::TitleBarRect& r, double radius, const godot::Color& color);
  // 顶栏的坐标系：**DOM 的 CSS 像素**（条高 32、图 19.2 —— 与窗口尺寸/contain 缩放无关，
  // 只随显示缩放整体放大）。`_draw` 里把画布换成「CSS → 画布」（`final` 的逆 × 显示缩放），
  // `_input` 里把窗口像素除同一个显示缩放映回来。返回条宽（= **窗口**宽 ÷ 显示缩放）。
  double titlebar_window_width(const godot::Vector2i& window_size) const;
  // 顶栏那一层唯一的缩放：CSS 像素 → 窗口**物理**像素（缺省 = `screen_get_scale()`；
  // `--display-scale` 覆盖）。绘制乘它、命中除它 ⇒ 两边不可能各算一套。
  double titlebar_display_scale() const;
  // 图标目录（`--icons` 或从仓库根解析出来的 `src/assets`；空 = 找不到 ⇒ 不画图，只留命中盒）。
  void setup_icons();
  // 可见集合变了就打一行（证据行：哪几个控件现在在条上、为什么）。
  void report_titlebar_controls();
  void print_exit_summary() const;  // 关窗口 / 点 close 按钮共用的收尾行
  bool capture_screenshot();       // 视口 → PNG
  void finish();
  void quit_with(int code) const;

  // ---- 音频（TS `sounds/Modern.ts` 的**播出侧**；算式在 `LfwGodotHost` 那一半）----
  // 引擎侧只有三件事：把资源路径解成 `AudioStream`、把数字（音量/声道）落到播放器上、
  // 播完了通知宿主回收。槽位（`AudioStreamPlayer`）与总线都是这里建的 ——
  // 每个槽一条自己的总线 + 一个 `AudioEffectPanner`：`AudioStreamPlayer` 没有 pan 参数，
  // 而 TS 的 `get_l_r_vol` 是**每声道**两个幅度（见 `LfwGodotHost::sound_lr` 的注释）。
  void install_audio();
  // 资源路径 → 解码好的 `AudioStream`（缓存；失败空串并 ++`_audio_failed`）。
  std::string audio_stream_key(const std::string& path);
  void audio_play(const std::string& id, const std::string& path, double gain, double pan);
  void audio_set_gain(const std::string& id, double gain, double pan);
  void audio_preload(const std::string& path);
  void audio_play_bgm(const std::string& path, bool loop, double gain);
  void audio_set_bgm_gain(double gain);
  void audio_stop_bgm();
  void audio_stop_all();
  // 每帧回收：播完的槽通知宿主（= TS 的 `src_node.onended`）、随机 BGM 播完续抽（`CMD.BGM '?'`）。
  void audio_poll();
  double audio_world_scale() const;  // `get_l_r_vol` 里的 `world_node.scale.x`
  std::string audio_report() const;  // `[godot] sounds:` 那一行的正文（值变了才打）

  static constexpr int kSfxSlots = 24;
  // 播放器是 `Node`（`Ref` 不了，见 `godot-cpp` 的 `ref.hpp` 静态断言）→ 裸指针，`add_child`
  // 交给场景树持有，本节点析构时随父节点一起释放。
  std::vector<godot::AudioStreamPlayer*> _sfx_slots;
  std::vector<godot::Ref<godot::AudioEffectPanner>> _sfx_pans;
  std::vector<std::string> _sfx_ids;  // 每个槽当前播的音效 id（空 = 空槽）
  int _sfx_next = 0;                  // 没有空槽时从哪一个开始抢
  godot::AudioStreamPlayer* _bgm_player = nullptr;
  std::map<std::string, godot::Ref<godot::AudioStream>> _audio_cache;
  long long _audio_decoded = 0;
  long long _audio_failed = 0;
  std::string _audio_last_path;
  bool _bgm_was_playing = false;  // 随机 BGM 的"播完"沿（`is_playing()` 由真变假）
  std::string _audio_report;      // 上一次打过的诊断行（值变了才打）

  Args _args;
  std::unique_ptr<LfwGodotHost> _host;
  std::vector<std::unique_ptr<FsZip>> _zips;
  std::unique_ptr<lfw::LFW> _lfw;
  std::unique_ptr<GodotTextureCache> _textures;
  // 顶栏那 11 个 `btn_*.png` 的缓存：**另一份** `GodotTextureCache`（同一份实现、换一个
  // `load` —— 字节来自仓库里的 `src/assets`，不是数据包/根目录）。
  std::unique_ptr<GodotTextureCache> _icons;
  // `frame.model`（3D 模型帧）的离屏画布池（一个实体一份 `SubViewport`；见 `lfw_godot_models.h`）。
  std::unique_ptr<GodotModelBank> _models;
  // 本帧每个实体（`tag` = 实体 id）该 blit 的模型纹理（`_process` 里同步、`_draw` 里用）。
  std::map<std::string, godot::Ref<godot::ViewportTexture>> _model_textures;
  std::string _icons_dir;      // 解析出来的图标目录（空 = 没找到 ⇒ 画不出来）
  std::string _icon_report;    // 上一次打过的可见集合（变了才再打一行）
  // 字体解析与缓存（`style.font` 的 CSS 简写 → 引擎的 `Font`；见 `lfw_godot_font.h`）。
  // 文字**度量**与 `_draw()` 都走它 ⇒ 量出来的尺寸与画出来的字是同一个字体、同一个字号。
  lfw::host::FontCache _fonts;

  // `style.font` 原文 → 字体（解析不到字族时返回引擎的 fallback 字体）。
  godot::Ref<godot::Font> font_for_css(const std::string& css);

  // 左下角那行 `VERSION_NAME`：`--version-name` 优先，否则读 `<root>/version.json`。
  std::string resolve_version_name() const;

  // `--play` 下每次按键打一行"聚焦节点 + 有没有 click 动作"（查"按攻击没反应"用）。
  void report_key_focus(const std::u16string& key);
  bool _running = false;
  int _frames = 0;
  int _key_seq = 0;  // `_input` 收到的**每一条**键盘事件（含抬起/丢弃）的序号，只为诊断
  bool _capture_pending = false;  // 这一帧要截图（上一帧的绘制已经落进视口）
  bool _captured = false;         // 截过图（只截一张）
  bool _windowed = false;         // 真窗口（headless 时 false：窗口 API 一概不碰、栏也不画）
  // 逻辑屏幕尺寸（`project.godot` 的 `display/window/size/viewport_*`；见 `logical_size()`）。
  int _logical_w = 794;
  int _logical_h = 450;
  std::string _stretch_report;  // 上一次打过的 contain/过采样那一行（变了才再打）
  // 标题栏的交互状态：`_bar_capture` = 这次按下起在条上（后续 move/up 也吞），`_bar_dragging` =
  // 正在 `window_start_drag()` 的嵌套消息循环里（防重入）。悬停/弹层/滑杆拖动的状态在 `_bar`
  //（`lfw_godot_titlebar.h` 的 `TitleBarState`：控件表下标，不是"第几个可见的"）。
  bool _bar_capture = false;
  bool _bar_dragging = false;
  lfw::host::TitleBarState _bar;
  // 最近一次设过的游标形状（`DisplayServer::CursorShape` 的整数值；-1 = 还没设过）。
  // 只在变化时调 `cursor_set_shape`，别每个 move 都调。
  int _cursor_shape = -1;
  // 自己维护的"最大化"状态 + 还原点（见 `maximize` 动作：不用 `WINDOW_MODE_MAXIMIZED`）。
  // `_maximized` 同时决定最大化按钮的 `checked`（该显示"两个方块"还是"一个方块"）。
  bool _maximized = false;
  godot::Vector2i _restore_size{0, 0};
  godot::Vector2i _restore_pos{0, 0};
};

}  // namespace lfw::host

