#include "host/godot/lfw_godot_node.h"

#include <cmath>
#include <cctype>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <memory>
#include <optional>
#include <string>
#include <system_error>
#include <vector>

#include <godot_cpp/classes/audio_server.hpp>
#include <godot_cpp/classes/audio_stream_mp3.hpp>
#include <godot_cpp/classes/audio_stream_ogg_vorbis.hpp>
#include <godot_cpp/classes/audio_stream_wav.hpp>
#include <godot_cpp/classes/display_server.hpp>
#include <godot_cpp/classes/image.hpp>
#include <godot_cpp/classes/engine.hpp>
#include <godot_cpp/classes/global_constants.hpp>
#include <godot_cpp/classes/input_event.hpp>
#include <godot_cpp/classes/input_event_key.hpp>
#include <godot_cpp/classes/input_event_mouse_button.hpp>
#include <godot_cpp/classes/input_event_mouse_motion.hpp>
#include <godot_cpp/classes/input_event_pan_gesture.hpp>
#include <godot_cpp/classes/line_edit.hpp>
#include <godot_cpp/classes/style_box_empty.hpp>
#include <godot_cpp/classes/os.hpp>
#include <godot_cpp/classes/project_settings.hpp>
#include <godot_cpp/classes/rendering_server.hpp>
#include <godot_cpp/classes/window.hpp>
#include <godot_cpp/classes/scene_tree.hpp>
#include <godot_cpp/classes/theme_db.hpp>
#include <godot_cpp/classes/viewport.hpp>
#include <godot_cpp/classes/viewport_texture.hpp>
#include <godot_cpp/variant/color.hpp>
#include <godot_cpp/variant/packed_string_array.hpp>
#include <godot_cpp/variant/rect2.hpp>
#include <godot_cpp/variant/string.hpp>
#include <godot_cpp/variant/transform2d.hpp>
#include <godot_cpp/variant/utility_functions.hpp>
#include <godot_cpp/variant/vector2.hpp>
#include <godot_cpp/variant/vector2i.hpp>
#include "host/common/key_code.h"
#include "host/common/lfw_boot.h"
#include "host/common/ui_input_handle.h"
#include "lfw/base/clock.h"
#include "lfw/core/json.h"
#include "lfw/core/js_string.h"
#include "lfw/core/value.h"
#include "lfw/defines/cmd.h"
#include "lfw/entity/gen_field.h"
#include "lfw/ui/uilayer.h"
#include "lfw/ui/uinode.h"
#include "lfw/ui/value_spread.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/utf8.h"
#include "lfw/world.h"

namespace lfw::host {
namespace {

using godot::String;
using godot::UtilityFunctions;
using godot::Color;
using godot::Rect2;
using godot::Vector2;

// UTF-8 → `std::u16string`：`Value` 里的字符串是 UTF-16（§G5）。
std::u16string from_utf8(const std::string& s) {
  return decode_utf8(std::vector<uint8_t>(s.begin(), s.end()));
}

std::string to_utf8(const std::u16string& s) {
  const std::vector<uint8_t> buf = encode_utf8(s);
  return std::string(buf.begin(), buf.end());
}

// `world.dataset.get(k)` 缺省时（`undefined`）给 TS 的缺省值。
double num_field(const Value& v, double fallback) {
  if (std::holds_alternative<std::monostate>(v)) return fallback;
  const double n = to_number(v);
  return std::isnan(n) ? fallback : n;
}

// 宿主自己的输出走 Godot 的打印（headless 下就是 stdout，编辑器里进 Output 面板）。
void print_line(const std::string& text) { UtilityFunctions::print(String::utf8(text.c_str())); }

void print_error(const std::string& text) { UtilityFunctions::printerr(String::utf8(text.c_str())); }

// 控件表里那两路音量（只有它们有悬停弹层）。
bool is_volume_control(int index) {
  const auto& list = lfw::host::titlebar_controls();
  if (index < 0 || index >= static_cast<int>(list.size())) return false;
  const lfw::host::TitleAction action = list[static_cast<std::size_t>(index)].action;
  return action == lfw::host::TitleAction::bgm_mute || action == lfw::host::TitleAction::sound_mute;
}

// 整个文件读成字节（顶栏那 11 张 PNG 在仓库的 `src/assets` 里，不在数据包里 ⇒ 不走 `IZip`）。
bool read_file_bytes(const std::filesystem::path& path, std::string& out) {
  std::ifstream in(path, std::ios::binary);
  if (!in) return false;
  out.assign(std::istreambuf_iterator<char>(in), std::istreambuf_iterator<char>());
  return !out.empty();
}

// 从 `start` 一路往上找"含 `src/assets/btn_1_1.png` 的目录"（= 仓库根）。Godot 跑工程时会把 cwd
// 切到**工程目录**（`--path` 的副作用）⇒ 从 `native/host/godot/project` 往上 4 层就是仓库根。
std::filesystem::path find_repo_root(std::filesystem::path start) {
  std::error_code ec;
  for (int depth = 0; depth < 8; ++depth) {
    if (start.empty()) break;
    if (std::filesystem::is_regular_file(start / "src" / "assets" / "btn_1_1.png", ec)) {
      return start;
    }
    const std::filesystem::path parent = start.parent_path();
    if (parent == start) break;
    start = parent;
  }
  return {};
}

// 报错时把「进程当前目录」一起带上：Godot 跑工程时会把 cwd 切到**工程目录**（`--path` 的副作用）
// ⇒ `--zip` 给相对路径时最常见的失败就是这个。
std::string cwd_string() {
  std::error_code ec;
  const std::filesystem::path cwd = std::filesystem::current_path(ec);
  return ec ? std::string("<unknown>") : cwd.generic_string();
}

const char* titlebar_name(LfwGodot::TitlebarMode mode) {
  switch (mode) {
    case LfwGodot::TitlebarMode::native:
      return "native";
    case LfwGodot::TitlebarMode::none:
      return "none";
    case LfwGodot::TitlebarMode::custom:
      return "custom";
    case LfwGodot::TitlebarMode::frame:
      return "frame";
  }
  return "?";
}

// 自绘栏判出来的方向 → `DisplayServer::window_start_resize` 要的枚举（两者都是 0..7 的 8 个方向，
// 但顺序不同 ⇒ 老实翻一遍）。
godot::DisplayServer::WindowResizeEdge to_window_edge(TitleEdge edge) {
  switch (edge) {
    case TitleEdge::top_left:
      return godot::DisplayServer::WINDOW_EDGE_TOP_LEFT;
    case TitleEdge::top:
      return godot::DisplayServer::WINDOW_EDGE_TOP;
    case TitleEdge::top_right:
      return godot::DisplayServer::WINDOW_EDGE_TOP_RIGHT;
    case TitleEdge::left:
      return godot::DisplayServer::WINDOW_EDGE_LEFT;
    case TitleEdge::right:
      return godot::DisplayServer::WINDOW_EDGE_RIGHT;
    case TitleEdge::bottom_left:
      return godot::DisplayServer::WINDOW_EDGE_BOTTOM_LEFT;
    case TitleEdge::bottom:
      return godot::DisplayServer::WINDOW_EDGE_BOTTOM;
    case TitleEdge::bottom_right:
      return godot::DisplayServer::WINDOW_EDGE_BOTTOM_RIGHT;
    case TitleEdge::none:
      break;
  }
  return godot::DisplayServer::WINDOW_EDGE_TOP;
}

// 一行窗口状态：标题栏按钮**动作之后**打出来 —— 这是"按下真的改变了窗口"的证据（模式/尺寸/装饰）。
std::string window_state_text(const godot::DisplayServer* ds) {
  const godot::Vector2i size = ds->window_get_size();
  const godot::Vector2i deco = ds->window_get_size_with_decorations();
  const godot::Vector2i pos = ds->window_get_position();
  char buf[160];
  std::snprintf(buf, sizeof(buf), "mode=%d size=%dx%d deco=%dx%d pos=%d,%d",
                static_cast<int>(ds->window_get_mode()), size.x, size.y, deco.x, deco.y, pos.x,
                pos.y);
  return buf;
}

}  // namespace

const char* LfwGodot::usage() {
  return "usage: <godot> --path native/host/godot/project -- --root <dir> --zip <dir>\n"
         "               [--zip <dir> ...] [--fighter <id>] [--stage <id>] [--players N]\n"
         "               [--frames N] [--every N] [--time ms] [--delta seconds] [--vs]\n"
         "               [--play] [--click <x>,<y>[@<frame>]] [--click-window <x>,<y>[@<frame>]]\n"
         "               [--hover-window <x>,<y>[@<frame>]] [--click-frame N]\n"
         "               [--titlebar native|none|custom|frame] [--window-scale N]\n"
         "               [--window-size WxH] [--icons <dir>]\n"
         "               [--key <name>[@<frame>]] [--key-down <name>[@<frame>]]\n"
         "               [--key-up <name>[@<frame>]] [--key-frame N] [--key-tap N]\n"
         "               [--lang <code>] [--version-name <text>]\n"
         "               [--screenshot <file.png>] [--shot-frame N] [--ui-dump] [--ui-page <id>]\n"
         "  --root     import 根目录（含 builtin_data/…），可重复；缺省 `.`\n"
         "  --zip      数据包目录（已解包），可重复；按给定顺序 load\n"
         "  --lang     UI 语言码（`zh-cn` / `en-us`…，与 Web 版的 `navigator.language.toLowerCase()`\n"
         "             同一口径；走 `LFW::set_lang`，**在 `load` 之前**设）。缺省 = 系统区域\n"
         "             （`OS::get_locale()`，`_` 换 `-`）。\n"
         "  --version-name  左下角那行版本号（`init.ui.json` 的 `version_name` 节点读 `VERSION_NAME`）。\n"
         "             缺省 = 读 `<root>/version.json` 拼成 Web 版同一串 `v<版本>-<commit7>[-dirty] <时间>`；\n"
         "             读不到就是 `v0.0.0`。\n"
         "  --fighter  指定出场的角色 id，可重复（缺省用数据包里的前 `--players` 个）\n"
         "  --play     开放模式：不 `boot_scene`（由数据入口页 `init` 驱动）、不限帧数（关窗口才\n"
         "             结束）、缺省不打帧摘要、节拍用 Godot 的真 `delta`。= `--frames 0` + 不造场景。\n"
         "  --frames   推这么多逻辑帧就收工并打摘要（验收模式）；`--frames 0` = 不限帧数\n"
         "  --delta    只覆盖 `_process` 的节拍（秒），不改固定步长（默认用 Godot 给的 delta）\n"
         "  --click    在第 `--click-frame` 帧（或 `@frame`）注入一次完整点击（按下 + 抬起）；\n"
         "             坐标是 UI 逻辑像素（左上原点、794×450 那套，与截图 1:1）。可重复。\n"
         "  --click-window  同上，但坐标是**窗口像素**：走 `push_input(ev, local=false)` ⇒ 引擎按\n"
         "             窗口缩放反算回逻辑像素（与 OS 点击同一条路）—— 证「换算对不对」用这条。\n"
         "  --hover-window  只推一条 `InputEventMouseMotion`（窗口像素）—— 悬停态（顶栏的拖拽层高亮、\n"
         "             控件缩 0.8、音量弹层）只有它能推；`--click*` 只推按钮事件。\n"
         "  --key          在第 `--key-frame` 帧（或 `@frame`）按一下（按下 + `--key-tap` 帧后抬起），\n"
         "             走 `HeadlessHost::key_down/key_up`（与真键盘的 `_input` 同一条链）；\n"
         "             键名取小写 `KeyboardEvent.key`（`space` / `esc` / `up` / `j`…）。可重复。\n"
         "  --key-down/--key-up  只按下 / 只抬起（要「按住」就用这一对）。\n"
         "  --key-frame    没写 `@frame` 的按键落在哪一帧（缺省 60）\n"
         "  --key-tap      「按一下」的按下 → 抬起间隔（帧，缺省 2）\n"
         "  --titlebar 窗口那一套：native（系统边框 + 系统标题栏）/ none（无边框、不画栏）/ custom\n"
         "             （无边框 + 自绘栏，照 Electron 那份顶栏：11 个 `btn_*.png` 控件 + 拖拽层 +\n"
         "             音量弹层）/ frame（**原生边框但不要系统标题栏**：`EXTEND_TO_TITLE`，照 Electron\n"
         "             的 `frame:false`）+ 自绘栏）。\n"
         "             缺省：`--play` 时 custom，其余 native。\n"
         "  --icons    顶栏那 11 张 `btn_*.png` 的目录（缺省 = 从仓库根解析出来的 `src/assets`；\n"
         "             它们**不在数据包里**，导出/打包时得自己带上）。\n"
         "  --display-scale  覆盖顶栏那一层用的显示缩放（CSS 像素 → 窗口物理像素；缺省 = 屏幕自己的\n"
         "             `DisplayServer::screen_get_scale()`）。诊断用：屏幕缩放恰为 1 时靠它把 DPI 那一档\n"
         "             跑起来（1.5 ⇒ 条高 32×1.5 = 48 物理像素、图 19.2×1.5 = 28.8）。\n"
         "  --window-scale  窗口 = 逻辑屏幕（794×450）× N；逻辑屏幕不变（`project.godot` 的 viewport_*）。\n"
         "  --window-size  直接给窗口像素尺寸 `WxH`（可不等比，压过 `--window-scale`）；窗口可自由拉伸，\n"
         "             下限是逻辑屏幕 794×450；画面由宿主按 contain + 居中摆进窗口（补黑边），\n"
         "             自绘栏铺满整窗宽、贴窗口右上角。\n"
         "             缺省：`--play` 时 1.5（对齐 Electron 的 1191×675），其余 1.0。\n"
         "  --screenshot  画到第 `--shot-frame` 帧后存一张 PNG（整窗：黑边 + 条 + 画面；\n"
         "                **别加 --headless**：headless 没有渲染，存出来是空白）；给绝对路径\n"
         "  --shot-frame  截图的帧号（缺省 120）\n"
         "  --ui-dump     最后一帧逐 UI 节点打一行事实（诊断，不进摘要）\n"
         "  --clip-probe  在逻辑屏幕边界内外各 8 像素贴一圈洋红（画在游戏之上）：证明游戏那一层\n"
         "                真的被裁在内容矩形里（看得见边界**里面**那半圈、黑边干净 = 裁剪生效）。\n"
         "  --ui-page     装载后把这一页设到第 0 层（id 取自烹饪好的 UI 表；缺省用首页 `init`）\n"
         "  --text-input  脚本化打字：`<text>[@<frame>]`。第 `frame` 帧让文本输入覆盖层（Web 的\n"
         "                DOM `<input>` 在 Godot 侧的等价物：一个真的 `LineEdit`）拿焦点并整串写入，\n"
         "                `+2` 帧放掉焦点（⇒ 组件 `on_blur` 存盘），`+4` 帧打一行事实。缺省帧 60。\n";
}

// `--click <x>,<y>[@<frame>]`：坐标取 `Number(...)` 口径（与 `--pos` 的解析同源）。
bool parse_click_spec(const std::string& text, int default_frame, double& x, double& y, int& frame) {
  const size_t at = text.find('@');
  const std::string pos = at == std::string::npos ? text : text.substr(0, at);
  const size_t comma = pos.find(',');
  if (comma == std::string::npos) return false;
  x = std::strtod(pos.substr(0, comma).c_str(), nullptr);
  y = std::strtod(pos.substr(comma + 1).c_str(), nullptr);
  if (!std::isfinite(x) || !std::isfinite(y)) return false;
  frame = default_frame;
  if (at != std::string::npos) frame = std::atoi(text.substr(at + 1).c_str());
  return frame >= 0;
}

std::vector<std::string> LfwGodot::user_args() {
  std::vector<std::string> out;
  const godot::PackedStringArray args = godot::OS::get_singleton()->get_cmdline_user_args();
  for (int64_t i = 0; i < args.size(); ++i) {
    const String arg = args[i];
    out.emplace_back(arg.utf8().get_data());
  }
  return out;
}

bool LfwGodot::parse_args(const std::vector<std::string>& argv, Args& out) const {
  const auto need = [&](size_t& i, std::string& value) -> bool {
    if (i + 1 >= argv.size()) return false;
    value = argv[++i];
    return true;
  };
  for (size_t i = 0; i < argv.size(); ++i) {
    const std::string& a = argv[i];
    std::string v;
    if (a == "--root") {
      if (!need(i, v)) return false;
      out.roots.emplace_back(v);
    } else if (a == "--zip") {
      if (!need(i, v)) return false;
      out.zips.emplace_back(v);
    } else if (a == "--fighter") {
      if (!need(i, v)) return false;
      out.fighters.push_back(from_utf8(v));
    } else if (a == "--stage") {
      if (!need(i, v)) return false;
      out.stage = from_utf8(v);
    } else if (a == "--frames") {
      if (!need(i, v)) return false;
      out.frames = std::atoi(v.c_str());
    } else if (a == "--players") {
      if (!need(i, v)) return false;
      out.players = std::atoi(v.c_str());
    } else if (a == "--every") {
      if (!need(i, v)) return false;
      out.every = std::atoi(v.c_str());
    } else if (a == "--time") {
      if (!need(i, v)) return false;
      out.time = std::atof(v.c_str());
    } else if (a == "--delta") {
      if (!need(i, v)) return false;
      out.delta = std::atof(v.c_str());
    } else if (a == "--screenshot") {
      if (!need(i, v)) return false;
      out.screenshot = std::filesystem::path(v);
    } else if (a == "--shot-frame") {
      if (!need(i, v)) return false;
      out.shot_frame = std::atoi(v.c_str());
    } else if (a == "--vs") {
      out.vs = true;
    } else if (a == "--lang") {
      if (!need(i, v)) return false;
      out.lang = from_utf8(v);
    } else if (a == "--version-name") {
      if (!need(i, v)) return false;
      out.version_name = v;
    } else if (a == "--play") {
      out.play = true;
      out.frames = 0;  // 开放模式：帧数不限（窗口关掉才结束）
    } else if (a == "--click") {
      if (!need(i, v)) return false;
      out.click_specs.push_back(v);
    } else if (a == "--click-window") {
      if (!need(i, v)) return false;
      out.window_click_specs.push_back(v);
    } else if (a == "--hover-window") {
      if (!need(i, v)) return false;
      out.hover_specs.push_back(v);
    } else if (a == "--titlebar") {
      if (!need(i, v)) return false;
      if (v == "native") {
        out.titlebar = TitlebarMode::native;
      } else if (v == "none") {
        out.titlebar = TitlebarMode::none;
      } else if (v == "custom") {
        out.titlebar = TitlebarMode::custom;
      } else if (v == "frame") {
        out.titlebar = TitlebarMode::frame;
      } else {
        print_error("[godot] bad --titlebar value: " + v + " (want native|none|custom|frame)");
        return false;
      }
      out.titlebar_given = true;
    } else if (a == "--window-scale") {
      if (!need(i, v)) return false;
      out.window_scale = std::atof(v.c_str());
      if (!(out.window_scale > 0.0) || out.window_scale > 8.0) {
        print_error("[godot] bad --window-scale value: " + v + " (want 0 < N <= 8)");
        return false;
      }
      out.window_scale_given = true;
    } else if (a == "--window-size") {
      if (!need(i, v)) return false;
      // `WxH`（大小写都认，分隔符 `x` 或 `X`）——与 Godot 自己的 `--resolution WxH` 同形。
      int w = 0;
      int h = 0;
      if (std::sscanf(v.c_str(), "%dx%d", &w, &h) != 2 || w < 1 || h < 1 || w > 16384 || h > 16384) {
        print_error("[godot] bad --window-size value: " + v + " (want WxH, e.g. 1191x675)");
        return false;
      }
      out.window_w = w;
      out.window_h = h;
    } else if (a == "--icons") {
      if (!need(i, v)) return false;
      out.icons = std::filesystem::path(v);
      out.icons_given = true;
    } else if (a == "--click-frame") {
      if (!need(i, v)) return false;
      out.click_frame = std::atoi(v.c_str());
      if (out.click_frame < 0) return false;
    } else if (a == "--key" || a == "--key-down" || a == "--key-up") {
      if (!need(i, v)) return false;
      out.key_specs.push_back(Args::KeySpec{
          a == "--key" ? "tap" : (a == "--key-down" ? "down" : "up"), v});
    } else if (a == "--key-frame") {
      if (!need(i, v)) return false;
      out.key_frame = std::atoi(v.c_str());
      if (out.key_frame < 0) return false;
    } else if (a == "--key-tap") {
      if (!need(i, v)) return false;
      out.key_tap = std::atoi(v.c_str());
      if (out.key_tap < 1) return false;
    } else if (a == "--ui-dump") {
      out.ui_dump = true;
    } else if (a == "--clip-probe") {
      out.clip_probe = true;
    } else if (a == "--display-scale") {
      if (!need(i, v)) return false;
      out.display_scale = std::strtod(v.c_str(), nullptr);
      if (!(out.display_scale > 0.0)) return false;
    } else if (a == "--ui-page") {
      if (!need(i, v)) return false;
      out.ui_page = from_utf8(v);
    } else if (a == "--text-input") {
      if (!need(i, v)) return false;
      // `<text>[@<frame>]`：只在尾部 `@<digits>` 才算帧号（文本里可以有别的东西）。
      std::string text = v;
      const std::size_t at = text.rfind('@');
      if (at != std::string::npos && at + 1 < text.size() &&
          text.find_first_not_of("0123456789", at + 1) == std::string::npos) {
        out.text_input_frame = std::atoi(text.c_str() + at + 1);
        text.resize(at);
      }
      out.text_input = from_utf8(text);
      out.text_input_given = true;
    } else {
      return false;
    }
  }
  if (out.roots.empty()) out.roots.emplace_back(".");
  // 窗口那一套的缺省按**跑法**定（与"玩/验收"这条岔路口一致）：`--play` = Electron 那一套
  //（无边框 + 自绘栏 + 1.5× 窗口），其余（`--frames` 验收、headless、截图）原样不动。
  if (!out.titlebar_given) out.titlebar = out.play ? TitlebarMode::custom : TitlebarMode::native;
  if (!out.window_scale_given) out.window_scale = out.play ? 1.5 : 1.0;
  // 0 = 自动：开放模式缺省静默（不打帧摘要），验收模式缺省每 60 帧一行。
  if (out.every <= 0) out.every = out.play ? 0 : 60;
  if (!out.screenshot.empty() && out.shot_frame < 0) out.shot_frame = 120;
  if (out.frames < 0) return false;
  for (const std::string& spec : out.click_specs) {
    Args::ClickAt click;
    if (!parse_click_spec(spec, out.click_frame, click.x, click.y, click.frame)) {
      print_error("[godot] bad --click value: " + spec + " (want <x>,<y>[@<frame>])");
      return false;
    }
    out.clicks.push_back(click);
  }
  for (const std::string& spec : out.window_click_specs) {
    Args::ClickAt click;
    if (!parse_click_spec(spec, out.click_frame, click.x, click.y, click.frame)) {
      print_error("[godot] bad --click-window value: " + spec + " (want <x>,<y>[@<frame>])");
      return false;
    }
    click.window_space = true;
    out.clicks.push_back(click);
  }
  for (const std::string& spec : out.hover_specs) {
    Args::ClickAt click;
    if (!parse_click_spec(spec, out.click_frame, click.x, click.y, click.frame)) {
      print_error("[godot] bad --hover-window value: " + spec + " (want <x>,<y>[@<frame>])");
      return false;
    }
    click.window_space = true;
    click.hover = true;
    out.clicks.push_back(click);
  }
  for (const Args::KeySpec& spec : out.key_specs) {
    const size_t at = spec.text.find('@');
    const std::string name = at == std::string::npos ? spec.text : spec.text.substr(0, at);
    int frame = out.key_frame;
    if (at != std::string::npos) frame = std::atoi(spec.text.substr(at + 1).c_str());
    if (name.empty() || frame < 0) {
      print_error("[godot] bad --key value: " + spec.text + " (want <name>[@<frame>])");
      return false;
    }
    const std::u16string key = dom_key_of_name(name);
    if (spec.kind == "tap") {
      out.keys.push_back(Args::KeyAt{frame, true, key});
      out.keys.push_back(Args::KeyAt{frame + out.key_tap, false, key});
    } else {
      out.keys.push_back(Args::KeyAt{frame, spec.kind == "down", key});
    }
  }
  std::stable_sort(out.keys.begin(), out.keys.end(),
                   [](const Args::KeyAt& a, const Args::KeyAt& b) { return a.frame < b.frame; });
  return !out.zips.empty() && (out.play || out.frames > 0);
}

void LfwGodot::_ready() {
  const std::vector<std::string> argv = user_args();
  if (argv.empty()) {
    print_line("[godot] no LFW arguments after `--`; nothing to do.");
    print_line(usage());
    return;  // 编辑器里直接打开这个项目时不留副作用
  }
  _args = Args{};
  if (argv.size() == 1 && (argv[0] == "--help" || argv[0] == "-h")) {
    print_line(usage());
    return;
  }
  if (!parse_args(argv, _args)) {
    print_error("[godot] bad arguments");
    print_line(usage());
    quit_with(64);
    return;
  }
  // 开窗/缩放那一半的"逻辑屏幕"：`project.godot` 的 `display/window/size/viewport_*`（= 数据里的
  // 794×450；`logical_size()` 在装载之前就用它）。stretch 关掉后 `get_visible_rect()` 不再等于它
  // ⇒ 只能从这里读。装载之后一律以数据里那份为准（`ui_screen_size()`）。
  if (godot::ProjectSettings* const settings = godot::ProjectSettings::get_singleton()) {
    _logical_w = static_cast<int>(settings->get_setting("display/window/size/viewport_width", _logical_w));
    _logical_h =
        static_cast<int>(settings->get_setting("display/window/size/viewport_height", _logical_h));
  }
  // 窗口放在装包**之前**：无边框要在第一帧之前就设上（不然系统边框会闪一下），而且它不依赖数据。
  apply_window_setup();
  setup_icons();  // 自绘顶栏那 11 张图：与数据无关（在仓库的 `src/assets` 里，不在数据包里）
  if (!setup()) {
    quit_with(1);
    return;
  }
  // ⚠ GDExtension 必须显式打开输入处理，不然引擎不会调 `_input`（默认关）。
  set_process_input(true);
  _running = true;
  // 证据行：这一局开窗时条上有哪几个控件（`src/App.tsx` 那 11 个 `Show show=` 的求值结果）。
  if (titlebar_visible()) report_titlebar_controls();
}

bool LfwGodot::setup() {
  _host = std::make_unique<LfwGodotHost>(_args.roots, false);
  // ⚠ 文字度量必须在 `LFW::load` **之前**装好：UI 数据（`cook_ui_info` 的 `txt_info`）在装载期
  // 就按度量定尺寸（`lfw.host().measure_text`），装晚了整页的文本节点都是 0 尺寸。
  install_text_metrics();
  // 音频插座同理：装载期与页面创建期就会有 `sounds_load` / `sounds_play_bgm`（启动页预载 093、
  // `CMD.BGM` 起 BGM）。播放器节点在这里建（`setup()` 跑在 `_ready()` 里，node 已经在树上）。
  install_audio();
  // 时钟 / 定时器在手（`ManualClock::add → 0`）⇒ 端口自己的 `Ticker` 不自驱（§G3 第 2 条）。
  // 必须在 `LFW` 构造**之前**装好：`host.now()` 给 `MersenneTwister` 播种（§G9）。
  lfw::set_clock(&_host->clock());
  lfw::set_timeout(&_host->timeout());
  _host->clock().set(_args.time);

  std::vector<lfw::LFW::ZipItem> items;
  for (const std::filesystem::path& dir : _args.zips) {
    std::error_code ec;
    if (!std::filesystem::is_directory(dir, ec)) {
      print_error("[godot] not a directory: " + dir.generic_string() + " (cwd=" + cwd_string() + ")");
      return false;
    }
    _zips.push_back(std::make_unique<FsZip>(from_utf8(dir.generic_string()), dir));
    items.push_back(lfw::LFW::ZipItem{u"", _zips.back().get()});
    char buf[256];
    std::snprintf(buf, sizeof(buf), "[godot] package: %s (%zu entries)", dir.generic_string().c_str(),
                  _zips.back()->entry_count());
    print_line(buf);
  }

  // ⚠ 版本号必须在 **`LFW` 构造之前**写：构造函数就把 `VERSION_NAME` 塞进 i18n 的基准表
  //（`lfw.cpp:269`），晚了 `version_name` 那个节点拿到的还是 `v0.0.0`。
  // TS 那边同理：`init.ts:86` 在模块加载期就设了静态量，早于任何实例。
  const std::string version_text = resolve_version_name();
  LFW::VERSION_NAME() = from_utf8(version_text);
  print_line("[godot] version name: " + version_text);

  _lfw = std::make_unique<lfw::LFW>(*_host, false);

  // ---- 语言（也在 `load` **之前**）----
  // Web 版那边在 `useLFW` 的 `setup(lfw)` 里、`lfw.load(...)` 之前设：
  //   `lfw.lang = params.lang ?? navigator.language.toLowerCase()`（`App.tsx:404-411`）
  // 端口这边 `load` 是**同步**的、建 UI 节点就在里面 ⇒ 必须在此之前设好，
  // 否则整页文字停在旧语言（`set_lang` 的"重写节点文本"那一半只在改语言时起作用）。
  {
    std::u16string lang = _args.lang;
    if (lang.empty()) {
      const godot::String locale = godot::OS::get_singleton()->get_locale();  // 例：`zh_CN`
      std::string s = locale.utf8().get_data();
      for (char& c : s) {
        if (c == '_') c = '-';
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
      }
      lang = from_utf8(s);
    }
    if (!lang.empty()) {
      _lfw->set_lang(Value(lang));
      print_line("[godot] ui lang: " + to_utf8(lang));
    }
  }

  std::u16string error;
  if (!_lfw->load(items, error)) {
    print_error("[godot] load failed: " + to_utf8(error));
    for (const std::u16string& e : _host->last_errors()) print_error("  - " + to_utf8(e));
    return false;
  }
  {
    char buf[320];
    std::snprintf(buf, sizeof(buf),
                  "[godot] loaded: fighters=%zu weapons=%zu balls=%zu entities=%zu stages=%zu "
                  "bg=%zu bots=%zu moves=%zu directors=%zu",
                  _lfw->datas().fighters().size(), _lfw->datas().weapons().size(),
                  _lfw->datas().balls().size(), _lfw->datas().entities().size(),
                  _lfw->datas().stages().size(), _lfw->datas().backgrounds().size(),
                  _lfw->datas().bots().size(), _lfw->datas().moves().size(),
                  _lfw->datas().directors().size());
    print_line(buf);
  }
  // 证据行：UI 用到了哪些字族、引擎最后给的是哪个字体（`style.font` 里的 `Arial` 解析没解析到）。
  print_line("[godot] ui fonts: " + _fonts.describe());

  // ---- 装好这场对局：与 `lfw_run` 共用 `boot_scene`（不另写一条装配路径）----
  // ⚠ 开放模式（`--play`）**不**走这里：那是"玩"，入口是数据自己的首页 `init`（启动页 → 点
  // 进去 → 菜单 → …），宿主不替玩家把场景摆好。验收模式（`--frames N`）才强制造场景。
  if (_args.play) {
    print_line("[godot] play mode: no boot_scene; the entry UI page drives (entry page: init)");
  } else {
    BootOptions boot;
    boot.fighters = _args.fighters;
    boot.stage = _args.stage;
    boot.players = _args.players;
    boot.vs = _args.vs;
    boot.on_spawn = [](const SpawnInfo& s) {
      char buf[320];
      std::snprintf(buf, sizeof(buf), "[godot] spawn p%s %s @(%.1f, %.1f, %.1f) team=%s%s",
                    to_utf8(s.player_id).c_str(), to_utf8(s.fighter_id).c_str(), s.x, s.y, s.z,
                    to_utf8(s.team).c_str(), s.vs ? " (vs)" : "");
      print_line(buf);
    };
    boot.on_failure = [](const BootFailure& f) {
      print_error(f.create_failed ? "[godot] create fighter failed: " + to_utf8(f.fighter_id)
                                  : "[godot] fighter data not found: " + to_utf8(f.fighter_id));
      return true;  // `lfw_run` 口径：记账后继续
    };
    const BootResult booted = boot_scene(*_lfw, boot);
    if (!booted.ok) {
      print_error("[godot] no fighter data in the loaded packages");
      return false;
    }
    char buf[320];
    std::snprintf(buf, sizeof(buf), "[godot] stage=%s bg=%s entities=%zu",
                  to_utf8(booted.stage_id).c_str(), to_utf8(booted.bg_id).c_str(),
                  _lfw->world().entities.size());
    print_line(buf);
  }

  // ---- `--ui-page <id>`：装载后把这一页设到第 0 层（与 TS 里"点进这一页"等价的一次
  // `UILayers.set_page`；不传就用数据自己的首页 `init`）。id 必须真在烹饪好的 UI 表里 ——
  // 否则 `set_page` 会静默建一个空页（`UILayer::create_page` 找不到 id 时回 nullptr）。
  if (!_args.ui_page.empty()) {
    bool found = false;
    for (const Value& v : _lfw->ui_helper().all()) {
      const Value id = lfw::field_or(v, u"id");
      const std::u16string* const s = std::get_if<std::u16string>(&id);
      if (s != nullptr && *s == _args.ui_page) {
        found = true;
        break;
      }
    }
    if (!found) {
      print_error("[godot] --ui-page: no such page id: " + to_utf8(_args.ui_page));
      return false;
    }
    auto opts = std::make_shared<lfw::Object>();
    opts->set(u"id", Value(_args.ui_page));
    _lfw->set_page(Value(std::move(opts)), 0.0);
    print_line("[godot] ui page: " + to_utf8(_args.ui_page));
  }

  // 固定步长来自数据本身（`dataset.UPS`），与 `lfw_run` 同一口径。
  lfw::World& world = _lfw->world();
  const double ups = num_field(world.dataset.get(u"UPS"), 60.0);
  _host->set_step_ms(1000.0 / (ups > 0 ? ups : 60.0));

  // 纹理缓存（§G2：图片解码归宿主）：字节走渲染器的资源读（数据包 → 根目录），解码用引擎的
  // PNG 解码器。渲染器是 `LFW` 构造里 `create_world_renderer` 建的 ⇒ 这时候一定在。
  if (_host->world_renderer() != nullptr) {
    _textures = std::make_unique<GodotTextureCache>([this](const std::string& path,
                                                          std::string& out) {
      GodotWorldRenderer* const renderer = _host->world_renderer();
      return renderer != nullptr && renderer->read_resource(path, out);
    });
    // `frame.model` 的离屏画布池：与纹理缓存同一份资源读（数据包 → 根目录）。
    _models = std::make_unique<GodotModelBank>([this](const std::string& path, std::string& out) {
      GodotWorldRenderer* const renderer = _host->world_renderer();
      return renderer != nullptr && renderer->read_resource(path, out);
    });
    _models->set_parent(this);
  }
  if (_host->world_renderer() != nullptr) _host->world_renderer()->set_ui_dump(_args.ui_dump);
  return true;
}

// 文字度量：D4 把字体度量划给宿主。这一份按 `style.font` 里的**字族**挑字体（`Arial` 等，
// 与浏览器 `ctx.font` 同一口径），量不到的落回引擎的 fallback 字体。
// 口径与 TS 的 `ImageMgr.measure_text` 对齐：返回 `{text, style, w, h, scale}`，核心的
// `auto_size_by_text` 读 `w/h/scale` 定节点尺寸（`uinode.cpp:193-203`）。
// ⚠ 与浏览器**同一个字族**、同一台机器上稳定；字族缺失时才落回引擎字体（那时宽度会有偏差）。
void LfwGodot::install_text_metrics() {
  if (_host == nullptr) return;
  godot::ThemeDB* const db = godot::ThemeDB::get_singleton();
  _fonts.set_fallback(db != nullptr ? db->get_fallback_font() : godot::Ref<godot::Font>());
  if (_fonts.fallback().is_null()) {
    print_line("[godot] ui text metrics: no fallback font (零尺寸桩)");
  } else {
    char buf[200];
    std::snprintf(buf, sizeof(buf), "[godot] ui text metrics: fallback font (%s)",
                  _fonts.fallback()->get_font_name().utf8().get_data());
    print_line(buf);
  }
  _host->set_measure_text([this](const Value& text_v, const Value& style_v) -> Value {
    const std::u16string s = lfw::to_string(text_v);
    const std::string utf8 = to_utf8(s);
    // `DEFAULT_FONT`（`TextMesh.ts:11-12`）：没写 `style.font` 时是 `9px Arial`。
    CssFont spec;
    spec.family = "Arial";
    spec.size_px = 9;
    const lfw::Object* const style = lfw::as_object(style_v);
    std::string css;
    if (style != nullptr) {
      const Value* const font = style->get(u"font");
      if (font != nullptr) {
        const std::u16string* const f = std::get_if<std::u16string>(font);
        if (f != nullptr && !f->empty()) css = to_utf8(*f);
      }
    }
    if (!css.empty()) {
      const CssFont parsed = parse_css_font(css);
      spec.family = parsed.family.empty() ? spec.family : parsed.family;
      if (parsed.size_px > 0) spec.size_px = parsed.size_px;
      spec.weight = parsed.weight;
      spec.italic = parsed.italic;
    }
    double font_size = spec.size_px > 0 ? spec.size_px : 9;
    const godot::Ref<godot::Font> font = _fonts.get(spec);
    // ⚠ TS 的 `measure_text` 走 `TextMesh.split_text_to_lines`，它把**内边距**算进 `w/h`：
    // `w += padding_l + padding_r`、`h += padding_t + padding_b`（`TextMesh.ts:28-29`），
    // 缺省四边都是 2（`UITextRenderer._normalize_style`）。节点尺寸就是按这个 `w/h` 定的
    //（`auto_size_by_text`）⇒ 少了它就比 Web 版**窄 4、矮 4**（对拍时一眼能看出：`version_name`
    // 172.6×14 ↔ 169×11）。
    double pad_l = 2.0;
    double pad_r = 2.0;
    double pad_t = 2.0;
    double pad_b = 2.0;
    if (style != nullptr) {
      const auto pad_of = [style](const char16_t* key) {
        const Value* const v = style->get(key);
        if (v == nullptr) return 2.0;
        const double n = to_number(*v);
        return std::isnan(n) ? 2.0 : n;
      };
      pad_l = pad_of(u"padding_l");
      pad_r = pad_of(u"padding_r");
      pad_t = pad_of(u"padding_t");
      pad_b = pad_of(u"padding_b");
    }
    double w = 0.0;
    double h = 0.0;
    if (!font.is_null()) {
      const int size = static_cast<int>(std::lround(font_size));
      const int px = size > 0 ? size : 1;
      // 逐行：`w` 取最宽的一行、`h` 累加（TS `split_text_to_lines` 同一口径：**只按 `\n` 切**、
      // 不折行 —— 那一侧画布尺寸就是文字的自然尺寸）。
      std::size_t start = 0;
      int lines = 0;
      while (true) {
        const std::size_t nl = utf8.find('\n', start);
        const std::string line = utf8.substr(start, nl == std::string::npos ? std::string::npos
                                                                            : nl - start);
        const godot::Vector2 sz = font->get_string_size(String::utf8(line.c_str()),
                                                        godot::HORIZONTAL_ALIGNMENT_LEFT, -1.0f, px);
        if (static_cast<double>(sz.x) > w) w = static_cast<double>(sz.x);
        ++lines;
        if (nl == std::string::npos) break;
        start = nl + 1;
      }
      h = static_cast<double>(font->get_height(px)) * static_cast<double>(lines);
      w += pad_l + pad_r;
      h += pad_t + pad_b;
    }
    auto info = std::make_shared<lfw::Object>();
    info->set(u"text", text_v);
    info->set(u"style", style_v);
    info->set(u"w", Value(w));
    info->set(u"h", Value(h));
    info->set(u"scale", Value(1.0));
    return Value(info);
  });
}

godot::Ref<godot::Font> LfwGodot::font_for_css(const std::string& css) {
  CssFont spec;
  spec.family = "Arial";  // `DEFAULT_FONT`
  spec.size_px = 9;
  if (!css.empty()) {
    const CssFont parsed = parse_css_font(css);
    if (!parsed.family.empty()) spec.family = parsed.family;
    if (parsed.size_px > 0) spec.size_px = parsed.size_px;
    spec.weight = parsed.weight;
    spec.italic = parsed.italic;
  }
  return _fonts.get(spec);
}

// 左下角那行版本号。Web 版那一串在 `init.ts:86-89` 拼：
//   `v${VERSION_NAME}-${GIT_COMMIT_ID.substring(0,7)}${GIT_COMMIT_DIRTY ? '-' + dirty : ''}` + ' ' + BUILD_TIME
// 同一批字段就写在同一份构建产物里（`vite.config.ts:38-44` 的 `version.json`）⇒ 直接读它，
// 免得端口这边再走一遍 git/时间（那反而和 Web 版对不上）。
std::string LfwGodot::resolve_version_name() const {
  if (!_args.version_name.empty()) return _args.version_name;
  for (const std::filesystem::path& root : _args.roots) {
    const std::filesystem::path file = root / "version.json";
    std::error_code ec;
    if (!std::filesystem::is_regular_file(file, ec)) continue;
    std::ifstream in(file, std::ios::binary);
    if (!in) continue;
    const std::string text((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
    const std::optional<Value> parsed = json_parse(from_utf8(text));
    if (!parsed.has_value()) continue;
    const lfw::Object* const obj = lfw::as_object(*parsed);
    if (obj == nullptr) continue;
    const auto field = [obj](const char16_t* key) -> std::string {
      const Value* const v = obj->get(key);
      if (v == nullptr) return std::string();
      const std::u16string* const s = std::get_if<std::u16string>(v);
      if (s != nullptr) return to_utf8(*s);
      return to_utf8(lfw::to_string(*v));
    };
    const std::string version = field(u"version");
    if (version.empty()) continue;
    std::string name = "v" + version;    const std::string commit = field(u"commit");
    if (!commit.empty()) name += "-" + commit.substr(0, 7);
    if (field(u"dirty") == "true") name += "-dirty";
    const std::string time = field(u"time");
    if (!time.empty()) name += " " + time;
    return name;
  }
  return "v0.0.0";
}

// 每次按键都打一行"这个键落到了哪个**聚焦**节点、它有没有 `click` 动作"。
//
// 查的是"**按攻击没反应**"这一类：UI 里 `a`（攻击）只在**聚焦**节点上触发它的 `click`
//（`UINode::on_key_down` 那三行 `focused() && game_key … && click`），而**指针悬停**是另一层
// 高亮（悬停 ≠ 聚焦）⇒ "看着高亮、按了没反应"多半是聚焦在别的节点上（或压根没有聚焦节点）。
// 只在 `--play`（玩）时打，验收口径不受影响。
void LfwGodot::report_key_focus(const std::u16string& key) {
  if (!_args.play || _lfw == nullptr) return;
  const ui::UINode* focused = nullptr;
  const auto walk = [&focused](const ui::UINode* n, const auto& self) -> void {
    if (n == nullptr || focused != nullptr) return;
    if (n->focused()) {
      focused = n;
      return;
    }
    for (ui::UINode* const c : n->children()) {
      self(c, self);
      if (focused != nullptr) return;
    }
  };
  for (ui::UINode* const layer : _lfw->layer_nodes()) {
    if (layer == nullptr) continue;
    walk(layer, walk);
    if (focused != nullptr) break;
  }
  std::string id = "(none)";
  bool has_click = false;
  if (focused != nullptr) {
    const Value& data = focused->data();
    if (const Value* const raw_id = ui::field_of(data, u"id")) {
      if (const std::u16string* const s = std::get_if<std::u16string>(raw_id)) id = to_utf8(*s);
    }
    const Value* const actions = ui::field_of(data, u"actions");
    if (actions != nullptr) {
      if (const Value* const click = ui::field_of(*actions, u"click")) has_click = truthy(*click);
    }
  }
  print_line("[godot] keyfocus: key=" + to_utf8(key) + " focused=" + id +
             " click=" + (has_click ? "yes" : "no") + " pages=" + ui_pages_text());
}

void LfwGodot::_process(double p_delta) {
  if (!_running) return;
  // 音频的"回收"这一半：播完的音效通知宿主（= TS 的 `src_node.onended`）、随机 BGM 播完续抽。
  // 放在这里（每帧一次）而不是信号槽里：`AudioStreamPlayer.finished` 要靠 `_bind_methods` + Callable，
  // 而 16 ms 的回收延迟对 `1/sqrt(正在播的数量)` 那点衰减完全看不出来。
  audio_poll();
  // 截图：上一帧已经画完 ⇒ 视口纹理里就是那一帧。取完就收工（`--frames` 不再等）。
  if (_capture_pending) {
    _capture_pending = false;
    capture_screenshot();
    finish();
    return;
  }
  // 节拍只决定「这一帧推几步」；固定步长永远是 `_host->step_ms()`（§G3 第 3 条）。
  // ⚠ **有窗口就必须真墙钟**：以前一律用 `--delta`（验收惯例 0.017）当节拍，窗口里
  // `_process` 跑几百 fps 时就读作"每帧固定 17ms"⇒ 游戏按几十倍速跑（用户报的
  // "为什么游戏速度这么快"）。headless（验收 / 截图）保持固定节拍：`--frames N` 要飞快跑完，
  // 与机器快慢无关（步数与 `--frames` 一一对应，摘要只看步数）。
  const bool real_time =
      _args.frames <= 0 || godot::DisplayServer::get_singleton()->get_name() != "headless";
  double pacing = real_time ? p_delta : (_args.delta > 0.0 ? _args.delta : p_delta);
  if (!(pacing > 0.0)) pacing = 1.0 / 60.0;  // 节拍兜底：别让 0 delta 把验收卡死
  _host->accumulate(pacing);

  const int shot_at = _args.shot_frame > 0 ? _args.shot_frame : -1;
  bool stepped = false;
  while (_running && (unlimited() || _frames < _args.frames) && _host->can_step()) {
    GodotWorldRenderer* const renderer = _host->world_renderer();
    const long long before = renderer != nullptr ? renderer->renders() : 0;
    const int frame = _frames;
    // `--click`：命令先入队，接着这一步的 `World::step` 消化掉 ⇒ 打完这一帧再报页面。
    Args::ClickAt* const clicked = inject_clicks(frame);
    const Args::KeyAt* const keyed = inject_keys(frame);
    _host->push_frame(_lfw->world());
    render_world_frame(before);
    sync_text_input();       // UI 树里每个 `TextInput` 节点各摆一个 `LineEdit`（每步一次）
    probe_text_input(frame);  // `--text-input`：脚本化打字
    stepped = true;
    ++_frames;
    if (clicked != nullptr) {
      char buf[256];
      std::snprintf(buf, sizeof(buf), "[godot] %s @frame %d at=(%.1f, %.1f) pages=%s",
                    clicked->hover ? "hover-win" : (clicked->window_space ? "click-win" : "click"),
                    frame, clicked->x, clicked->y, ui_pages_text().c_str());
      print_line(buf);
    }
    if (keyed != nullptr) {
      const auto pressed = _host->pressed_keys().find(keyed->key);
      char buf[256];
      std::snprintf(buf, sizeof(buf), "[godot] key @frame %d %s %s times=%d pages=%s", frame,
                    keyed->down ? "down" : "up", to_utf8(keyed->key).c_str(),
                    pressed == _host->pressed_keys().end() ? 0 : pressed->second,
                    ui_pages_text().c_str());
      print_line(buf);
    }
    if (_args.every > 0 && (frame % _args.every == 0 || frame == _args.frames - 1)) {
      report_frame(frame);
    }
    if (shot_at >= 0 && _frames >= shot_at) {
      _capture_pending = true;  // 这一帧的绘制落在本帧末尾 ⇒ 下一帧再取视口
      break;
    }
  }
  if (stepped) queue_redraw();
  if (_capture_pending) return;
  if (!unlimited() && _frames >= _args.frames) finish();
}

// 每个 step 之后补一次 `World::render_once`（§D4：`sync_render != Sync` 时世界自己**不会**
// 渲染 —— `IRenderScheduler` 的槽在本宿主里是空的，与 `lfw_thin` 同款）。这一步只碰渲染器与
// UI 渲染面的计数，不改模拟（三条摘要实测不变；`render_cost` 只进诊断）。
void LfwGodot::render_world_frame(long long renders_before) {
  lfw::World& world = _lfw->world();
  GodotWorldRenderer* const renderer = _host->world_renderer();
  if (renderer == nullptr) return;
  // 世界自己渲染过（`sync_render == Sync/Half`）就不要再补一次。
  if (renderer->renders() == renders_before) world.render_once(_host->step_ms());
  const GodotFrame& frame = renderer->take_frame();  // 双缓冲：把写好的那一帧翻给 `_draw` 读
  // `frame.model`：这一帧出现的模型项各同步一次实例（摆位 + 动画），纹理留给 `_draw` blit。
  if (_models != nullptr) {
    _model_textures.clear();
    for (const GodotDrawItem& item : frame.items) {
      if (!item.has_model) continue;
      godot::Ref<godot::ViewportTexture> tex = _models->sync(item.tag, item.model);
      if (!tex.is_null()) _model_textures[item.tag] = tex;
    }
    _models->end_frame();
  }
}

// ---- 文本输入覆盖层（Web 的 DOM `<input>` 在 Godot 侧的等价物）----
//
// Web 那边 `UINodeRenderer.on_resume()` 给每个带 `TextInput` 组件的节点 `document.createElement('input')`
// 并挂进 CSS2D 那棵树（`.ui_node_style input`：透明底、无边框、`text-align:center`、字体/颜色继承）；
// 本宿主没有 DOM ⇒ 每个这样的节点摆一个**真的** `LineEdit`（引擎自带 IME/剪贴板/光标），口径逐条对齐：
//   * 位置/尺寸 = 那一帧 UI 树里该节点的方框（`GodotTextInputBox`，逻辑像素 → 画布像素）；
//   * 字体/字号/颜色/对齐 = 该节点的文字样式；`maxLength` 交给 `LineEdit::set_max_length`；
//   * 文本两个方向都**轮询**同步（不开信号）：`LineEdit` 改了 ⇒ 写组件 `text`（Web 的 `onchange`）；
//     组件改了（`on_resume` / `on_name_changed`）⇒ 写 `LineEdit`（Web 靠 DOM 值本来就是一份）；
//   * 引擎焦点 ⇄ 节点焦点：`has_focus()` 由无到有 ⇒ `set_focused(true)`；由有到无 ⇒
//     `set_focused(false)`（⇒ `PlayerNameInput::on_blur()` 存盘，与 Web 的 `onblur` 同一条）。
// 一页上有几个 `TextInput` 节点就摆几个（设置页 4 个玩家名就是 4 个框），按节点指针复用/回收，
// 页面一走（这一帧的 UI 树里没有它了）就整个拆掉，等价 Web 的 `on_pause()` → `release_dom()`。
void LfwGodot::sync_text_input() {
  GodotWorldRenderer* const renderer = _host != nullptr ? _host->world_renderer() : nullptr;
  if (renderer == nullptr) {
    destroy_text_input();
    return;
  }
  const std::vector<GodotTextInputBox>& boxes = renderer->ui_text_inputs();
  if (boxes.empty()) {
    destroy_text_input();
    return;
  }

  // 逻辑像素 → 画布像素（与 `apply_game_clip` 同一条复合变换）；整帧只算一次。
  const godot::Transform2D to_canvas =
      final_transform().affine_inverse() * contain_transform(window_size_px());
  const double scale_y = std::fabs(static_cast<double>(to_canvas.get_scale().y));

  std::vector<TextInputOverlay> next;
  next.reserve(boxes.size());
  for (const GodotTextInputBox& box : boxes) {
    TextInputOverlay* overlay = nullptr;
    for (TextInputOverlay& old : _text_inputs) {
      if (old.edit == nullptr || old.node != box.node) continue;
      next.push_back(std::move(old));
      // `std::move` 不会把裸指针清空 ⇒ 自己标成"已接管"，否则下面清理旧条目时会把它拆掉。
      old.edit = nullptr;
      old.node = nullptr;
      overlay = &next.back();
      break;
    }
    if (overlay == nullptr) {
      TextInputOverlay created;
      created.edit = memnew(godot::LineEdit);
      char name_buf[48];
      std::snprintf(name_buf, sizeof(name_buf), "lfw_text_input_%d",
                    static_cast<int>(next.size() + 1));
      created.edit->set_name(name_buf);
      created.edit->set_mouse_filter(godot::Control::MOUSE_FILTER_STOP);
      // `.ui_node_style input`：透明底 + 无边框（三态都给空的 `StyleBoxEmpty`）
      godot::Ref<godot::StyleBoxEmpty> flat;
      flat.instantiate();
      for (const char* const state : {"normal", "focus", "read_only"}) {
        created.edit->add_theme_stylebox_override(state, flat);
      }
      add_child(created.edit);
      created.node = box.node;
      created.shown = box.input->text();
      created.edit->set_text(String::utf8(to_utf8(created.shown).c_str()));
      next.push_back(std::move(created));
      overlay = &next.back();
    }

    // ---- 样式（字体/字号/颜色/对齐/长度上限）：值没变就不碰（`add_theme_*_override` 会刷缓存）----
    const std::optional<double> max_len = box.input->max_length();
    // 逻辑字号 → 画布像素（`contain` 那一层的缩放；`LineEdit` 的字号是像素口径、不跟缩放走，
    // 所以窗口缩放也进指纹 —— 拉窗口时得重设一次）。
    const int font_px = std::max(
        1, static_cast<int>(std::lround(box.font_size * (scale_y > 0.0 ? scale_y : 1.0))));
    char sig[320];
    std::snprintf(sig, sizeof(sig), "%s|%.3f|%.3f,%.3f,%.3f,%.3f|%d|%d|%d", box.font_css.c_str(),
                  box.font_size, box.r, box.g, box.b, box.a, box.text_align, font_px,
                  max_len.has_value() ? static_cast<int>(*max_len) : -1);
    if (std::string(sig) != overlay->style_sig) {
      overlay->style_sig = sig;
      godot::Ref<godot::Font> font = font_for_css(box.font_css);
      if (!font.is_null()) overlay->edit->add_theme_font_override("font", font);
      overlay->edit->add_theme_font_size_override("font_size", font_px);
      const godot::Color tint(static_cast<float>(box.r), static_cast<float>(box.g),
                              static_cast<float>(box.b), static_cast<float>(box.a));
      overlay->edit->add_theme_color_override("font_color", tint);
      overlay->edit->add_theme_color_override("font_uneditable_color", tint);
      overlay->edit->add_theme_color_override("font_placeholder_color", tint);
      overlay->edit->add_theme_color_override("caret_color", tint);
      overlay->edit->set_horizontal_alignment(
          box.text_align == 1
              ? godot::HORIZONTAL_ALIGNMENT_CENTER
              : (box.text_align == 2 ? godot::HORIZONTAL_ALIGNMENT_RIGHT
                                     : godot::HORIZONTAL_ALIGNMENT_LEFT));
      overlay->edit->set_max_length(max_len.has_value() ? static_cast<int>(*max_len) : 0);
    }

    // ---- 摆位：逻辑像素 → 画布像素（与 `apply_game_clip` 同一条复合变换）----
    const godot::Vector2 p0 = to_canvas.xform(godot::Vector2(static_cast<float>(box.x0),
                                                             static_cast<float>(box.y0)));
    const godot::Vector2 p1 = to_canvas.xform(godot::Vector2(static_cast<float>(box.x1),
                                                             static_cast<float>(box.y1)));
    overlay->edit->set_position(p0);
    overlay->edit->set_size(p1 - p0);

    // ---- 文本：谁改的就写另一边 ----
    const std::u16string shown =
        from_utf8(std::string(overlay->edit->get_text().utf8().get_data()));
    const bool edited = shown != overlay->shown;
    overlay->shown = shown;
    const std::u16string source = box.input->text();
    if (shown != source) {
      if (edited) {
        box.input->set_text(shown);
      } else {
        overlay->edit->set_text(String::utf8(to_utf8(source).c_str()));
        overlay->shown = source;
      }
    }
    overlay->synced = box.input->text();

    // ---- 焦点：引擎 ⇄ 节点 ----
    const bool has_focus = overlay->edit->has_focus();
    if (has_focus && !box.node->focused()) {
      box.node->set_focused(true);
    } else if (!has_focus && overlay->had_focus && box.node->focused()) {
      box.node->set_focused(false);  // ⇒ `on_blur()`（`PlayerNameInput` 在这里存盘）
    }
    overlay->had_focus = has_focus;
  }

  // 这一帧没有对应方框的旧覆盖层（页面弹出 / 节点不可见 / 换页）：释放焦点并拆掉。
  for (TextInputOverlay& stale : _text_inputs) {
    if (stale.edit == nullptr) continue;
    stale.edit->release_focus();
    remove_child(stale.edit);
    stale.edit->queue_free();
  }
  _text_inputs = std::move(next);
}

LfwGodot::TextInputOverlay* LfwGodot::last_text_input() {
  return _text_inputs.empty() ? nullptr : &_text_inputs.back();
}

void LfwGodot::destroy_text_input() {
  for (TextInputOverlay& overlay : _text_inputs) {
    if (overlay.edit == nullptr) continue;
    // ⚠ 不碰 `overlay.node`：页面弹出后节点可能已经被 `UILayer::_trash` 回收。组件那边
    // 每一帧都同步过（`set_text`），页面自己的 `on_stop()` 会存盘，所以这里只管拆控件。
    overlay.edit->release_focus();
    remove_child(overlay.edit);
    overlay.edit->queue_free();
  }
  _text_inputs.clear();
}

// `--text-input <text>[@<frame>]`：脚本化打字（`--key` 到不了引擎控件）。在这里走的是
// **真控件**那一条（`grab_focus` → `insert_text_at_caret` → `release_focus`），所以它证明的是
// 「覆盖层能不能收字 + 组件拿不拿得到 + `on_blur` 存不存盘」整条链。
void LfwGodot::probe_text_input(int frame) {
  if (!_args.text_input_given) return;
  const int at = _args.text_input_frame;
  TextInputOverlay* const overlay = last_text_input();
  if (frame == at) {
    if (overlay == nullptr) {
      print_error("[godot] text-input: no TextInput overlay on this page");
      return;
    }
    const bool had_focus = overlay->edit->has_focus();
    overlay->edit->grab_focus();
    overlay->edit->set_text(String());
    overlay->edit->set_caret_column(0);
    // 走插入而不是 `set_text`：`maxLength` 生效（Web 那边也是 DOM 自己截的）。
    overlay->edit->insert_text_at_caret(String::utf8(to_utf8(_args.text_input).c_str()));
    print_line("[godot] text-input @frame " + std::to_string(frame) + " type='" +
               to_utf8(_args.text_input) + "' focus=" + (had_focus ? "1" : "0") +
               " overlays=" + std::to_string(_text_inputs.size()));
    return;
  }
  if (frame == at + 2) {
    if (overlay != nullptr) overlay->edit->release_focus();
    return;
  }
  if (frame != at + 4) return;
  std::string players;
  const godot::Rect2 rect =
      overlay != nullptr
          ? godot::Rect2(overlay->edit->get_global_position(), overlay->edit->get_size())
          : godot::Rect2();
  if (_lfw != nullptr) {
    for (const std::pair<std::u16string, std::unique_ptr<PlayerInfo>>& kv : _lfw->players()) {
      if (!players.empty()) players += ",";
      players += to_utf8(kv.first) + ":" +
                 (kv.second != nullptr ? to_utf8(lfw::to_string(kv.second->name()))
                                      : std::string("-"));
    }
  }
  print_line("[godot] text-input done: overlay=" +
             std::string(overlay != nullptr ? "1" : "0") + " rect=" +
             (rect.size.x <= 0.0f
                  ? std::string("-")
                  : (std::to_string(static_cast<int>(rect.position.x)) + "," +
                     std::to_string(static_cast<int>(rect.position.y)) + " " +
                     std::to_string(static_cast<int>(rect.size.x)) + "x" +
                     std::to_string(static_cast<int>(rect.size.y))))
                  + " shown='" +
             to_utf8(overlay != nullptr ? overlay->shown : std::u16string()) + "' comp='" +
             to_utf8(overlay != nullptr ? overlay->synced : std::u16string()) + "' players=" +
             (players.empty() ? std::string("-") : players));
}

// ---- 指针：平台事件 → `LfwPointingEvent` → `POINTER_*` 命令 ----
//
// 坐标：绘制项按**逻辑屏幕像素**画（`GodotUINodeRenderer` 的 `_box_*`，左上原点、y 向下），
// 事件进来时是**画布像素**（OS 事件与 `push_input(ev, false)` 都按 `final_transform()` 的逆换过
// 一遍）⇒ `_input()` 里再按 `contain_transform()` 的逆换回逻辑像素（`ui_scene_of_point` 也按它反算
// `scene`，与 `UiInputHandle` 的 `to_ui` 互逆：`sx = x/w*2-1`、`sy = -(y/h)*2+1`）。控件（`ScrollView`
// 等）自己也是按这两条公式从 `scene_x/scene_y` 反算的，所以对得上。
void LfwGodot::ui_screen_size(double& w, double& h) const {
  const lfw::host::UiScreenSize s = lfw::host::ui_screen_size(_lfw->world());
  w = s.w;
  h = s.h;
}

// ---- 窗口像素 ⇄ 逻辑像素：宿主自己做的 contain + 居中（`project.godot` 的 stretch 是 disabled）----
//
// 引擎在 `canvas_items` 下替宿主做的那三件事（缩放/偏移、输入换算、把画布关在内容区里），stretch
// 关掉之后一件也不剩 ⇒ 全在这里补上，口径照 `Window::_update_viewport_size()` 的 keep 分支
//（`desired_res` = 逻辑尺寸、`screen_size` 先 floor、偏移 round、逐轴缩放）。四舍五入的半像素按
// `round` 走（与引擎同：1191×900 ⇒ 上下黑边 113/112，不是 112/113）。
void LfwGodot::logical_size(double& w, double& h) const {
  if (_lfw != nullptr) {  // 装载之后以**端口**的逻辑屏幕为准（`ui_screen_size()` 那一份）
    ui_screen_size(w, h);
    return;
  }
  w = static_cast<double>(_logical_w);  // 装载之前 = `project.godot` 的开窗尺寸（同一个数）
  h = static_cast<double>(_logical_h);
}

godot::Rect2 LfwGodot::contain_rect(const godot::Vector2i& window_size) const {
  double lw = 0.0;
  double lh = 0.0;
  logical_size(lw, lh);
  const double vw = static_cast<double>(window_size.x);
  const double vh = static_cast<double>(window_size.y);
  if (!(vw > 0.0) || !(vh > 0.0) || !(lw > 0.0) || !(lh > 0.0)) return godot::Rect2();
  const double aspect_l = lw / lh;
  const double aspect_v = vw / vh;
  // 比例相同就不补黑边（引擎那一侧用的是 `is_equal_approx`：相对容差 1e-5）；否则等比 contain。
  const bool same = aspect_l == aspect_v || std::fabs(aspect_l - aspect_v) <
                                                 std::max(1e-5 * std::fabs(aspect_l), 1e-5);
  double sx = vw;
  double sy = vh;
  if (!same) {
    if (aspect_l < aspect_v) {
      sx = vh * aspect_l;  // 窗口更宽 ⇒ 左右补黑边
    } else {
      sy = vw / aspect_l;  // 窗口更高 ⇒ 上下补黑边
    }
  }
  sx = std::floor(sx);
  sy = std::floor(sy);
  const double ox = sx < vw ? std::round((vw - sx) * 0.5) : 0.0;
  const double oy = sy < vh ? std::round((vh - sy) * 0.5) : 0.0;
  return godot::Rect2(static_cast<float>(ox), static_cast<float>(oy), static_cast<float>(sx),
                      static_cast<float>(sy));
}

godot::Transform2D LfwGodot::contain_transform(const godot::Vector2i& window_size) const {
  double lw = 0.0;
  double lh = 0.0;
  logical_size(lw, lh);
  const godot::Rect2 rect = contain_rect(window_size);
  if (!(lw > 0.0) || !(lh > 0.0) || !(rect.size.x > 0.0f) || !(rect.size.y > 0.0f)) {
    return godot::Transform2D();
  }
  godot::Transform2D xform;
  xform.set_scale(godot::Vector2(static_cast<float>(rect.size.x / lw),
                                 static_cast<float>(rect.size.y / lh)));
  xform.set_origin(godot::Vector2(rect.position));
  return xform;
}

godot::Vector2i LfwGodot::window_size_px() const {
  godot::DisplayServer* const ds = godot::DisplayServer::get_singleton();
  if (_windowed && ds != nullptr && ds->window_get_size() != godot::Vector2i()) {
    return ds->window_get_size();
  }
  const godot::Viewport* const vp = get_viewport();
  return vp != nullptr ? godot::Vector2i(vp->get_visible_rect().size) : godot::Vector2i();
}

godot::Transform2D LfwGodot::final_transform() const {
  const godot::Viewport* const vp = get_viewport();
  return vp != nullptr ? vp->get_final_transform() : godot::Transform2D();
}

// 游戏那一层的裁剪：`clip` + `custom_rect`（这一项**自己的**命令与其子项都按矩形裁，见
// `renderer_canvas_cull.cpp` 的 `ci->final_clip_rect` / `ci->final_clip_owner`，渲染时是一刀的
// scissor）⇒ 逻辑屏幕外的绘制（刚出界一点点的实体/UI）不会漏进黑边。矩形给的是**画布坐标**
//（内容矩形经 `final_transform()` 的逆；stretch 关掉后画布就是窗口像素，平时这两个数一样）。
// ⚠ 自绘顶栏就在同一项上画，它必须**越过**这条裁剪 ⇒ `_draw()` 里 `canvas_item_add_clip_ignore`。
void LfwGodot::apply_game_clip(const godot::Vector2i& window_size) {
  godot::RenderingServer* const rs = godot::RenderingServer::get_singleton();
  if (rs == nullptr || !_windowed) return;
  const godot::RID item = get_canvas_item();
  rs->canvas_item_set_custom_rect(item, true,
                                  final_transform().affine_inverse().xform(contain_rect(window_size)));
  rs->canvas_item_set_clip(item, true);
}

// 字体过采样：引擎在 `canvas_items` 下自动取的就是 `MAX(内容缩放)`（`Viewport::_set_size()`）
// —— stretch 关掉后它变成 1.0，文字会按 1.0 光栅化再被 contain 的矩阵放大 ⇒ 1.5× 开窗时糊。
// `set_oversampling_override` 自己会重跑一遍 `_set_size()`（值没变就是空操作）。
void LfwGodot::apply_font_oversampling(const godot::Transform2D& contain) {
  godot::Viewport* const vp = get_viewport();
  if (vp == nullptr) return;
  const godot::Vector2 scale = contain.get_scale();
  const double over = std::max(static_cast<double>(scale.x), static_cast<double>(scale.y));
  if (!(over > 0.0)) return;
  vp->set_oversampling_override(static_cast<float>(over));
}

// 证据行（`native/README.md`「窗口外观」引的就是它）：stretch 关掉之后 `window:` 那一行里的
// `content=` 不再来自引擎（`get_final_transform()` 只在 canvas_items 下带那道缩放），
// 所以缩放/偏移/过采样在这里单独打一行，值变了（改窗口尺寸）再打。
void LfwGodot::report_stretch(const godot::Transform2D& contain, const godot::Rect2& content) {
  double lw = 0.0;
  double lh = 0.0;
  logical_size(lw, lh);
  const godot::Vector2 scale = contain.get_scale();
  const double over = std::max(static_cast<double>(scale.x), static_cast<double>(scale.y));
  // `viewport=` / `final=` 是"画布是什么"的自证：stretch 关掉后视口 = 整窗、`final_transform()` 只剩
  // DPI/`display/window/stretch/scale` 那一档（本机都是 1 ⇒ 单位阵）。`screen_scale=` 是**屏幕**的缩放
  //（顶栏按它换算 CSS 像素 → 物理像素，`--display-scale` 可覆盖），`content_scale=` 是引擎自己那一位。
  const godot::Vector2i vp_size = window_size_px();
  const godot::Transform2D final = final_transform();
  const double screen_scale = titlebar_display_scale();
  double content_scale = 1.0;
  if (godot::Viewport* const vp = get_viewport()) {
    if (const godot::Window* const win = godot::Object::cast_to<godot::Window>(vp)) {
      content_scale = static_cast<double>(win->get_content_scale_factor());
    }
  }
  char buf[448];
  std::snprintf(buf, sizeof(buf),
                "[godot] stretch: mode=disabled logical=%.0fx%.0f content=%.0fx%.0f+%.0f+%.0f "
                "scale=%.5fx%.5f oversampling=%.3f viewport=%dx%d final=%.5fx%.5f "
                "screen_scale=%.3f content_scale=%.3f",
                lw, lh, content.size.x, content.size.y, content.position.x, content.position.y,
                scale.x, scale.y, over, vp_size.x, vp_size.y, final.get_scale().x,
                final.get_scale().y, screen_scale, content_scale);
  const std::string line(buf);
  if (line == _stretch_report) return;
  _stretch_report = line;
  print_line(line);
}

// ---- 窗口：无边框 + 自绘标题栏 + 缩放（Electron 端那一套的引擎侧等价物）----
//
// 对位 `desktop/app/main.mjs:915` 的 `frame: false`、`src/App.tsx:788-811` 自绘的那三个按钮，以及
// 那边 `1191×675 = 794×450 × 1.5` 的窗口。逻辑屏幕**永远是** 794×450，`project.godot` 的 stretch 是
// **disabled** ⇒ contain/缩放/输入换算/裁剪全在宿主这一侧（`contain_transform()` 那一节），
// 自绘顶栏则按**窗口像素**画（`get_final_transform()` 的逆；stretch 关掉后基本就是单位阵）。
// 边缘方向 → 缩放游标形状。⚠ 两个**对角**形状（`FDIAGSIZE` / `BDIAGSIZE`）的命名在 Godot 里
// 没有逐个核对过（有的 UI 把正向对角当 `\`、有的当 `/`）⇒ 万一反了只是光标图标镜像，不影响拖拽。
inline godot::DisplayServer::CursorShape cursor_for_edge(TitleEdge edge) {
  using DS = godot::DisplayServer;
  switch (edge) {
    case TitleEdge::left:
    case TitleEdge::right:
      return DS::CURSOR_HSIZE;
    case TitleEdge::top:
    case TitleEdge::bottom:
      return DS::CURSOR_VSIZE;
    case TitleEdge::top_left:
    case TitleEdge::bottom_right:
      return DS::CURSOR_FDIAGSIZE;
    case TitleEdge::top_right:
    case TitleEdge::bottom_left:
      return DS::CURSOR_BDIAGSIZE;
    case TitleEdge::none:
    default:
      return DS::CURSOR_ARROW;
  }
}

void LfwGodot::apply_window_setup() {
  using godot::DisplayServer;
  DisplayServer* const ds = DisplayServer::get_singleton();
  if (ds == nullptr) return;
  const std::string display(ds->get_name().utf8().get_data());
  // headless 没有窗口（也就没有边框/装饰/缩放）：一个窗口 API 都不碰（省得引擎打 warn），
  // 栏也不画 ⇒ 三条摘要那一路完全没变。
  if (display == "headless") {
    print_line("[godot] window: headless display server (no window, no titlebar)");
    return;
  }
  _windowed = true;
  // 无边框（Windows 上是 `WS_POPUP`）只给 `none`/`custom`；`native` 与 `frame` 都保留系统边框。
  const bool borderless =
      _args.titlebar == TitlebarMode::none || _args.titlebar == TitlebarMode::custom;
  if (borderless) {
    ds->window_set_flag(DisplayServer::WINDOW_FLAG_BORDERLESS, true);
  } else if (_args.titlebar == TitlebarMode::frame) {
    // `frame`：**留着**系统边框（`WS_THICKFRAME` 那一套 ⇒ 原生缩放 / Aero Snap / 最大化 / DWM 阴影），
    // 只把客户区顶到标题栏位置（`EXTEND_TO_TITLE`）⇒ 看不见系统标题栏 —— 就是 Electron `frame:false`
    // 在 Windows 上做的那件事（保留 `WS_THICKFRAME`、用 `WM_NCCALCSIZE` 让出 caption 那一块）。
    // ⚠ **实测（Godot 4.7.1 / Windows）：这一枚是空操作** —— `platform/windows/**` 里根本没有
    // `extend_to_title`（只在 macOS 后端实现；`doc/classes/DisplayServer.xml` 也写着 implemented only
    // on macOS）：设完读回来还是 0，`deco` 仍比 `size` 高一条 caption，Win32 的 `WS_CAPTION` 也还在
    //（外部 GetWindowLong 量过）。所以这一档只用来说明"Godot 现在办不到"，见下面的 verdict 行与
    // `native/README.md`「窗口外观」那张表。
    ds->window_set_flag(DisplayServer::WINDOW_FLAG_EXTEND_TO_TITLE, true);
    const bool took = ds->window_get_flag(DisplayServer::WINDOW_FLAG_EXTEND_TO_TITLE);
    const godot::Vector2i win = ds->window_get_size();
    const godot::Vector2i decorated = ds->window_get_size_with_decorations();
    char verdict[224];
    std::snprintf(verdict, sizeof(verdict),
                  "[godot] titlebar: frame -> extend_to_title read-back=%d feature=%d "
                  "size=%dx%d deco=%dx%d %s",
                  took ? 1 : 0, ds->has_feature(DisplayServer::FEATURE_EXTEND_TO_TITLE) ? 1 : 0,
                  win.x, win.y, decorated.x, decorated.y,
                  took ? "(customer area covers the caption area)"
                       : "(NO-OP on this platform: the OS caption is still there)");
    print_line(verdict);
  }
  // 窗口 = **逻辑屏幕** × `--window-scale`。逻辑屏幕在装载之前从 `project.godot` 的
  // `display/window/size/viewport_*` 读（`_logical_w/_logical_h`），**不**读
  // `viewport->get_visible_rect()`、也不读 `window_get_size()`：stretch 关掉之后前者就是窗口尺寸，
  // 而刚把系统边框摘掉那一刻客户区还带着原来的非客户区尺寸（实测 794×450 的窗口报 810×489）
  // ⇒ 按它缩放会把窗口放大成 1.53×/1.63×、比例也歪掉（内容就被 letterbox 了）。
  const godot::Vector2i logical(_logical_w, _logical_h);
  const double scale = _args.window_scale;
  const bool explicit_size = _args.window_w > 0 && _args.window_h > 0;
  const godot::Vector2i want =
      explicit_size
          ? godot::Vector2i(_args.window_w, _args.window_h)
          : godot::Vector2i(static_cast<int>(std::lround(static_cast<double>(logical.x) * scale)),
                            static_cast<int>(std::lround(static_cast<double>(logical.y) * scale)));
  // **允许自由拉伸**：`RESIZE_DISABLED` 明确关掉（无边框窗口在 Windows 上是 `WS_POPUP` ⇒ 没有原生
  // 可拖的边框，边缘那条 6 像素带自己叫 `window_start_resize`，见 `titlebar_edge_at`）。
  // 下限取逻辑屏幕 794×450 —— 与 Electron 桌面端的 `minWidth/minHeight: 794/450` 同口径
  //（再小就等于把逻辑屏幕缩没，UI 命中与文字度量都开始失真）。
  ds->window_set_flag(DisplayServer::WINDOW_FLAG_RESIZE_DISABLED, false);
  ds->window_set_min_size(logical);
  if (ds->window_get_size() != want) {
    ds->window_set_size(want);
    if (scale != 1.0 || explicit_size) {
      // 窗口从左上角长大 ⇒ 放大后自己居中一下（不然会往右下溢出屏幕）。
      const int screen = ds->window_get_current_screen();
      const godot::Vector2i screen_pos = ds->screen_get_position(screen);
      const godot::Vector2i screen_size = ds->screen_get_size(screen);
      ds->window_set_position(screen_pos + (screen_size - want) / 2);
    }
  }
  // 证据行（`native/README.md` 的「窗口」一节引的就是它）：`borderless=1` = 无边框真的设上了、
  // `extend=1` = 客户区顶到标题栏位置（`frame` 档那一枚）；`deco=size` = 没有非客户区
  //（无边框窗口的装饰矩形与客户区矩形重合；有系统边框**和**系统标题栏时 deco > size）；
  // `logical=794x450` = 逻辑屏幕没被窗口尺寸带跑（`project.godot` 的 `viewport_*`）。
  const godot::Vector2i now = ds->window_get_size();
  const godot::Vector2i deco = ds->window_get_size_with_decorations();
  const godot::Vector2i pos = ds->window_get_position();
  // 内容在窗口里的矩形（= contain 之后的黑边量）：**宿主自己**算的那一份（`contain_rect()`，口径照
  // `Window::_update_viewport_size()` 的 keep 分支）—— stretch 关掉后引擎的 `get_final_transform()`
  // 不再带这道缩放 ⇒ 左右/上下是否**对称居中**由这两个数一眼看出（同时 `[godot] stretch:` 那一行
  // 把缩放与过采样也报出来）。
  const godot::Transform2D contain = contain_transform(now);
  const godot::Rect2 content = contain_rect(now);
  char buf[512];
  std::snprintf(buf, sizeof(buf),
                "[godot] window: display=%s titlebar=%s scale=%.2f borderless=%d extend=%d "
                "size=%dx%d deco=%dx%d pos=%d,%d mode=%d logical=%dx%d resizable=%d min=%dx%d "
                "content=%.0fx%.0f+%.0f+%.0f",
                display.c_str(), titlebar_name(_args.titlebar), scale,
                ds->window_get_flag(DisplayServer::WINDOW_FLAG_BORDERLESS) ? 1 : 0,
                ds->window_get_flag(DisplayServer::WINDOW_FLAG_EXTEND_TO_TITLE) ? 1 : 0, now.x,
                now.y, deco.x, deco.y, pos.x, pos.y, static_cast<int>(ds->window_get_mode()),
                logical.x, logical.y,
                ds->window_get_flag(DisplayServer::WINDOW_FLAG_RESIZE_DISABLED) ? 0 : 1,
                ds->window_get_min_size().x, ds->window_get_min_size().y, content.size.x,
                content.size.y, content.position.x, content.position.y);
  print_line(buf);
  report_stretch(contain, content);
}

// 自绘栏在 `--titlebar custom|frame` + 真窗口时**一直存在，全屏也画**（Electron 那边全屏只藏那三个
// 窗口按钮：`src/App.tsx:788/793/805` 的 `show={!is_fullscreen && window.runtime?.…}`，而静音/设置/
// 全屏那几个 `Show` 里没有 `!is_fullscreen`）⇒ 全屏时仍旧要能点设置/退出全屏。
bool LfwGodot::titlebar_visible() const {
  if (!_windowed || !titlebar_drawn()) return false;
  return godot::DisplayServer::get_singleton() != nullptr;
}

// ---- 自绘顶栏（`--titlebar custom` / `--titlebar frame`）：可见性 / 选中态 / 动作 ----
//
// `lfw_godot_titlebar.h` 只管几何与一张条件表；这里把端口现成的状态填进去（`src/App.tsx` 的每个
// `Show show=` / `ToggleImgButton.src` 逐条对位），并把点击接到端口已有的那些面上
//（`LFW::push_cmd(CMD.F*)` / `LFW::sounds_*` / `DisplayServer` 的窗口 API）。

// 可见性表。求值不了的两条照实写在 README 里：
//   * `is_mobile_container` / `toy_mobile`（UA + 触摸判定）⇒ 桌面宿主恒 false；
//   * `window.runtime`（Wails/Electron 的桥）⇒ 用"真窗口"（`_windowed`）代替。
lfw::host::TitleBarConditions LfwGodot::titlebar_conditions() const {
  lfw::host::TitleBarConditions c;
  if (_lfw == nullptr) return c;
  const lfw::World& world = _lfw->world();
  c.cheat_gim_ink = _lfw->is_cheat(lfw::cmd::kGIM_INK);
  lfw::ui::UILayers* const layers = _lfw->ui_layers();
  const lfw::ui::UINode* const ui = layers != nullptr ? layers->ui() : nullptr;
  c.has_ui = ui != nullptr;
  c.settings_page = ui != nullptr && lfw::to_string(ui->id()) == u"settings";
  const lfw::ui::UILayer* const bottom = layers != nullptr ? layers->bottom() : nullptr;
  c.bottom_pages = bottom != nullptr ? static_cast<int>(bottom->pages().size()) : 0;
  if (const lfw::Background* const bg = world.bg()) {
    c.bg_is_void = lfw::to_string(bg->id()) == u"VOID_BG";
  }
  c.first_page_init_demo = _lfw->first_page == u"init_demo";
  c.has_window = _windowed;
  c.mobile_or_toy = false;
  if (godot::DisplayServer* const ds = godot::DisplayServer::get_singleton()) {
    const godot::DisplayServer::WindowMode mode = ds->window_get_mode();
    c.fullscreen = mode == godot::DisplayServer::WINDOW_MODE_FULLSCREEN ||
                   mode == godot::DisplayServer::WINDOW_MODE_EXCLUSIVE_FULLSCREEN;
  }
  return c;
}

// 每个控件的 `checked`（决定显示 `src[0]` 还是 `src[1]`，见 `lfw_godot_titlebar.h` 那条反直觉的规则）。
// 来源逐条对 `src/App.tsx`：`app_state.bgm_muted` / `sound_muted` 在端口的等价物就是宿主那两位
//（`LFW::sounds_*`）；`paused` = `world.paused()`；`is_fullscreen` / `is_maximised` = 窗口模式；
// `dev_ui_open` 端口没有（恒 false）。
bool LfwGodot::titlebar_checked(lfw::host::TitleAction action) const {
  using lfw::host::TitleAction;
  if (_lfw == nullptr) return false;
  godot::DisplayServer* const ds = godot::DisplayServer::get_singleton();
  const godot::DisplayServer::WindowMode mode =
      ds != nullptr ? ds->window_get_mode() : godot::DisplayServer::WINDOW_MODE_WINDOWED;
  switch (action) {
    case TitleAction::bgm_mute:
      return _lfw->sounds_bgm_muted();
    case TitleAction::sound_mute:
      return _lfw->sounds_sound_muted();
    case TitleAction::f1:
      return _lfw->world().paused();
    case TitleAction::f5:  // `checked={lfw?.world.dataset.playrate != 1}`
      return lfw::to_number(_lfw->world().dataset.get(u"playrate")) != 1.0;
    case TitleAction::fullscreen:
      return mode == godot::DisplayServer::WINDOW_MODE_FULLSCREEN ||
             mode == godot::DisplayServer::WINDOW_MODE_EXCLUSIVE_FULLSCREEN;
    case TitleAction::maximize:
      // `frame` 档走系统那一档 ⇒ 选中态读窗口模式；无边框那两档读宿主自己记的还原位。
      return native_frame() ? mode == godot::DisplayServer::WINDOW_MODE_MAXIMIZED : _maximized;
    case TitleAction::dev_ui:
    case TitleAction::f4:
    case TitleAction::settings:
    case TitleAction::minimize:
    case TitleAction::close:
    case TitleAction::none:
      break;
  }
  return false;
}

// 点下去干什么。能做的都与 Electron 那一行等义；做不了的只有 `dev_ui`（端口没有那个面板）。
void LfwGodot::titlebar_activate(int index) {
  using lfw::host::TitleAction;
  const auto& list = lfw::host::titlebar_controls();
  if (_lfw == nullptr || index < 0 || index >= static_cast<int>(list.size())) return;
  godot::DisplayServer* const ds = godot::DisplayServer::get_singleton();
  const TitleAction action = list[static_cast<std::size_t>(index)].action;
  switch (action) {
    case TitleAction::dev_ui:
      // Electron 那边是 `set_app_state(d => d.dev_ui_open = !d.dev_ui_open)` —— 端口没有那个面板
      // ⇒ 按键/悬停都照做，动作只打一行（照实说，不假装）。
      print_line("[godot] titlebar: dev-ui (no dev panel in this host)");
      break;
    case TitleAction::f4:
      _lfw->push_cmd({std::u16string(lfw::cmd::kF4)});
      print_line("[godot] titlebar: f4 pages=" + ui_pages_text());
      break;
    case TitleAction::f1:
      _lfw->push_cmd({std::u16string(lfw::cmd::kF1)});
      print_line("[godot] titlebar: f1 pages=" + ui_pages_text());
      break;
    case TitleAction::f5:
      _lfw->push_cmd({std::u16string(lfw::cmd::kF5)});
      print_line("[godot] titlebar: f5 pages=" + ui_pages_text());
      break;
    case TitleAction::settings: {
      _lfw->push_cmd({std::u16string(lfw::cmd::kF2)});
      lfw::ui::UILayers* const layers = _lfw->ui_layers();
      lfw::ui::UINode* const ui = layers != nullptr ? layers->ui() : nullptr;
      lfw::ui::UILayer* const layer = ui != nullptr ? ui->layer() : nullptr;
      if (layer != nullptr && lfw::to_string(ui->id()) == u"settings") {
        layer->pop(lfw::ui::UIPopPageOpts{});  // `lfw.ui.layer?.pop()`
        print_line("[godot] titlebar: settings (pop) pages=" + ui_pages_text());
      } else if (layers != nullptr) {
        auto opts = std::make_shared<lfw::Object>();
        opts->set(u"id", Value(std::u16string(u"settings")));
        layers->set_page(Value(std::move(opts)), 1.0);  // `layers.set_page({id:"settings"}, 1)`
        print_line("[godot] titlebar: settings (set_page) pages=" + ui_pages_text());
      }
      break;
    }
    case TitleAction::bgm_mute: {
      const bool muted = !_lfw->sounds_bgm_muted();
      _lfw->sounds_set_bgm_muted(muted);
      print_line(std::string("[godot] titlebar: bgm_muted=") + (muted ? "true" : "false"));
      break;
    }
    case TitleAction::sound_mute: {
      const bool muted = !_lfw->sounds_sound_muted();
      _lfw->sounds_set_sound_muted(muted);
      print_line(std::string("[godot] titlebar: sound_muted=") + (muted ? "true" : "false"));
      break;
    }
    case TitleAction::fullscreen: {
      if (ds == nullptr) break;
      const bool full = titlebar_checked(TitleAction::fullscreen);
      ds->window_set_mode(full ? godot::DisplayServer::WINDOW_MODE_WINDOWED
                               : godot::DisplayServer::WINDOW_MODE_FULLSCREEN);
      // 退出全屏：引擎把窗口退回"进全屏之前"的窗口化矩形；如果我们当时是**最大化**（自己那套），
      // 就再按工作区摆一次（否则会退回到一个既非最大化、也不是用户记的那个尺寸的样子）。
      if (full && _maximized) {
        const godot::Rect2i usable = ds->screen_get_usable_rect(ds->window_get_current_screen());
        ds->window_set_position(usable.position);
        ds->window_set_size(usable.size);
      }
      print_line(std::string("[godot] titlebar: fullscreen=") + (full ? "false" : "true"));
      break;
    }
    case TitleAction::minimize:
      if (ds == nullptr) break;
      ds->window_set_mode(godot::DisplayServer::WINDOW_MODE_MINIMIZED);
      print_line("[godot] titlebar: minimize (" + window_state_text(ds) + ")");
      break;
    case TitleAction::maximize: {
      if (ds == nullptr) break;
      // `frame` 档：窗口有**原生边框** ⇒ 最大化/还原用引擎那一档（就是 Windows 自己那一套：
      // 最大化到工作区、系统记还原点、Aero Snap 同一份几何），不再自己做"铺满工作区"的模拟。
      if (native_frame()) {
        const bool maxed = ds->window_get_mode() == godot::DisplayServer::WINDOW_MODE_MAXIMIZED;
        ds->window_set_mode(maxed ? godot::DisplayServer::WINDOW_MODE_WINDOWED
                                  : godot::DisplayServer::WINDOW_MODE_MAXIMIZED);
        print_line(std::string("[godot] titlebar: ") + (maxed ? "restore" : "maximize") +
                   " (native frame) (" + window_state_text(ds) + ")");
        break;
      }
      // **自己做"最大化"**，不用 `WINDOW_MODE_MAXIMIZED`：无边框窗口（Windows 上是 `WS_POPUP`）走引擎那条
      // 会盖住任务栏、而且"还原"回到的尺寸不可靠（用户实测：点还原回不到原尺寸）。
      // 改成显式记"还原点" + 用**工作区**矩形（`screen_get_usable_rect` 已排除任务栏）——
      // Electron 对无边框窗口做的就是这件事。
      if (_maximized) {
        // ⚠ 先把引擎那一档压回 `WINDOWED`：把窗口铺满工作区时 Windows 会把它当**最大化**
        //（实测 `mode=2` = `WINDOW_MODE_MAXIMIZED`），而最大化档位下 `window_set_size` 被钉回整屏
        // ⇒ 不压这一下，"还原"会原地不动（用户实测报的第二个 bug）。
        if (ds->window_get_mode() == godot::DisplayServer::WINDOW_MODE_MAXIMIZED) {
          ds->window_set_mode(godot::DisplayServer::WINDOW_MODE_WINDOWED);
        }
        if (_restore_size.x > 0 && _restore_size.y > 0) {
          ds->window_set_size(_restore_size);
          ds->window_set_position(_restore_pos);
        }
        _maximized = false;
        print_line("[godot] titlebar: restore (" + window_state_text(ds) + ")");
      } else {
        _restore_size = ds->window_get_size();
        _restore_pos = ds->window_get_position();
        const godot::Rect2i usable = ds->screen_get_usable_rect(ds->window_get_current_screen());
        ds->window_set_position(usable.position);
        ds->window_set_size(usable.size);
        _maximized = true;
        print_line("[godot] titlebar: maximize (" + window_state_text(ds) + ")");
      }
      break;
    }
    case TitleAction::close:
      print_line("[godot] titlebar: close");
      print_exit_summary();
      quit_with(0);
      break;
    case TitleAction::none:
      break;
  }
  queue_redraw();
}

// 悬停态：照 `.volume_hover:hover .volume_popup { display: block }` 的意义——指针在**按钮盒**里
// ⇒ 那一层开着；开着之后指针落进**它自己那块弹层**（`.volume_popup` 是 `.volume_hover` 的后代
// ⇒ 祖先的 `:hover` 仍成立）也保持开着；两者都不满足就关（同时只可能开一个）。拖滑杆期间不关
// （`setPointerCapture` 的等价物）。
// ⚠ 弹层**关着**时 `display: none` ⇒ 它不参与命中测试：判断"在弹层里"必须先要求那一层**已经在开**
// （曾经漏了这一条 ⇒ 指针只要跑到按钮下面那条弹层带上，条就自己冒出来；用户报的正是这个）。
// `drag_hover` = 指针在 `.wails_drag` 那一层上（`#88888855` 那块高亮）。变了才 `queue_redraw()`。
void LfwGodot::titlebar_update_hover(const lfw::host::TitleBarLayout& layout,
                                     const lfw::host::TitleHit& hit, double bx, double by) {
  using lfw::host::TitleBarMetrics;
  using lfw::host::TitleHitKind;
  const int hover = hit.kind == TitleHitKind::button ? hit.index : -1;
  int popup = -1;
  if (_bar.slider_drag >= 0) {
    popup = _bar.slider_drag;
  } else {
    for (int i = 0; i < TitleBarMetrics::count; ++i) {
      if (!layout.visible[i] || !is_volume_control(i)) continue;
      const bool open = _bar.popup == i;
      if (hover == i ||
          (open && lfw::host::titlebar_rect_contains(lfw::host::titlebar_popup_rect(layout.rect[i]),
                                                     bx, by))) {
        popup = i;
      }
    }
  }
  const bool drag_hover = hit.kind == TitleHitKind::drag;
  if (hover == _bar.hover && drag_hover == _bar.drag_hover && popup == _bar.popup) return;
  _bar.hover = hover;
  _bar.drag_hover = drag_hover;
  _bar.popup = popup;
  queue_redraw();
}

// 滑杆动了：`VerticalSlider.onChange` 那两句 —— 设音量，且"拖起来就取消静音"。
void LfwGodot::titlebar_set_volume(int index, double v) {
  using lfw::host::TitleAction;
  const auto& list = lfw::host::titlebar_controls();
  if (_lfw == nullptr || index < 0 || index >= static_cast<int>(list.size())) return;
  const TitleAction action = list[static_cast<std::size_t>(index)].action;
  if (action == TitleAction::bgm_mute) {
    _lfw->sounds_set_bgm_volume(v);
    if (v > 0.0 && _lfw->sounds_bgm_muted()) _lfw->sounds_set_bgm_muted(false);
  } else if (action == TitleAction::sound_mute) {
    _lfw->sounds_set_sound_volume(v);
    if (v > 0.0 && _lfw->sounds_sound_muted()) _lfw->sounds_set_sound_muted(false);
  } else {
    return;
  }
  queue_redraw();
}

// 音量滑杆的位置（0..1）：与 `app_state.bgm_volume` 等价的那位 = 宿主的音量（`HeadlessHost` 存的）。
double LfwGodot::titlebar_volume(int index) const {
  using lfw::host::TitleAction;
  const auto& list = lfw::host::titlebar_controls();
  if (_lfw == nullptr || index < 0 || index >= static_cast<int>(list.size())) return 0.0;
  const TitleAction action = list[static_cast<std::size_t>(index)].action;
  if (action == TitleAction::bgm_mute) return _lfw->sounds_bgm_volume();
  if (action == TitleAction::sound_mute) return _lfw->sounds_sound_volume();
  return 0.0;
}

// 顶栏的「CSS 像素」里，条有多宽 = **整个窗口宽** / 显示缩放（窗口是物理像素）。
// ⚠ 别退回"内容区宽"：窗口比例与 794×450 不同时内容区比窗口窄（例：窗口 1400×500 ⇒ 内容 882×500
// 居中），按内容宽布局会让条只盖到中间那 882 px、右上角按钮跑到内容右缘（用户实测报的 bug）。
// Electron 那边 `.top_bar` 是 `left:0; right:0` 的 CSS 像素 ⇒ 口径与这里一致。
double LfwGodot::titlebar_window_width(const godot::Vector2i& window_size) const {
  return static_cast<double>(window_size.x) / titlebar_display_scale();
}

// 顶栏那一层唯一的缩放：**DOM 的 CSS 像素 → 窗口物理像素**。
//
// Electron 的顶栏是 CSS 布局（`src/App.module.scss` 的 `.top_bar` / `.wails_drag`），CSS 像素 = OS 的
// **逻辑**像素；Godot 这边的"窗口像素"是**物理**像素（`DisplayServer::window_get_size()` /
// `_input` 的坐标 / `--screenshot` 的 PNG 尺寸都是它 —— 见 `[godot] stretch:` 那一行里的
// `viewport=` / `final=`：stretch 关掉后画布 = 窗口，`final_transform()` 只剩 DPI/`stretch/scale`
// 那一档）⇒ 在 125% / 150% 缩放的屏上，不乘 `screen_get_scale()` 的话条与图会比 Electron **小**
// 一档。乘上之后：条高 32 CSS = 32×s 物理、图 19.2 CSS = 19.2×s 物理（实测 1.5 倍时 48 / 28.8）。
//
// ⚠ **不变的量**：条高（32 CSS）、控件盒（32 CSS）、32×32 的图缩 0.6 / 悬停 0.8、拖拽层 28.8 CSS、
// 边缘带 6 CSS —— 它们**既不看窗口尺寸、也不看游戏 contain 的缩放**（`--window-scale` / `--window-size`
// 改了窗口，条与图一个像素都不变；实测 1191×675 与 2382×1350 两档的图标逐行像素轮廓相同），
// 只随**显示缩放**整体放大。回归的口子在 `[godot] titlebar:` 那一行的 `bar=` / `icon=` / `scale=`。
//
// `--display-scale N`（诊断）覆盖它：本机屏幕缩放恰为 1 时用它把 DPI 那一档跑起来（见 README）。
double LfwGodot::titlebar_display_scale() const {
  if (_args.display_scale > 0.0) return _args.display_scale;
  godot::DisplayServer* const ds = godot::DisplayServer::get_singleton();
  if (ds == nullptr || !_windowed) return 1.0;
  const double s = ds->screen_get_scale(godot::DisplayServer::SCREEN_OF_MAIN_WINDOW);
  return s > 0.0 ? s : 1.0;
}

// 可见集合变了就打一行（证据行：哪几个控件在条上）。诊断用，不进摘要。
void LfwGodot::report_titlebar_controls() {
  godot::DisplayServer* const ds = godot::DisplayServer::get_singleton();
  if (ds == nullptr) return;
  const godot::Vector2i win_size = ds->window_get_size();
  const double bar_w = titlebar_window_width(win_size);
  const lfw::host::TitleBarLayout layout = lfw::host::titlebar_layout(bar_w, titlebar_conditions());
  const auto& list = lfw::host::titlebar_controls();
  std::string text;
  for (int i = 0; i < lfw::host::TitleBarMetrics::count; ++i) {
    if (!layout.visible[i]) continue;
    if (!text.empty()) text += " ";
    text += lfw::host::titlebar_action_name(
        list[static_cast<std::size_t>(i)].action);  // 只看名字（文件名见 README 那张表）
  }
  char buf[512];
  // `bar=` / `icon=` 是 **CSS 像素**（DOM 口径：条高 32、图 19.2；不随窗口尺寸/contain 缩放变化），
  // `scale=` = 顶栏那一层用的显示缩放（CSS → 窗口物理像素）⇒ 物理尺寸 = 这两个数相乘。
  std::snprintf(buf, sizeof(buf),
                "[godot] titlebar: icons=%s bar=%.0fx%.0f icon=%.1f scale=%.3f controls(%d)=%s",
                _icons_dir.empty() ? "<none>" : _icons_dir.c_str(), bar_w,
                lfw::host::TitleBarMetrics::bar_height,
                lfw::host::TitleBarMetrics::button * lfw::host::TitleBarMetrics::icon_scale,
                titlebar_display_scale(), layout.count, text.c_str());
  const std::string line(buf);
  if (line == _icon_report) return;
  _icon_report = line;
  print_line(line);
}

// 条上与窗口边缘的事件处理。返回 true = 宿主吃掉（调用方标 handled，别再喂给游戏/UI）。
//
// 次序（照 Electron 的层序）：① 边缘缩放带（**CSS 像素**，压过一切 —— 与原生边框同口径）
// → ② 音量弹层（`z-index: 2`，挂在条下沿、盖住画面那一带）→ ③ 控件盒 → ④ `.wails_drag`
// → ⑤ 起手在条上/弹层里、现在跑到外面的 move/up 也吞（免得松手那一下点着游戏里的按钮）。
// ⚠ 条上没有背景、拖拽层只占 90% 高、`.top_bar` 又是 `pointer-events: none` ⇒ 底部那 3.2 像素的
// 缝在 Electron 上是**漏给画面**的，这里也一样（只有按钮盒/弹层/拖拽层吞）。
// ⚠ 坐标口径 = **DOM 的 CSS 像素**（不是窗口物理像素）：事件先按 `final` 换成窗口像素，再除
// `titlebar_display_scale()`；绘制那边是同一个数字**乘**上去 ⇒ 两边永远对得上（见
// `titlebar_display_scale()` 的注释）。
bool LfwGodot::titlebar_consume(const godot::Ref<godot::InputEvent>& event) {
  using lfw::host::TitleBarMetrics;
  using lfw::host::TitleHit;
  using lfw::host::TitleHitKind;
  if (!titlebar_visible()) return false;
  LfwPointingEvent e;
  const PointerKind kind = to_pointing_event(event, e);
  if (kind == PointerKind::none) return false;
  godot::DisplayServer* const ds = godot::DisplayServer::get_singleton();
  if (ds == nullptr) return false;
  const godot::Viewport* const vp = get_viewport();
  if (vp == nullptr) return false;

  // 窗口像素（`get_final_transform()` 的正变换）→ CSS 像素（÷ 显示缩放）。
  const godot::Transform2D final = vp->get_final_transform();
  const godot::Vector2 win =
      final.xform(godot::Vector2(static_cast<float>(e.x), static_cast<float>(e.y)));
  const double scale = titlebar_display_scale();
  const godot::Vector2i win_size = ds->window_get_size();
  const double bx = static_cast<double>(win.x) / scale;
  const double by = static_cast<double>(win.y) / scale;
  const double win_w = static_cast<double>(win_size.x) / scale;  // CSS 像素
  const double win_h = static_cast<double>(win_size.y) / scale;
  const double bar_w = titlebar_window_width(win_size);
  const lfw::host::TitleBarConditions cond = titlebar_conditions();
  const lfw::host::TitleBarLayout layout = lfw::host::titlebar_layout(bar_w, cond);
  report_titlebar_controls();

  // 弹层几何（只有音量那两个控件有；开着的那个才吃事件）。
  const bool popup_open = _bar.popup >= 0 && layout.visible[_bar.popup];
  const lfw::host::TitleBarRect popup_rect =
      popup_open ? lfw::host::titlebar_popup_rect(layout.rect[_bar.popup])
                 : lfw::host::TitleBarRect{};
  const TitleHit hit = lfw::host::titlebar_hit(bx, by, layout);
  const bool in_popup = popup_open && lfw::host::titlebar_rect_contains(popup_rect, bx, by);

  // 悬停态（控件/拖拽层/弹层）：移动**与按下**都先刷一遍 —— 按下的位置就是指针的位置，
  // 所以「从控件挪到自己的弹层上」这一步在真实事件流里一定先有一条 move，这里等价补齐。
  if (kind == PointerKind::move || kind == PointerKind::down) {
    titlebar_update_hover(layout, hit, bx, by);
  }

  // 悬停到边缘 ⇒ 换成对应方向的缩放游标；音量滑杆那一带是 `cursor: pointer`。只在形状变化时调。
  // ⚠ `frame` 档的缩放带归**系统**（窗口有原生边框，Windows 自己会给游标/命中）⇒ 这条自绘带整条不参与。
  if (kind == PointerKind::move) {
    using DS = godot::DisplayServer;
    DS::CursorShape shape =
        native_frame() ? DS::CURSOR_ARROW
                       : cursor_for_edge(titlebar_edge_at(bx, by, win_w, win_h));
    const bool on_volume = in_popup || (hit.kind == TitleHitKind::button &&
                                        is_volume_control(hit.index));
    if (shape == DS::CURSOR_ARROW && on_volume) shape = DS::CURSOR_POINTING_HAND;
    if (static_cast<int>(shape) != _cursor_shape) {
      _cursor_shape = static_cast<int>(shape);
      ds->cursor_set_shape(shape);
    }
  }

  // 拖拽/缩放那两条：压过条上的一切（与原生边框同口径）。
  // ⚠ `frame` 档**不**做这条自绘缩放带：窗口还有 `WS_THICKFRAME`，边界那几像素是**非客户区**、
  // 归 Windows（原生缩放 + Aero Snap + 双击边=最大化）；自绘带在这儿只会跟它抢同一块像素。
  if (!native_frame() && kind == PointerKind::down && e.button == 0.0 &&
      ds->window_get_mode() == godot::DisplayServer::WINDOW_MODE_WINDOWED &&
      !ds->window_get_flag(godot::DisplayServer::WINDOW_FLAG_RESIZE_DISABLED)) {
    const TitleEdge edge = titlebar_edge_at(bx, by, win_w, win_h);
    if (edge != TitleEdge::none) {
      char buf[128];
      std::snprintf(buf, sizeof(buf), "[godot] titlebar: resize edge=%d at=(%.0f, %.0f)",  // CSS 像素
                    static_cast<int>(edge), bx, by);
      print_line(buf);
      _bar_capture = true;  // 嵌套的尺寸循环里那些 move/up 也别漏给游戏
      ds->window_start_resize(to_window_edge(edge));  // 阻塞到松开（Godot 自己的边框同款）
      return true;
    }
  }

  // ---- 移动：悬停/弹层已经在上面刷过，这里只管滑杆拖动与"吞不吞"----
  if (kind == PointerKind::move) {
    if (_bar.slider_drag >= 0) {
      // 正在拖滑杆（`setPointerCapture` 的等价物）：弹层不关，值跟着 y 走。
      // 轨道按**当前**布局重算（拖的过程中页面可能换了、条上的格子在挪）。
      lfw::host::TitleBarRect drag_popup;
      lfw::host::TitleBarRect drag_track;
      lfw::host::titlebar_popup_rects(layout.rect[_bar.slider_drag], drag_popup, drag_track);
      titlebar_set_volume(_bar.slider_drag, lfw::host::titlebar_slider_value(drag_track, by));
      return true;
    }
    if (hit.kind == TitleHitKind::none && !in_popup) return false;  // 缝里/条外的移动照旧给游戏
    return true;
  }

  // ---- 按下 ----
  if (kind == PointerKind::down) {
    // 按下就落在弹层里（指针从控件挪到弹层上）⇒ 弹层几何要按**刚刷过**的状态重算一次。
    lfw::host::TitleBarRect down_popup;
    lfw::host::TitleBarRect down_track;
    bool down_in_popup = false;
    if (_bar.popup >= 0 && layout.visible[_bar.popup]) {
      lfw::host::titlebar_popup_rects(layout.rect[_bar.popup], down_popup, down_track);
      down_in_popup = lfw::host::titlebar_rect_contains(down_popup, bx, by);
    }
    if (e.button != 0.0) {
      // 非左键：条上/弹层里的按下照样吞（别漏给游戏），但不做动作。
      return hit.kind != TitleHitKind::none || down_in_popup;
    }
    if (down_in_popup) {
      _bar_capture = true;
      // 弹层里：先按点到哪设到哪（`on_pointer_down` 的第一句），再抓住这个滑杆（`setPointerCapture`）。
      titlebar_set_volume(_bar.popup, lfw::host::titlebar_slider_value(down_track, by));
      _bar.slider_drag = _bar.popup;
      return true;
    }
    if (hit.kind == TitleHitKind::button) {
      _bar_capture = true;
      titlebar_activate(hit.index);
      return true;
    }
    if (hit.kind == TitleHitKind::drag) {
      _bar_capture = true;
      // 最大化时**不许拖**：Windows 的最大化窗口不是"整屏窗口"，拖它要么不动、要么按系统规矩先还原再跟随
      //（我们这种"铺满工作区"的自绘最大化更不该被拖着跑 —— 用户实测报的 bug）。
      const bool maxed =
          _maximized || ds->window_get_mode() == godot::DisplayServer::WINDOW_MODE_MAXIMIZED;
      if (maxed) {
        // 但**双击**拖拽区 = 切最大化/还原（Windows 的标准行为，用户按直觉会去双击）。
        bool dbl = false;
        if (const godot::InputEventMouseButton* const mb =
                godot::Object::cast_to<godot::InputEventMouseButton>(event.ptr());
            mb != nullptr) {
          dbl = mb->is_double_click();
        }
        if (dbl) {
          const auto& list = lfw::host::titlebar_controls();
          for (int i = 0; i < static_cast<int>(list.size()); ++i) {
            if (list[static_cast<std::size_t>(i)].action == lfw::host::TitleAction::maximize) {
              titlebar_activate(i);
              break;
            }
          }
        } else {
          print_line("[godot] titlebar: drag ignored (maximized)");
        }
        return true;
      }
      // 拖拽区。`window_start_drag` 在 Windows 上就是
      // `SendMessage(WM_SYSCOMMAND, SC_MOVE | HTCAPTION)` ⇒ 这一段**阻塞**到松开为止
      //（Godot 自己的标题栏同款）⇒ 重入用 `_bar_dragging` 挡掉。
      if (!_bar_dragging) {
        _bar_dragging = true;
        print_line("[godot] titlebar: drag");
        ds->window_start_drag();
        _bar_dragging = false;
      }
      return true;
    }
    return false;  // 底部那 3.2 像素的缝 ⇒ 漏给画面（同 Electron）
  }

  // ---- 抬起 / 滚轮 ----
  if (kind == PointerKind::up) {
    if (_bar.slider_drag >= 0) {
      _bar.slider_drag = -1;
      _bar_capture = false;
      return true;
    }
    if (hit.kind != TitleHitKind::none || in_popup) {
      _bar_capture = false;
      return true;
    }
  }
  if (kind == PointerKind::wheel) return hit.kind != TitleHitKind::none || in_popup;
  if (in_popup) return true;
  if (_bar_capture) {
    if (kind == PointerKind::up) _bar_capture = false;
    return true;
  }
  return false;
}

// 图标目录：`--icons <dir>` 优先；否则从**进程 cwd**与**可执行文件所在目录**往上找 `src/assets`。
// 找不到就打印一次并退回"只画命中盒"（那 11 张 PNG **不在数据包里** ⇒ 导出/打包要自己带上，见 README）。
void LfwGodot::setup_icons() {
  std::vector<std::filesystem::path> probes;
  if (_args.icons_given) probes.push_back(_args.icons);
  std::error_code ec;
  probes.push_back(std::filesystem::current_path(ec));
  if (godot::OS* const os = godot::OS::get_singleton()) {
    probes.push_back(std::filesystem::path(os->get_executable_path().utf8().get_data())
                         .parent_path());
  }
  for (const std::filesystem::path& probe : probes) {
    if (probe.empty()) continue;
    std::error_code stat_ec;
    // ① 直接指到放图的那一层；② 指到仓库根（自己找 `src/assets`）。
    if (std::filesystem::is_regular_file(probe / "btn_1_1.png", stat_ec)) {
      _icons_dir = probe.generic_string();
    } else {
      const std::filesystem::path root = find_repo_root(probe);
      if (!root.empty()) _icons_dir = (root / "src" / "assets").generic_string();
    }
    if (!_icons_dir.empty()) break;
  }
  if (_icons_dir.empty()) {
    print_error("[godot] titlebar icons: no btn_1_1.png (给 `--icons <dir>`；条上只画命中盒)");
    return;
  }
  const std::string dir = _icons_dir;
  _icons = std::make_unique<GodotTextureCache>(
      [dir](const std::string& name, std::string& out) {
        return read_file_bytes(std::filesystem::path(dir) / name, out);
      });
  print_line("[godot] titlebar icons: " + dir);
}

// 自绘顶栏的画面。全部按 **DOM 的规则**来：
//   * 条**没有背景**（`.top_bar` 只有布局）—— 只有 `.wails_drag` 悬停时那层 `#88888855`（90% 高）；
//   * 每个可见控件的 32×32 图缩在盒子正中（0.6，悬停 0.8）；
//   * 悬停那两路音量时，条下沿挂一个竖直音量条（`.volume_popup`）。
// 画之前把画布换到"**DOM 的 CSS 像素**"（`get_final_transform()` 的逆 × 显示缩放）⇒ 这里所有数字
// 都是 `.top_bar` / `.wails_drag` 那套 CSS 数字（条高 32、控件盒 32、图 19.2/25.6、拖拽层 28.8）
// —— **与窗口尺寸、与游戏的 contain 缩放都无关**，只随显示缩放整体放大（命中那边用同一个数字除，
// 见 `titlebar_display_scale()`）。
void LfwGodot::draw_titlebar() {
  using lfw::host::TitleBarMetrics;
  using lfw::host::TitleBarRect;
  godot::DisplayServer* const ds = godot::DisplayServer::get_singleton();
  const godot::Viewport* const vp = get_viewport();
  if (ds == nullptr || vp == nullptr) return;
  const godot::Transform2D final = vp->get_final_transform();
  const double bar_w = titlebar_window_width(ds->window_get_size());
  const lfw::host::TitleBarLayout layout = lfw::host::titlebar_layout(bar_w, titlebar_conditions());
  if (!(bar_w > 0.0)) return;
  report_titlebar_controls();  // 只在可见集合变了时打一行（证据行）
  // 画布换成 **CSS 像素**：`final` 的逆（画布 → 窗口物理像素）再乘显示缩放（CSS → 物理）
  // ⇒ 这里所有数字都是 `.top_bar` 那套 CSS 数字（条高 32、图 19.2），与窗口尺寸/contain 无关。
  // ⚠ 命中那边（`titlebar_consume`）是**同一个** `titlebar_display_scale()` 的除法 ⇒ 两边同源。
  godot::Transform2D css_to_canvas;
  css_to_canvas.set_scale(godot::Vector2(static_cast<float>(titlebar_display_scale()),
                                         static_cast<float>(titlebar_display_scale())));
  draw_set_transform_matrix(final.affine_inverse() * css_to_canvas);

  const float drag_h = static_cast<float>(TitleBarMetrics::drag_height);
  if (_bar.drag_hover) {
    // `src/App.module.scss:57-63` 的 `.wails_drag:hover { background-color: #88888855 }`。
    draw_rect(Rect2(0.0f, 0.0f, static_cast<float>(bar_w), drag_h),
              Color(0x88 / 255.0f, 0x88 / 255.0f, 0x88 / 255.0f, 0x55 / 255.0f), true);
  }

  const auto& list = lfw::host::titlebar_controls();
  for (int i = 0; i < TitleBarMetrics::count; ++i) {
    if (!layout.visible[i]) continue;
    const lfw::host::TitleBarControl& control = list[static_cast<std::size_t>(i)];
    const bool checked = titlebar_checked(control.action);
    const TitleBarRect icon = lfw::host::titlebar_icon_rect(layout.rect[i], _bar.hover == i);
    godot::Ref<godot::ImageTexture> tex;
    if (_icons != nullptr) tex = _icons->get(lfw::host::titlebar_control_image(control, checked));
    if (tex.is_null()) {
      // 图没解出来（没给 `--icons` 或目录不对）：留一个浅色占位盒，别静默什么都不画。
      draw_rect(Rect2(static_cast<float>(icon.x), static_cast<float>(icon.y),
                      static_cast<float>(icon.w), static_cast<float>(icon.h)),
                Color(0.85f, 0.88f, 0.95f, 0.18f), true);
      continue;
    }
    draw_texture_rect(tex,
                      Rect2(static_cast<float>(icon.x), static_cast<float>(icon.y),
                            static_cast<float>(icon.w), static_cast<float>(icon.h)),
                      false, Color(1.0f, 1.0f, 1.0f, 1.0f));
  }

  // 音量弹层（`z-index: 2`，挂在那两个控件下面）。
  if (_bar.popup >= 0 && layout.visible[_bar.popup]) {
    TitleBarRect popup;
    TitleBarRect track;
    lfw::host::titlebar_popup_rects(layout.rect[_bar.popup], popup, track);
    const double v = titlebar_volume(_bar.popup);
    const double clamped = v < 0.0 ? 0.0 : (v > 1.0 ? 1.0 : v);
    // `.volume_popup_inner { background-color: #0F1830CC; border-radius: 8px }`（圆角用角上的圆近似：
    // `draw_rect` 没有圆角；阴影 `box-shadow: 0 0 12px #00000066` 也略去）。
    draw_rounded_rect(popup, TitleBarMetrics::popup_radius, Color(0x0F / 255.0f, 0x18 / 255.0f,
                                                                  0x30 / 255.0f, 0xCC / 255.0f));
    // `.vertical_slider { background: #00000088; border-radius: 3px }`
    draw_rounded_rect(track, TitleBarMetrics::slider_w * 0.5, Color(0.0f, 0.0f, 0.0f, 0x88 / 255.0f));
    // `.fill { background-color: #5A88E0 }`（`bottom: 0; height: v * 100%`）
    draw_rounded_rect(lfw::host::titlebar_fill_rect(track, clamped), TitleBarMetrics::slider_w * 0.5,
                      Color(0x5A / 255.0f, 0x88 / 255.0f, 0xE0 / 255.0f, 1.0f));
    // `.knob { width: 14px; height: 14px; border-radius: 50%; background: #FFF }`
    const TitleBarRect knob = lfw::host::titlebar_knob_rect(track, clamped);
    draw_circle(Vector2(static_cast<float>(knob.x), static_cast<float>(knob.y)),
                static_cast<float>(knob.w * 0.5), Color(1.0f, 1.0f, 1.0f, 1.0f));
  }
  draw_set_transform_matrix(godot::Transform2D());  // 画布还给**窗口像素**（条自己那一层）
}

// `--clip-probe`：证明"游戏那一层真的被裁在内容矩形里"的那一圈观测量 —— 贴着**逻辑屏幕**的边界，
// **内外各 8 像素**画一圈洋红（画在游戏**之上**，所以它一定看得见）：
//   * 裁剪生效 ⇒ 只剩边界**里面**那 8 像素（黑边干净）；
//   * 裁剪失效 ⇒ 黑边里会各多出 8 像素洋红。
// 注意它走的是**游戏那一层**的矩阵（`contain`），不是窗口像素那一层。
void LfwGodot::draw_clip_probe(const godot::Transform2D& contain) {
  double lw = 0.0;
  double lh = 0.0;
  logical_size(lw, lh);
  if (!(lw > 0.0) || !(lh > 0.0)) return;
  const float w = static_cast<float>(lw);
  const float h = static_cast<float>(lh);
  const float b = 8.0f;
  const godot::Color color(1.0f, 0.0f, 1.0f, 0.85f);
  draw_set_transform_matrix(contain);
  draw_rect(Rect2(-b, -b, w + 2.0f * b, 2.0f * b), color, true);
  draw_rect(Rect2(-b, h - b, w + 2.0f * b, 2.0f * b), color, true);
  draw_rect(Rect2(-b, -b, 2.0f * b, h + 2.0f * b), color, true);
  draw_rect(Rect2(w - b, -b, 2.0f * b, h + 2.0f * b), color, true);
  draw_set_transform_matrix(godot::Transform2D());
}

// 圆角矩形（Godot 的 `draw_rect` 没有半径）：两块矩形 + 四个角上的圆。
void LfwGodot::draw_rounded_rect(const lfw::host::TitleBarRect& r, double radius,
                                 const godot::Color& color) {
  const double limit = r.w < r.h ? r.w : r.h;
  const float rad = static_cast<float>(radius > limit * 0.5 ? limit * 0.5 : radius);
  if (!(rad > 0.0f)) {
    draw_rect(Rect2(static_cast<float>(r.x), static_cast<float>(r.y), static_cast<float>(r.w),
                    static_cast<float>(r.h)),
              color, true);
    return;
  }
  const float x = static_cast<float>(r.x);
  const float y = static_cast<float>(r.y);
  const float w = static_cast<float>(r.w);
  const float h = static_cast<float>(r.h);
  draw_rect(Rect2(x + rad, y, w - 2.0f * rad, h), color, true);
  draw_rect(Rect2(x, y + rad, w, h - 2.0f * rad), color, true);
  draw_circle(Vector2(x + rad, y + rad), rad, color);
  draw_circle(Vector2(x + w - rad, y + rad), rad, color);
  draw_circle(Vector2(x + rad, y + h - rad), rad, color);
  draw_circle(Vector2(x + w - rad, y + h - rad), rad, color);
}

// `--click-window`：把一次完整点击按**窗口像素**推进引擎的真实事件路径
//（`Viewport::push_input(ev, /*local=*/false)` ⇒ `_make_input_local` 拿 `Window::get_final_transform()`
// 的反变换，正是 OS 事件走的那一条）⇒ 它证明的是「窗口像素 → 逻辑像素」这条换算，不只是"注入"。
void LfwGodot::push_window_click(double x, double y) {
  godot::Viewport* const vp = get_viewport();
  if (vp == nullptr) return;
  for (int pass = 0; pass < 2; ++pass) {
    godot::Ref<godot::InputEventMouseButton> mb;
    mb.instantiate();
    mb->set_button_index(godot::MOUSE_BUTTON_LEFT);
    mb->set_pressed(pass == 0);
    mb->set_position(Vector2(static_cast<float>(x), static_cast<float>(y)));
    mb->set_global_position(mb->get_position());
    vp->push_input(mb, false);
  }
}

// `--hover-window`：只推一条 `InputEventMouseMotion`（同一套窗口像素口径）—— 顶栏的悬停态
//（拖拽层那层 `#88888855`、控件缩 0.8、音量弹层弹出来）只有它推得动（`--click*` 只推按钮事件）。
void LfwGodot::push_window_hover(double x, double y) {
  godot::Viewport* const vp = get_viewport();
  if (vp == nullptr) return;
  godot::Ref<godot::InputEventMouseMotion> mm;
  mm.instantiate();
  mm->set_position(Vector2(static_cast<float>(x), static_cast<float>(y)));
  mm->set_global_position(mm->get_position());
  mm->set_relative(Vector2(0.0f, 0.0f));
  vp->push_input(mm, false);
}

LfwGodot::PointerKind LfwGodot::to_pointing_event(const godot::Ref<godot::InputEvent>& event,
                                                  LfwPointingEvent& out) const {
  double w = 794, h = 450;
  ui_screen_size(w, h);

  const godot::Ref<godot::InputEventPanGesture> pan = event;
  if (pan.is_valid()) {
    // 触控板双指滚动：Godot 的 `delta` 是"视口尺寸的比例"，**正 = 上/左**
    //（与浏览器的 `deltaY` 反号）⇒ 这里取负并乘回逻辑尺寸，落到与滚轮同一套 UI 像素口径。
    const godot::Vector2 d = pan->get_delta();
    out.delta_x = -static_cast<double>(d.x) * w;
    out.delta_y = -static_cast<double>(d.y) * h;
    out.button = 0;
    return PointerKind::wheel;
  }

  const godot::Ref<godot::InputEventMouseButton> mb = event;
  if (mb.is_valid()) {
    const godot::Vector2 pos = mb->get_position();
    out.x = static_cast<double>(pos.x);
    out.y = static_cast<double>(pos.y);
    out.delta_x = 0;
    out.delta_y = 0;
    const int64_t idx = static_cast<int64_t>(mb->get_button_index());
    // 滚轮：浏览器口径（一个齿 ≈ 100 DOM_DELTA_PIXEL），符号按 Godot 的方向 ——
    // 上 = 内容往上走（浏览器 `deltaY < 0`），下 = 反之；左右同理。
    if (idx == godot::MOUSE_BUTTON_WHEEL_UP || idx == godot::MOUSE_BUTTON_WHEEL_DOWN ||
        idx == godot::MOUSE_BUTTON_WHEEL_LEFT || idx == godot::MOUSE_BUTTON_WHEEL_RIGHT) {
      if (!mb->is_pressed()) return PointerKind::none;  // 齿只有按下那一下算
      const double factor = std::fabs(static_cast<double>(mb->get_factor()));
      const double notch = 100.0 * (factor > 0.0 ? factor : 1.0);
      if (idx == godot::MOUSE_BUTTON_WHEEL_UP) {
        out.delta_y = -notch;
      } else if (idx == godot::MOUSE_BUTTON_WHEEL_DOWN) {
        out.delta_y = notch;
      } else if (idx == godot::MOUSE_BUTTON_WHEEL_LEFT) {
        out.delta_x = -notch;
      } else {
        out.delta_x = notch;
      }
      out.button = 0;  // TS `__PointingEvent`：滚轮的 `button` 是 0
      return PointerKind::wheel;
    }
    // 左/中/右：浏览器 `PointerEvent.button` 的 0/1/2（`--b` 就是这一套）。
    out.button = idx == godot::MOUSE_BUTTON_LEFT     ? 0.0
                 : idx == godot::MOUSE_BUTTON_MIDDLE ? 1.0
                 : idx == godot::MOUSE_BUTTON_RIGHT  ? 2.0
                                                     : -1.0;
    return mb->is_pressed() ? PointerKind::down : PointerKind::up;
  }

  const godot::Ref<godot::InputEventMouseMotion> mm = event;
  if (mm.is_valid()) {
    const godot::Vector2 pos = mm->get_position();
    out.x = static_cast<double>(pos.x);
    out.y = static_cast<double>(pos.y);
    // TS：非滚轮的 `delta_*` 是 0，移动事件的 `button` 是 -1（`mousemove` 的 DOM 口径）。
    out.delta_x = 0;
    out.delta_y = 0;
    out.button = -1;
    return PointerKind::move;
  }
  return PointerKind::none;
}

// Godot 的 `Key` → 真 `KeyboardEvent.key`（小写；口径见 `src/DittoImpl/Keyboard.ts` 的
// `e.key?.toLowerCase()`）。三档：① 控制键/编辑键这种「有名字」的按 DOM 名字给；② `get_unicode()`
//（引擎已经按当前键盘布局解出了字符）——`Shift+A` 给 "A"、`Shift+1` 给 "!"，宿主照 TS 一样再
// `.toLowerCase()`；③ 抬起事件没有 `unicode`（见下面的 ⚠）⇒ 用 `keycode` 兜字母/数字。
// 都取不到（如纯修饰键之外的死键）⇒ 空串（`LFW` 那边自然不匹配）。
std::u16string dom_key_of_godot(const godot::Ref<godot::InputEventKey>& key) {
  struct Entry {
    godot::Key code;
    const char16_t* name;
  };
  static const Entry kTable[] = {
      {godot::KEY_LEFT, u"arrowleft"},     {godot::KEY_RIGHT, u"arrowright"},
      {godot::KEY_UP, u"arrowup"},         {godot::KEY_DOWN, u"arrowdown"},
      {godot::KEY_ENTER, u"enter"},        {godot::KEY_KP_ENTER, u"enter"},
      {godot::KEY_ESCAPE, u"escape"},      {godot::KEY_TAB, u"tab"},
      {godot::KEY_BACKSPACE, u"backspace"},{godot::KEY_DELETE, u"delete"},
      {godot::KEY_INSERT, u"insert"},      {godot::KEY_HOME, u"home"},
      {godot::KEY_END, u"end"},            {godot::KEY_PAGEUP, u"pageup"},
      {godot::KEY_PAGEDOWN, u"pagedown"},  {godot::KEY_SHIFT, u"shift"},
      {godot::KEY_CTRL, u"control"},       {godot::KEY_ALT, u"alt"},
      {godot::KEY_META, u"meta"},          {godot::KEY_CAPSLOCK, u"capslock"},
      {godot::KEY_SPACE, u" "},            {godot::KEY_PERIOD, u"."},
      {godot::KEY_COMMA, u","},            {godot::KEY_SLASH, u"/"},
      {godot::KEY_SEMICOLON, u";"},        {godot::KEY_APOSTROPHE, u"'"},
      {godot::KEY_BRACKETLEFT, u"["},      {godot::KEY_BRACKETRIGHT, u"]"},
      {godot::KEY_BACKSLASH, u"\\"},       {godot::KEY_MINUS, u"-"},
      {godot::KEY_EQUAL, u"="},            {godot::KEY_QUOTELEFT, u"`"},
  };
  // 小键盘：DOM 的 `key` 与小键盘**无关**（数字键盘 0 的 `key` 就是 "0"）；`uni` 那一档在
  // **抬起**时是 0，只有这张表能兜住，见下面 ⚠。
  static const Entry kKeypad[] = {
      {godot::KEY_KP_0, u"0"}, {godot::KEY_KP_1, u"1"}, {godot::KEY_KP_2, u"2"},
      {godot::KEY_KP_3, u"3"}, {godot::KEY_KP_4, u"4"}, {godot::KEY_KP_5, u"5"},
      {godot::KEY_KP_6, u"6"}, {godot::KEY_KP_7, u"7"}, {godot::KEY_KP_8, u"8"},
      {godot::KEY_KP_9, u"9"}, {godot::KEY_KP_PERIOD, u"."}, {godot::KEY_KP_DIVIDE, u"/"},
      {godot::KEY_KP_MULTIPLY, u"*"}, {godot::KEY_KP_SUBTRACT, u"-"}, {godot::KEY_KP_ADD, u"+"},
  };
  const godot::Key code = key->get_keycode();
  for (const Entry& entry : kTable) {
    if (code == entry.code) return entry.name;
  }
  for (const Entry& entry : kKeypad) {
    if (code == entry.code) return entry.name;
  }
  // 功能键 F1..F12（Godot 的 `KEY_F1` 是连续的）。
  if (code >= godot::KEY_F1 && code <= godot::KEY_F12) {
    return u"f" + std::u16string(1, static_cast<char16_t>(u'1' + (code - godot::KEY_F1)));
  }
  // 其余看 `get_unicode()`（引擎已经按当前键盘布局解出了字符）：`Shift+A` 给 "A"，`Shift+1` 给
  // "!"，这里照 TS 的 `.toLowerCase()` 再落到小写（⇒ 带 Shift 的标点也照 DOM 给）。
  const char32_t unicode = key->get_unicode();
  if (unicode >= 32 && unicode <= 0x7e) {
    char16_t c = static_cast<char16_t>(unicode);
    if (c >= u'A' && c <= u'Z') c = static_cast<char16_t>(c - u'A' + u'a');
    return std::u16string(1, c);
  }
  // ⚠ 走到这儿就是"没字符"的键：**Godot 的抬起事件不填 `unicode`**（实测 `j` 的 `up` 是
  // `keycode=74 / uni=0`，而 `down` 是 `keycode=74 / uni=74`）⇒ 只看 `unicode` 会让**所有字母/
  // 数字键的抬起被静默丢掉**：`HeadlessHost::key_up` 不执行 ⇒ 那个键永远留在按下表里 ⇒
  // 下一次按下算成操作系统的重复（`times != 0`）⇒ `LFW::on_key_down` 不再翻 `KEY_EVENT`，
  // 表现是"攻击/移动键按一次之后就再也不响"（真人对局里还会一直持着那个键）。
  // 字母/数字的 `keycode` 就是 ASCII（`KEY_A=65`…、`KEY_0=48`…），拿它兜底。
  if (code >= godot::KEY_A && code <= godot::KEY_Z) {
    return std::u16string(1, static_cast<char16_t>(code - godot::KEY_A + u'a'));
  }
  if (code >= godot::KEY_0 && code <= godot::KEY_9) {
    return std::u16string(1, static_cast<char16_t>(code));
  }
  return std::u16string();
}

// 平台事件进来的唯一入口。**只**推事件、不改模拟：命令入队后由下一步的 `World::step` 消化
//（与 `lfw_run --click` 同一条路径 ⇒ 无头脚本化点击能证明这条链是通的）。
// ⚠ 自绘标题栏那一带先吞（`titlebar_consume`）：条上/边缘的点击是**窗口**的动作，不许落到游戏/UI
//（端口现在指针是通的，一个走空的点击就会点到菜单按钮）。
void LfwGodot::_input(const godot::Ref<godot::InputEvent>& p_event) {
  if (!_running || _host == nullptr || _lfw == nullptr || p_event.is_null()) return;
  if (titlebar_consume(p_event)) {
    if (godot::Viewport* const vp = get_viewport()) vp->set_input_as_handled();
    return;
  }
  // 键盘：`InputEventKey` → `KeyboardEvent.key`（DOM 口径）→ `HeadlessHost::key_down/key_up`
  //（与 `--key` 注入、`lfw_run --key` 同一条链）。`echo` = 操作系统的重复按下 ⇒ 事件里的
  // `times` 递增（`LFW::on_key_down` 只在 `times == 0` 时把按下翻成 `KEY_EVENT`，重复不再翻）。
  if (const godot::Ref<godot::InputEventKey> key_event = p_event; !key_event.is_null()) {
    const std::u16string key = dom_key_of_godot(key_event);
    if (_args.play) {
      print_line("[godot] keyraw#" + std::to_string(++_key_seq) + ": " +
                 (key_event->is_pressed() ? "down" : "up") + " dom='" + to_utf8(key) +
                 "' keycode=" + std::to_string(static_cast<long long>(key_event->get_keycode())) +
                 " phys=" +
                 std::to_string(static_cast<long long>(key_event->get_physical_keycode())) +
                 " uni=" + std::to_string(static_cast<long long>(key_event->get_unicode())) +
                 " echo=" + (key_event->is_echo() ? "1" : "0"));
    }
    if (key.empty()) return;
    if (key_event->is_pressed()) {
      const bool first = _host->pressed_keys().find(key) == _host->pressed_keys().end();
      _host->key_down(key);
      if (first) {
        print_line("[godot] key: down " + to_utf8(key));
        report_key_focus(key);
      }
    } else {
      _host->key_up(key);
      print_line("[godot] key: up " + to_utf8(key));
    }
    return;
  }
  LfwPointingEvent e;
  const PointerKind kind = to_pointing_event(p_event, e);
  if (kind == PointerKind::none) return;
  // 文本输入覆盖层：点到框**外** = Web 里点到 canvas 上（DOM 焦点离开 `<input>` ⇒ `onblur`）。
  // 这里是**画布像素**（下面才换成逻辑像素），而控件的位置正好也是画布像素。
  // 一页可能有多个输入框（设置页 4 个玩家名）：只有拿到焦点的那个需要判；点进别的框时引擎会
  // 自己转焦点（那个框的矩形命中 ⇒ 这里不动它）。
  if (kind == PointerKind::down) {
    const godot::Vector2 point(static_cast<float>(e.x), static_cast<float>(e.y));
    for (TextInputOverlay& overlay : _text_inputs) {
      if (overlay.edit == nullptr || !overlay.edit->has_focus()) continue;
      const godot::Rect2 rect(overlay.edit->get_global_position(), overlay.edit->get_size());
      if (!rect.has_point(point)) overlay.edit->release_focus();
    }
  }
  // 换算：事件进来时是**画布像素**（OS 事件与 `push_input(ev, false)` 都按 `final_transform()` 的逆
  // 换过一遍），游戏的输入口径是**逻辑像素** ⇒ 画布 →（`final`）→ 窗口 →（`contain` 的逆）→ 逻辑
  //（`--click-window` 走的正是这条 ⇒ 它证明的是整条换算，不只是"注入"）。滚轮/触控板的 delta 已经
  // 是逻辑口径（见 `to_pointing_event`）。⛔ 上面 `titlebar_consume()` 用的是**窗口像素**，别换。
  const godot::Vector2 port =
      (contain_transform(window_size_px()).affine_inverse() * final_transform())
          .xform(godot::Vector2(static_cast<float>(e.x), static_cast<float>(e.y)));
  e.x = static_cast<double>(port.x);
  e.y = static_cast<double>(port.y);
  ui_scene_of_point(_lfw->world(), e.x, e.y, e.scene_x, e.scene_y);
  switch (kind) {
    case PointerKind::down:
      _host->emit_pointer_down(e);
      break;
    case PointerKind::up:
      _host->emit_pointer_up(e);
      break;
    case PointerKind::move:
      _host->emit_pointer_move(e);
      break;
    case PointerKind::wheel:
      _host->emit_wheel(e);
      break;
    case PointerKind::none:
      break;
  }
}

// 窗口关掉（或 `NOTIFICATION_WM_CLOSE_REQUEST`）时打一行收尾：开放模式没有帧数上限，
// 正常玩下去只会这样结束 —— 这一行就是「跑到第几帧、时钟走到哪」的证据。
// 自绘栏的 close 按钮走 `print_exit_summary()` + `quit_with(0)`（同一个口径的一行）。
void LfwGodot::print_exit_summary() const {
  if (!_running || _lfw == nullptr || _host == nullptr) return;
  char buf[256];
  std::snprintf(buf, sizeof(buf), "[godot] exit: frames=%d clock=%.0fms steps=%lld pages=%s",
                _frames, _host->clock().now(), _host->steps(), ui_pages_text().c_str());
  print_line(buf);
}

void LfwGodot::_notification(int p_what) {
  // 窗口被拉伸/最大化：条与内容矩形都得按新尺寸重排。`_draw()` 每次都重算（所以只是叫一次重绘）
  // —— 游戏跑着的时候本来就每帧 `queue_redraw()`，暂停/验收模式不会自己醒，得靠这一条。
  if (p_what == NOTIFICATION_WM_SIZE_CHANGED) {
    queue_redraw();
    return;
  }
  if (p_what != NOTIFICATION_WM_CLOSE_REQUEST) return;
  destroy_text_input();
  print_exit_summary();
}

LfwGodot::Args::ClickAt* LfwGodot::inject_clicks(int frame) {
  if (_args.clicks.empty() || _host == nullptr || _lfw == nullptr) return nullptr;
  Args::ClickAt* first = nullptr;
  for (Args::ClickAt& click : _args.clicks) {
    if (click.frame != frame) continue;
    if (click.hover) {
      push_window_hover(click.x, click.y);
    } else if (click.window_space) {
      push_window_click(click.x, click.y);
    } else {
      _host->click_ui(*_lfw, click.x, click.y);
    }
    if (first == nullptr) first = &click;
  }
  return first;
}

// `--key` / `--key-down` / `--key-up`：把这一帧的按键喂进宿主。次序与 `inject_clicks` 一样 ——
// 事件先入队（`LFW::on_key_down` 变成 `KEY_EVENT` 命令），由**这一步**的 `World::step` 消化。
const LfwGodot::Args::KeyAt* LfwGodot::inject_keys(int frame) {
  if (_args.keys.empty() || _host == nullptr || _lfw == nullptr) return nullptr;
  const Args::KeyAt* first = nullptr;
  for (const Args::KeyAt& key : _args.keys) {
    if (key.frame != frame) continue;
    if (key.down) {
      _host->key_down(key.key);
      report_key_focus(key.key);
    } else {
      _host->key_up(key.key);
    }
    if (first == nullptr) first = &key;
  }
  return first;
}

// UI 的层/页栈（`<层号>:<该层栈顶页 id>`）：点击有没有把页面推下去的**直接**证据。
std::string LfwGodot::ui_pages_text() const {
  lfw::ui::UILayers* const layers = _lfw->ui_layers();
  if (layers == nullptr) return "<no layers>";
  std::string out;
  for (lfw::ui::UILayer* const layer : layers->all()) {
    if (layer == nullptr) continue;
    if (!out.empty()) out += " ";
    out += to_utf8(lfw::number_to_string(layer->index()));
    out += ":";
    lfw::ui::UINode* const page = layer->ui();
    out += page != nullptr ? to_utf8(lfw::to_string(page->id())) : "-";
  }
  return out.empty() ? "<empty>" : out;
}

// 引擎侧唯一一处把 `GodotDrawItem` 变成像素的地方（§G5「只在边界转换」）。
//
// 三趟扫：`pass` -1 = UI 背景、0 = 世界、+1 = UI 前景 —— 这是 D1(a) 的五遍次序
//（UI 背景 → 背景/实体/前景 → UI 前景）。同一趟内保持收集次序（世界那一趟是画家次序，
// UI 那两趟已按 (z, 树序) 排好）。
//
// 坐标：绘制项是**逻辑像素**（794×450 那一套），而 stretch 关掉后画布就是**窗口像素**
// ⇒ 游戏那一层套 `contain_transform()`（等比缩放 + 居中；画布 = 窗口时 `final_transform()` 是
// 单位阵），并用 `clip` + `custom_rect` 裁在内容矩形里。自绘顶栏反过来按 **DOM 的 CSS 像素**画
//（`final` 的逆 × 显示缩放，见 `titlebar_display_scale()`），且必须**越过**那条裁剪。
void LfwGodot::_draw() {
  GodotWorldRenderer* const renderer = _host != nullptr ? _host->world_renderer() : nullptr;
  if (renderer != nullptr) {
    const godot::Vector2i win = window_size_px();
    const godot::Transform2D contain = contain_transform(win);
    report_stretch(contain, contain_rect(win));  // 值变了（改窗口尺寸）才打一行
    apply_font_oversampling(contain);
    apply_game_clip(win);
    const GodotFrame& frame = renderer->take_frame();
    if (frame.valid) {
      _item_xform = final_transform().affine_inverse() * contain;
      draw_set_transform_matrix(_item_xform);
      static const int kPasses[3] = {-1, 0, 1};
      for (const int pass : kPasses) {
        for (const GodotDrawItem& item : frame.items) {
          if (item.pass != pass) continue;
          if (!item.text.empty()) {
            draw_text_item(item);
          } else {
            draw_item(item);
          }
        }
      }
      draw_set_transform_matrix(godot::Transform2D());  // 画布还给窗口像素
      _item_xform = godot::Transform2D();
    }
    if (_args.clip_probe) draw_clip_probe(contain);
  }
  // 自绘标题栏压在**所有**绘制项之上（它就是"窗口的边框"，与 Electron 在 DOM 最后画那一层同理），
  // 而且是 **DOM 的 CSS 像素**里的一层：`draw_titlebar()` 自己把画布换成
  // 「`final` 的逆 × 显示缩放」。
  // `clip_ignore` 是一枚命令（`renderer_canvas_render_rd.cpp` 的 `TYPE_CLIP_IGNORE`）：它之后的命令
  // 另起一批、**不带**上面那条 scissor ⇒ 条能画进黑边里（`ScrollContainer` 把滚动条画到裁剪框外
  // 也是这一条）。
  if (titlebar_visible()) {
    godot::RenderingServer* const rs = godot::RenderingServer::get_singleton();
    if (rs != nullptr) rs->canvas_item_add_clip_ignore(get_canvas_item(), true);
    draw_titlebar();
    if (rs != nullptr) rs->canvas_item_add_clip_ignore(get_canvas_item(), false);
  }
}

// UI 文字（`UITextRenderer` / `TextMesh` 的口径）：字号来自 `style.font`、颜色来自 `fill_style`、
// 对齐来自 `text_align`、左上各 2 像素内边距（`UITextRenderer._normalize_style`）。逐行画
//（TS 也是在画布上逐行 `fillText`），基线用字体的 ascent。
//
// **摆放口径**（`TextMesh` + `UITextRenderer.update`）：文字块是"块尺寸"的一张网格，**块中心压在
// 节点矩形的中心上** —— `mesh.position = round(nodeW*(0.5-cx))` / `round(nodeH*(cy-0.5))`，与节点矩形
// 的平移 `_tran_x/_tran_y` 是同一个式子 ⇒ 两者恒等，与 `text_align`、与节点宽度都无关。
// `text_align` 只在**块内部**排：`split_text_to_lines` 的 `l.x` 拿的是 `w = 最宽一行 + 左右 padding`
//（不是节点宽度），`left/center/right` 分别 = `padding_l` / `padding_l + round((w - pl - pr)/2)` /
// `padding_l + round(w - pl - pr)`。
// ⚠ 数据里绝大多数文字节点没有 `size`（`auto_size_by_text` 会把尺寸设成量出来的文字尺寸）⇒ 块宽 ≡
// 节点宽，"居中"和"贴左"分辨不出来；只有 `player_name` 那批"显式 `size` + 运行时文字"的节点才看得出来
//（2026-10-16 用户报的"头像下方文字未能居中"就是它）。
// 纵向仍按"盒顶 + padding + ascent"：块高 ≡ 盒高时两者恒等，只有显式 `size` 的节点差 ~0.5 像素。
//
// ⚠ **`draw_string` 的 `alignment` 一栏在 `width < 0` 时不起作用**（实测：`width = -1` 下
// `align=CENTER` 的文字整段从 `pos.x` 往右铺，居中的警告文字被推到盒子中心往右半个盒宽 ——
// 2026-10-16 用户报的"Launch 页文字歪了"就是它）。而 `width = item.w`（原本的做法）会让 Godot
// **自己折行**，与 TS 的 `split_text_to_lines`（只按 `\n` 切、不折行）口径不同。
// ⇒ 两头都不能用：**自己量行宽、自己摆 x**，`alignment` 固定 LEFT、`width` 固定 -1。
// 一行文字的描边 + 填充。`pos` 是**基线左端**（`draw_string` 的口径）。
//
// 描边用**自己铺的偏移复制**（`stroke_w` 像素的带状）：半径 1..n 的八个方向各画一遍描边色，
// 最后压上填充。为什么不用 `draw_string_outline`：实测它**不随 `p_size` 线性变粗**
//（`size` 8 与 16 画出来都是约 2px，见 DESIGN §167.6），而 TS 侧
//  `outlineWidth` 要到 4~5（DEMO / "Go!"），必须拿到精确的像素厚度。
// 偏移复制与 TS 着色器的口径也对得上：着色器判据是「中心透明、`outlineWidth` 外有字」⇒
// 轮廓就是字形按该距离外扩的一圈，边缘 alpha 跟着字形走（这里同样是画字形本身）。
void LfwGodot::draw_text_run(const godot::Ref<godot::Font>& font, const godot::Vector2& pos,
                             const std::string& line, int font_size, const godot::Color& color,
                             bool has_stroke, double stroke_w,
                             const godot::Color& stroke_color) {
  const godot::String text = godot::String::utf8(line.c_str());
  if (has_stroke && stroke_w > 0.0) {
    static const float kDirs[8][2] = {{-1.0f, 0.0f}, {1.0f, 0.0f},  {0.0f, -1.0f}, {0.0f, 1.0f},
                                      {-1.0f, -1.0f}, {1.0f, -1.0f}, {-1.0f, 1.0f}, {1.0f, 1.0f}};
    const int n = std::max(1, static_cast<int>(std::lround(stroke_w)));
    for (int r = 1; r <= n; ++r) {
      for (int k = 0; k < 8; ++k) {
        const float d = static_cast<float>(r);
        draw_string(font, pos + godot::Vector2(kDirs[k][0] * d, kDirs[k][1] * d), text,
                    godot::HORIZONTAL_ALIGNMENT_LEFT, -1.0f, font_size, stroke_color);
      }
    }
  }
  draw_string(font, pos, text, godot::HORIZONTAL_ALIGNMENT_LEFT, -1.0f, font_size, color);
}

// 世界空间的一行文字（实体名 / `xN` 剩余数量，TS `TextMesh` 的 plain 模式）：
// `item.x/item.y` 是**屏幕锚点**，块尺寸要按字体度量现算（TS 那边是 canvas 量的 `mesh.scale`）。
//   `text_below` ⇒ 块中心挂在锚点**下方一个块高**（`EntityNameRender`：`y = ground_y - z/2 - 块高`）；
//   否则块中心挂在锚点**上方半个块高**（`EntityStatRender`：`y = 精灵顶 + 块高/2`）。
void LfwGodot::draw_world_text_item(const GodotDrawItem& item, const godot::Ref<godot::Font>& font,
                                    int font_size) {
  const godot::Color color(static_cast<float>(item.r), static_cast<float>(item.g),
                           static_cast<float>(item.b), static_cast<float>(item.a));
  const bool has_stroke = item.stroke_w > 0.0 && item.stroke_a > 0.0;
  const godot::Color stroke_color(static_cast<float>(item.stroke_r),
                                  static_cast<float>(item.stroke_g),
                                  static_cast<float>(item.stroke_b),
                                  static_cast<float>(item.stroke_a));
  // 单行（名字与 `xN` 都不会换行），量一次宽高就够。
  const double text_w = static_cast<double>(
      font->get_string_size(godot::String::utf8(item.text.c_str()),
                            godot::HORIZONTAL_ALIGNMENT_LEFT, -1.0f, font_size)
          .x);
  const double ascent = static_cast<double>(font->get_ascent(font_size));
  const double descent = static_cast<double>(font->get_descent(font_size));
  const double block_h = ascent + descent;
  double cx = item.x;
  if (item.has_clamp_x) {
    // TS `clamp(position.x, cam_x + hw, …)` 的屏幕版：`hw = 块宽/2 + clamp_pad`。
    const double hw = text_w * 0.5 + item.clamp_pad;
    const double lo = item.clamp_x0 + hw;
    const double hi = item.clamp_x1 - hw;
    cx = hi >= lo ? std::min(std::max(cx, lo), hi) : (lo + hi) * 0.5;
  }
  const double center_y = item.text_below ? item.y + block_h : item.y - block_h * 0.5;
  const double left = cx - text_w * 0.5;
  // 基线 = 块顶 + ascent（`TextMesh` 用 `textBaseline = "top"` 的等价口径）。
  const double baseline = center_y - block_h * 0.5 + ascent;
  draw_text_run(font, godot::Vector2(static_cast<float>(left), static_cast<float>(baseline)),
                item.text, font_size, color, has_stroke, item.stroke_w,
                stroke_color);
}

void LfwGodot::draw_text_item(const GodotDrawItem& item) {
  if (item.text.empty()) return;
  godot::Ref<godot::Font> font = font_for_css(item.font_css);
  if (font.is_null()) return;
  const int size = static_cast<int>(std::lround(item.font_size > 0.0 ? item.font_size : 9.0));
  const int font_size = size > 0 ? size : 1;
  if (item.world_text) {
    draw_world_text_item(item, font, font_size);
    return;
  }
  const Color color(static_cast<float>(item.r), static_cast<float>(item.g),
                    static_cast<float>(item.b), static_cast<float>(item.a));
  const bool has_stroke = item.stroke_w > 0.0 && item.stroke_a > 0.0;
  const Color stroke_color(static_cast<float>(item.stroke_r),
                           static_cast<float>(item.stroke_g),
                           static_cast<float>(item.stroke_b),
                           static_cast<float>(item.stroke_a));
  const double pad = 2.0;  // `UITextRenderer._normalize_style` 的四边缺省值
  // 先量一遍（块宽 = 最宽一行 + 左右 padding），再定块的左边界：块的**中心** = 节点矩形中心。
  std::vector<std::pair<std::string, double>> lines;
  double line_max = 0.0;
  for (std::size_t start = 0;;) {
    const std::size_t nl = item.text.find('\n', start);
    const std::string line = item.text.substr(
        start, nl == std::string::npos ? std::string::npos : nl - start);
    double lw = 0.0;
    if (!line.empty()) {
      lw = static_cast<double>(
          font->get_string_size(String::utf8(line.c_str()), godot::HORIZONTAL_ALIGNMENT_LEFT,
                                -1.0f, font_size)
              .x);
      line_max = std::max(line_max, lw);
    }
    lines.emplace_back(line, lw);
    if (nl == std::string::npos) break;
    start = nl + 1;
  }
  const double block_w = line_max + pad * 2.0;
  const float line_h = font->get_height(font_size);
  const double block_h = static_cast<double>(lines.size()) * static_cast<double>(line_h) + pad * 2.0;
  const double content_x = item.x + item.w * 0.5 - block_w * 0.5 + pad;
  // ⚠ 纵向：块的**中心**压在节点矩形中心上 —— TS 里文字 mesh 是**居中几何**（1×1 平面缩到块尺寸
  // `w×h`），位置取 `UITextRenderer.update()` 的 `round(nodeH*(cy-0.5))`，而那一点正是矩形中心
  // ⇒ 块与矩形同心。这里曾经把块的**顶边**钉在 `矩形顶 + padding`：盒高 ≡ 块高（`auto_size_by_text`
  // 的节点，尺寸由 `measure_text` 按同一个块算出）时两者等价，**盒比自己那块文字大**时文字就偏上
  //（2026-10-16 用户报的"语言那一行的箭头不居中"：`arrow_left` 是显式 `size: "40,36"`、里面只有一个
  // "◀"（块 22×25）⇒ 偏上 (36-25)/2 = 5.5 像素；同级的 `arrow_left_hl` 没有显式尺寸 ⇒ 它的盒子就是
  // 那块 22×25、正好压在 (224,18) 上，可以当"TS 该画在哪"的参照）。
  const double block_top = item.y + item.h * 0.5 - block_h * 0.5;
  double y = block_top + pad + static_cast<double>(font->get_ascent(font_size));
  for (const std::pair<std::string, double>& line : lines) {
    if (!line.first.empty()) {
      double ax = content_x;
      if (item.text_align == 1) {
        ax = content_x + std::round(line_max * 0.5) - line.second * 0.5;
      } else if (item.text_align == 2) {
        ax = content_x + std::round(line_max) - line.second;
      }
      draw_text_run(font, Vector2(static_cast<float>(ax), static_cast<float>(y)), line.first,
                    font_size, color, has_stroke, item.stroke_w, stroke_color);
    }
    y += static_cast<double>(line_h);
  }
}

// ---------------------------------------------------------------- 音频（引擎侧那一半）
//
// 语义在 `LfwGodotHost`（TS `sounds/Modern.ts` 的算式：音量、静音、左右声道、随机 BGM），这里只做
// 「资源路径 → `AudioStream`」与「把数字落到播放器上」。三件事值得写下来：
//   1. **一条总线一个 panner**：`AudioStreamPlayer` 没有 pan 参数（那是 2D 播放器的事），而 TS 的
//      `get_l_r_vol` 给的是**每声道两个幅度**。宿主送来 `gain=(l+r)/2`、`pan=(r-l)/(l+r)`，落到
//      Godot 4.7.1 的 panner 法则上（`servers/audio/effects/audio_effect_panner.cpp`：
//      `lvol = clamp(1-pan,0,1)`、`rvol = clamp(1+pan,0,1)`，`out.left = in.l*lvol + in.r*(1-rvol)`
//      / `out.right = in.r*rvol + in.l*(1-lvol)`）——**单声道输入**时 `in.l == in.r` ⇒
//      `out.left = gain·(1-pan) = l`、`out.right = gain·(1+pan) = r`，**逐值等于** TS 的两个增益。
//      本工程音效全是 mono（`data/*.wav.mp3` 的 MP3 帧头 channel mode = 3）、只有 `bgm/*` 是 stereo，
//      而 BGM 走的是没有 pan 的那一路（居中，直连 Master）⇒ 这个等价关系覆盖全部素材。
//      每个音效槽一条自己的总线 + 一个 `AudioEffectPanner` 就是为了这个；换引擎版本要重算这条。
//   2. **回收靠轮询**：`AudioStreamPlayer.finished` 要 `_bind_methods` + `Callable`；`_process` 里
//      每帧看一眼 `is_playing()` 更简单，噪声是"最多晚一帧才把 id 还给宿主"（只影响 `1/sqrt(n)`
//      那个衰减因子）。
//   3. **随机 BGM**：宿主按 TS 抽好一首（`Randoming('bgm_randoming', …)`）并把 `loop=false` 交下来；
//      播完由这里回一条 `CMD.BGM '?'`（TS 是 `ele.addEventListener('ended', () => push_cmd(CMD.BGM,'?'))`）。
namespace {

bool bytes_start_with(const std::string& b, const char* magic, std::size_t n) {
  return b.size() >= n && std::memcmp(b.data(), magic, n) == 0;
}

bool looks_like_mp3(const std::string& b) {
  if (bytes_start_with(b, "ID3", 3)) return true;
  return b.size() > 1 && static_cast<unsigned char>(b[0]) == 0xFF &&
         (static_cast<unsigned char>(b[1]) & 0xE0) == 0xE0;
}

godot::PackedByteArray to_packed(const std::string& bytes) {
  godot::PackedByteArray out;
  if (bytes.empty()) return out;
  out.resize(static_cast<int64_t>(bytes.size()));
  std::memcpy(out.ptrw(), bytes.data(), bytes.size());
  return out;
}

// `AudioStream` 的循环开关：三种具体类型各自一个（基类没有这一档）。
void set_stream_loop(const godot::Ref<godot::AudioStream>& stream, bool loop) {
  if (stream.is_null()) return;
  if (godot::AudioStreamMP3* const mp3 = godot::Object::cast_to<godot::AudioStreamMP3>(stream.ptr());
      mp3 != nullptr) {
    mp3->set_loop(loop);
    return;
  }
  if (godot::AudioStreamOggVorbis* const ogg =
          godot::Object::cast_to<godot::AudioStreamOggVorbis>(stream.ptr());
      ogg != nullptr) {
    ogg->set_loop(loop);
    return;
  }
  if (godot::AudioStreamWAV* const wav = godot::Object::cast_to<godot::AudioStreamWAV>(stream.ptr());
      wav != nullptr) {
    wav->set_loop_mode(loop ? godot::AudioStreamWAV::LOOP_FORWARD
                            : godot::AudioStreamWAV::LOOP_DISABLED);
  }
}

// WAV：`AudioStreamWAV` 要的是**裸 PCM**（`data` 里不许有 RIFF 头），所以自己剥一遍 fmt/data。
// 本工程的数据全是 mp3（`*.wav.mp3` / `*.wma.mp3`），这一档是给别的数据包留的。
godot::Ref<godot::AudioStreamWAV> make_wav(const std::string& bytes) {
  const auto u16 = [&](std::size_t off) -> unsigned {
    return static_cast<unsigned>(static_cast<unsigned char>(bytes[off])) |
           (static_cast<unsigned>(static_cast<unsigned char>(bytes[off + 1])) << 8);
  };
  const auto u32 = [&](std::size_t off) -> unsigned {
    return u16(off) | (u16(off + 2) << 16);
  };
  if (bytes.size() < 44) return godot::Ref<godot::AudioStreamWAV>();
  std::size_t pos = 12;  // 跳过 "RIFF" + size + "WAVE"
  unsigned channels = 0, rate = 0, bits = 0, fmt_tag = 0;
  std::size_t data_off = 0, data_len = 0;
  while (pos + 8 <= bytes.size()) {
    const unsigned size = u32(pos + 4);
    const std::string id = bytes.substr(pos, 4);
    const std::size_t body = pos + 8;
    if (id == "fmt " && body + 16 <= bytes.size()) {
      fmt_tag = u16(body);
      channels = u16(body + 2);
      rate = u32(body + 4);
      bits = u16(body + 14);
    } else if (id == "data") {
      data_off = body;
      data_len = std::min<std::size_t>(size, bytes.size() - body);
    }
    pos = body + size + (size & 1u);
  }
  if (data_len == 0 || rate == 0 || channels == 0 || (bits != 8 && bits != 16)) {
    return godot::Ref<godot::AudioStreamWAV>();
  }
  godot::Ref<godot::AudioStreamWAV> wav;
  wav.instantiate();
  wav->set_data(to_packed(bytes.substr(data_off, data_len)));
  wav->set_format(fmt_tag == 3 ? godot::AudioStreamWAV::FORMAT_16_BITS
                               : (bits == 8 ? godot::AudioStreamWAV::FORMAT_8_BITS
                                            : godot::AudioStreamWAV::FORMAT_16_BITS));
  wav->set_mix_rate(static_cast<int32_t>(rate));
  wav->set_stereo(channels >= 2);
  return wav;
}

}  // namespace

void LfwGodot::install_audio() {
  if (_host == nullptr) return;
  godot::AudioServer* const server = godot::AudioServer::get_singleton();
  _sfx_slots.resize(kSfxSlots);
  _sfx_pans.resize(kSfxSlots);
  _sfx_ids.assign(kSfxSlots, std::string());
  for (int i = 0; i < kSfxSlots; ++i) {
    godot::AudioStreamPlayer* const player = memnew(godot::AudioStreamPlayer);
    player->set_name(godot::String("lfw_sfx_") + godot::String::num_int64(i));
    add_child(player);
    godot::Ref<godot::AudioEffectPanner> panner;
    panner.instantiate();
    panner->set_pan(0.0f);
    if (server != nullptr) {
      const int bus = server->get_bus_count();
      server->add_bus();
      const godot::String bus_name = godot::String("lfw_sfx_") + godot::String::num_int64(i);
      server->set_bus_name(bus, bus_name);
      server->add_bus_effect(bus, panner);
      player->set_bus(bus_name);
    }
    _sfx_slots[static_cast<std::size_t>(i)] = player;
    _sfx_pans[static_cast<std::size_t>(i)] = panner;
  }
  // ⚠ `memnew` 是宏（展开成 `_pre_initialize/… _post_initialize(new …)`）⇒ 前面**不能**再写
  // `godot::`（`godot::(…)` 直接语法错误）。
  _bgm_player = memnew(godot::AudioStreamPlayer);
  _bgm_player->set_name("lfw_bgm");
  add_child(_bgm_player);

  LfwGodotHost::AudioSink sink;
  sink.preload = [this](const std::string& path) { audio_preload(path); };
  sink.play = [this](const std::string& id, const std::string& path, double gain, double pan) {
    audio_play(id, path, gain, pan);
  };
  sink.set_gain = [this](const std::string& id, double gain, double pan) {
    audio_set_gain(id, gain, pan);
  };
  sink.stop_all = [this]() { audio_stop_all(); };
  sink.play_bgm = [this](const std::string& path, bool loop, double gain) {
    audio_play_bgm(path, loop, gain);
  };
  sink.set_bgm_gain = [this](double gain) { audio_set_bgm_gain(gain); };
  sink.stop_bgm = [this]() { audio_stop_bgm(); };
  sink.scale = [this]() { return audio_world_scale(); };
  _host->set_audio_sink(std::move(sink));

  const std::string driver = server != nullptr
                                 ? std::string(server->get_driver_name().utf8().get_data())
                                 : std::string("<none>");
  char buf[256];
  std::snprintf(buf, sizeof(buf),
                "[godot] sounds: mixer %d sfx slots + 1 bgm (per-slot bus + AudioEffectPanner) "
                "driver=%s mix=%.0fHz",
                kSfxSlots, driver.c_str(),
                server != nullptr ? static_cast<double>(server->get_mix_rate()) : 0.0);
  print_line(buf);
}

std::string LfwGodot::audio_stream_key(const std::string& path) {
  if (path.empty()) return std::string();
  const auto found = _audio_cache.find(path);
  if (found != _audio_cache.end()) {
    return found->second.is_valid() ? path : std::string();
  }
  _audio_last_path = path;
  std::string bytes;
  GodotWorldRenderer* const renderer = _host != nullptr ? _host->world_renderer() : nullptr;
  // 读字节走与图片同一条（包 `--zip` → 根目录 `--root`：`093.wav.mp3` 在 `dist/builtin_data/…`）。
  if (renderer == nullptr || !renderer->read_resource(path, bytes) || bytes.empty()) {
    ++_audio_failed;
    _audio_cache[path] = godot::Ref<godot::AudioStream>();
    print_error("[godot] sounds: read failed: " + path);
    return std::string();
  }
  godot::PackedByteArray data = to_packed(bytes);
  godot::Ref<godot::AudioStream> stream;
  if (looks_like_mp3(bytes)) {
    godot::Ref<godot::AudioStreamMP3> mp3;
    mp3.instantiate();
    mp3->set_data(data);
    stream = mp3;
  } else if (bytes_start_with(bytes, "OggS", 4)) {
    stream = godot::AudioStreamOggVorbis::load_from_buffer(data);
  } else if (bytes_start_with(bytes, "RIFF", 4)) {
    stream = make_wav(bytes);
  }
  if (stream.is_null()) {
    ++_audio_failed;
    print_error("[godot] sounds: unsupported bytes: " + path);
  } else {
    ++_audio_decoded;
  }
  _audio_cache[path] = stream;
  return stream.is_valid() ? path : std::string();
}

void LfwGodot::audio_play(const std::string& id, const std::string& path, double gain, double pan) {
  if (_sfx_slots.empty()) return;
  const std::string key = audio_stream_key(path);
  if (key.empty()) return;
  const godot::Ref<godot::AudioStream>& stream = _audio_cache[key];
  int slot = -1;
  for (int i = 0; i < static_cast<int>(_sfx_slots.size()); ++i) {
    if (!_sfx_slots[static_cast<std::size_t>(i)]->is_playing()) {
      slot = i;
      break;
    }
  }
  if (slot < 0) {
    slot = _sfx_next;
    _sfx_next = (_sfx_next + 1) % static_cast<int>(_sfx_slots.size());
    // 抢占：被顶掉的那条不会再有 `finished` ⇒ 当场还给宿主（否则 `_playings` 只增不减，
    // `1/sqrt(playings)` 那档衰减会一直往下压）。
    const std::string& stolen = _sfx_ids[static_cast<std::size_t>(slot)];
    if (!stolen.empty()) _host->on_audio_finished(stolen);
  }
  godot::AudioStreamPlayer* const player = _sfx_slots[static_cast<std::size_t>(slot)];
  if (player == nullptr) return;
  player->set_stream(stream);
  player->set_volume_linear(static_cast<float>(std::max(0.0, std::min(1.0, gain))));
  if (_sfx_pans[static_cast<std::size_t>(slot)].is_valid()) {
    _sfx_pans[static_cast<std::size_t>(slot)]->set_pan(
        static_cast<float>(std::max(-1.0, std::min(1.0, pan))));
  }
  player->play();
  _sfx_ids[static_cast<std::size_t>(slot)] = id;
}

void LfwGodot::audio_set_gain(const std::string& id, double gain, double pan) {
  for (int i = 0; i < static_cast<int>(_sfx_ids.size()); ++i) {
    if (_sfx_ids[static_cast<std::size_t>(i)] != id) continue;
    godot::AudioStreamPlayer* const player = _sfx_slots[static_cast<std::size_t>(i)];
    if (player == nullptr) continue;
    player->set_volume_linear(static_cast<float>(std::max(0.0, std::min(1.0, gain))));
    if (_sfx_pans[static_cast<std::size_t>(i)].is_valid()) {
      _sfx_pans[static_cast<std::size_t>(i)]->set_pan(
          static_cast<float>(std::max(-1.0, std::min(1.0, pan))));
    }
    return;
  }
}

void LfwGodot::audio_preload(const std::string& path) { (void)audio_stream_key(path); }

void LfwGodot::audio_play_bgm(const std::string& path, bool loop, double gain) {
  if (_bgm_player == nullptr) return;
  const std::string key = audio_stream_key(path);
  if (key.empty()) return;
  const godot::Ref<godot::AudioStream>& stream = _audio_cache[key];
  set_stream_loop(stream, loop);
  _bgm_player->set_stream(stream);
  _bgm_player->set_volume_linear(static_cast<float>(std::max(0.0, std::min(1.0, gain))));
  _bgm_player->play();
  _bgm_was_playing = true;
}

void LfwGodot::audio_set_bgm_gain(double gain) {
  if (_bgm_player == nullptr) return;
  _bgm_player->set_volume_linear(static_cast<float>(std::max(0.0, std::min(1.0, gain))));
}

void LfwGodot::audio_stop_bgm() {
  if (_bgm_player != nullptr) _bgm_player->stop();
  _bgm_was_playing = false;
}

void LfwGodot::audio_stop_all() {
  for (std::size_t i = 0; i < _sfx_slots.size(); ++i) {
    if (_sfx_slots[i] != nullptr) _sfx_slots[i]->stop();
    if (i < _sfx_ids.size()) _sfx_ids[i].clear();
  }
  audio_stop_bgm();
}

void LfwGodot::audio_poll() {
  if (_host == nullptr) return;
  // 1) 音效：槽里那个 id 播完了 ⇒ 还给宿主（`_playings.erase`）。
  for (std::size_t i = 0; i < _sfx_slots.size() && i < _sfx_ids.size(); ++i) {
    if (_sfx_ids[i].empty() || _sfx_slots[i] == nullptr) continue;
    if (_sfx_slots[i]->is_playing()) continue;
    const std::string id = _sfx_ids[i];
    _sfx_ids[i].clear();
    _host->on_audio_finished(id);
  }
  // 2) 随机 BGM：`is_playing()` 由真变假 = 一首放完 ⇒ 再抽一首（TS 的 `ended` 监听）。
  if (_bgm_player != nullptr) {
    const bool playing = _bgm_player->is_playing();
    if (_bgm_was_playing && !playing && _host->audio_bgm_random() && _lfw != nullptr) {
      _bgm_was_playing = false;
      _lfw->push_cmd(std::vector<std::u16string>{u"bgm", u"?"});
    }
    _bgm_was_playing = playing || _bgm_was_playing;
  }
  // 3) 诊断：值变了才打一行（`[godot] sounds:`）。与 `[godot frame N]` 同一档 —— 只在你给了
  //    `--every`（验收跑法）时打，`--play` 自己玩的时候不留一屏日志；收尾那一行照样打。
  const std::string report = audio_report();
  if (report != _audio_report) {
    _audio_report = report;
    if (_args.every > 0) print_line("[godot] sounds: " + report);
  }
}

double LfwGodot::audio_world_scale() const {
  // TS `get_l_r_vol` 里的 `world_node.scale.x`：逻辑像素 → 画布的那个比例。
  const godot::Transform2D contain = contain_transform(window_size_px());
  const double sx = static_cast<double>(contain.get_scale().x);
  return sx > 0.0 ? sx : 1.0;
}

std::string LfwGodot::audio_report() const {
  if (_host == nullptr) return std::string();
  char buf[512];
  std::snprintf(buf, sizeof(buf),
                "preload=%lld decode=%lld fail=%lld play=%lld bgm=%lld active=%d bgm_playing=%d "
                "random=%d bgm_path=%s bgm_gain=%.3f last=%s",
                _host->audio_loaded(), _audio_decoded, _audio_failed, _host->audio_played(),
                _host->audio_bgm_played(), _host->audio_active(),
                _bgm_player != nullptr && _bgm_player->is_playing() ? 1 : 0,
                _host->audio_bgm_random() ? 1 : 0,
                _host->audio_bgm_path().empty() ? "-" : _host->audio_bgm_path().c_str(),
                _host->audio_bgm_gain(),
                _host->audio_last().empty() ? "-" : _host->audio_last().c_str());
  return std::string(buf);
}

void LfwGodot::draw_item(const GodotDrawItem& item) {
  if (!(item.w > 0.0) || !(item.h > 0.0)) return;
  // `Rect2` / `Vector2` 吃的是 `godot::real_t`（这份绑定是单精度）⇒ 一开始就落成 float。
  const float x = static_cast<float>(item.x);
  const float y = static_cast<float>(item.y);
  const float w = static_cast<float>(item.w);
  const float h = static_cast<float>(item.h);
  // 3D 模型项：`_process` 里已经把这个实体的离屏画布同步好了，这里只是一次 blit。
  if (item.has_model) {
    const auto found = _model_textures.find(item.tag);
    if (found == _model_textures.end() || found->second.is_null()) return;
    draw_texture_rect(found->second, Rect2(x, y, w, h), false);
    return;
  }
  const float alpha = static_cast<float>(item.a);
  const Color color(static_cast<float>(item.r), static_cast<float>(item.g),
                    static_cast<float>(item.b), alpha);
  // UI 的纯色块（覆盖色 / `background` / `foreground`）：直接填，不去查纹理、也不画
  //「取不到图」的占位色块（那是实体那一遍的诊断）。
  if (item.flat) {
    draw_rect(Rect2(x, y, w, h), color, true);
    return;
  }
  godot::Ref<godot::ImageTexture> tex;
  if (_textures != nullptr && !item.path.empty()) tex = _textures->get(item.path);
  if (tex.is_null()) {
    // 占位：图没解出来（或这一层本来就没图）⇒ 一个色块 + 一圈深色边框。颜色按 `tag` 定，
    // 同一个实体每帧同色（便于目视对位）。
    std::uint32_t hash = 2166136261u;
    for (const char c : item.tag) hash = (hash ^ static_cast<unsigned char>(c)) * 16777619u;
    const float hue = static_cast<float>(hash % 360u) / 360.0f;
    const Color tint = Color::from_hsv(hue, 0.55f, 0.85f, alpha);
    draw_rect(Rect2(x, y, w, h), tint, true);
    draw_rect(Rect2(x, y, w, h), Color(0.1f, 0.1f, 0.15f, alpha), false, 1.0f);
    return;
  }
  const Rect2 src(static_cast<float>(item.sx * item.tex_scale),
                  static_cast<float>(item.sy * item.tex_scale),
                  static_cast<float>(item.sw * item.tex_scale),
                  static_cast<float>(item.sh * item.tex_scale));
  // 一次「blit」：`画在哪 + 什么颜色`。镜像用等价的水平翻转变换（TS 的 `flip_x` 是 UV 镜像）。
  // ⚠ `draw_set_transform*` 是**绝对**的：这里只能叠在 `_item_xform`（= 当前这一层的 contain 矩阵）
  // 之上，画完再换回来。直接 `draw_set_transform()` + `draw_set_transform_matrix(单位阵)` 会把 contain
  // 缩放整条冲掉 —— 镜像项**自己**以及它之后的所有项都会按逻辑像素 1:1 画进窗口（窗口越大越离谱）。
  // 旋转项（`item.rot`）：矩形记的是**旋转后的中心落点** ⇒ 先平移回中心，再转，再在局部系里
  // 镜像（`rot * mirror` = 先镜像后转 —— TS 的 `flip_x` 是 UV 镜像，两者逐位等价）。描边的四邻
  // 偏移也放进这个局部系，于是轮廓跟着图一起转（TS 里那是着色器在局部 texel 空间做的）。
  const bool rotated = item.rot != 0.0;
  godot::Transform2D spin_xform;
  if (rotated) {
    godot::Transform2D rot2;
    rot2.set_rotation(static_cast<godot::real_t>(item.rot));
    if (item.flip_x) {
      godot::Transform2D local_mirror;
      local_mirror.set_scale(Vector2(-1.0f, 1.0f));
      rot2 = rot2 * local_mirror;
    }
    godot::Transform2D to_center;
    to_center.set_origin(Vector2(x + w * 0.5f, y + h * 0.5f));
    spin_xform = _item_xform * to_center * rot2;
  }
  // 背景层的 UV 循环 / 偏移动画（TS `BgLayerRender.update_uv`）：宿主没有"改纹理 UV"的口子
  // （`draw_texture_rect_region` 的 UV 只有一次采样）⇒ 按**周期**平铺贴图，整排整体平移
  // `-uv_ox/-uv_oy`（相位已取正模），多画的那一圈由 content 裁剪兜住。
  // 与"改 repeat/offset"逐像素等价：周期 = `min(源图, 目标)`，超出目标的那部分只多画不显示。
  if (item.uv_tile && !rotated && !item.flip_x) {
    const double px = item.uv_px > 0.0 ? item.uv_px : item.w;
    const double py = item.uv_py > 0.0 ? item.uv_py : item.h;
    if (px > 0.0 && py > 0.0) {
      const double ox = -std::fmod(item.uv_ox, px);
      // ⚠ y 是**反的**：`uv_oy` 是纹理 v 方向的相位（与 TS 的 `tex.offset` 同号、v 向上），
      // 屏幕 y 向下 ⇒ 屏幕位移取 **+uv_oy**。写成 `-` 会让雪/雾往上飘（用户报的"垂直方向反了"）。
      // 循环起点压到 `(-py, 0]`（减一个周期，等价），否则第一块下面会留一条空档。
      double oy = std::fmod(item.uv_oy, py);
      if (oy > 0.0) oy -= py;
      const auto tile_pass = [&](const Color& c) {
        for (double gy = oy; gy < item.h; gy += py) {
          for (double gx = ox; gx < item.w; gx += px) {
            draw_texture_rect_region(
                tex, Rect2(static_cast<float>(item.x + gx), static_cast<float>(item.y + gy),
                           static_cast<float>(px), static_cast<float>(py)),
                src, c);
          }
        }
      };
      tile_pass(color);
      if (item.mix_a > 0.0) {
        tile_pass(Color(static_cast<float>(item.mix_r), static_cast<float>(item.mix_g),
                        static_cast<float>(item.mix_b), static_cast<float>(item.mix_a)));
      }
      return;
    }
  }
  const auto blit = [&](const godot::Ref<godot::ImageTexture>& t, float ox, float oy, const Color& c) {
    if (rotated) {
      godot::Transform2D push;
      push.set_origin(Vector2(ox, oy));
      draw_set_transform_matrix(spin_xform * push);
      draw_texture_rect_region(t, Rect2(-w * 0.5f, -h * 0.5f, w, h), src, c);
      draw_set_transform_matrix(_item_xform);
      return;
    }
    if (item.flip_x) {
      godot::Transform2D mirror;
      mirror.set_scale(Vector2(-1.0f, 1.0f));
      mirror.set_origin(Vector2(x + ox + w, y + oy));
      draw_set_transform_matrix(_item_xform * mirror);
      draw_texture_rect_region(t, Rect2(0.0f, 0.0f, w, h), src, c);
      draw_set_transform_matrix(_item_xform);
    } else {
      draw_texture_rect_region(t, Rect2(x + ox, y + oy, w, h), src, c);
    }
  };
  // 描边：TS 是着色器（`outline.frag`）逐**四邻**看 alpha —— 中心 < 0.5 且上下左右任一 ≥ 0.5
  // 的像素画**纯色** `outlineColor`（alpha = `outlineAlpha`），偏移量 = `outline_width` 逻辑像素
  // （`outline_width * img.scale` 在着色器里又除回 `textureSize` ⇒ 逻辑像素；且采样点出裁剪矩形就
  // 当 0 ⇒ 轮廓**只落在裁剪矩形内**）。
  // 宿主的等价做法：拿「白剪影」（RGB=白、A 二值化于 0.5）沿上下左右各偏 `d` 画一遍，
  // `modulate` = 描边色 × `outlineAlpha`。白底乘色 ⇒ **纯色**（不再是乘性染色）；二值 alpha ⇒
  // 邻接判据与 TS 的 `> 0.5` 逐像素等价；偏移方向只有四邻（没有对角）⇒ 轮廓形状也与 TS 一致，
  // 而且天然落在裁剪矩形内。画在精灵**底下**：TS 对"中心 alpha ≥ 0.5 但挨着边"的像素是把描边色
  // 当背景合成（`bgfg`），叠在下面正好等价；差别只剩 TS 那条 `deburr*` 的 smoothstep 去毛刺。
  // 剪影取不到（解码失败）时退回原图：形状还在，颜色就还是乘性的（并会记进 `last_error`）。
  if (item.outline_w > 0.0 && item.outline_a > 0.0 && !item.path.empty()) {
    const float d = static_cast<float>(item.outline_w);
    const Color oc(static_cast<float>(item.outline_r), static_cast<float>(item.outline_g),
                   static_cast<float>(item.outline_b), static_cast<float>(item.outline_a));
    godot::Ref<godot::ImageTexture> sil;
    if (_textures != nullptr) sil = _textures->get_silhouette(item.path);
    const godot::Ref<godot::ImageTexture>& ot = sil.is_valid() ? sil : tex;
    blit(ot, 0.0f, -d, oc);
    blit(ot, 0.0f, d, oc);
    blit(ot, -d, 0.0f, oc);
    blit(ot, d, 0.0f, oc);
  }
  blit(tex, 0.0f, 0.0f, color);
  if (item.mix_a > 0.0) {
    blit(tex, 0.0f, 0.0f,
         Color(static_cast<float>(item.mix_r), static_cast<float>(item.mix_g),
               static_cast<float>(item.mix_b), static_cast<float>(item.mix_a)));
  }
}

// 视口 → PNG（`--screenshot`）。⚠ 只有**真渲染**（不加 `--headless`）才有像素可存。
bool LfwGodot::capture_screenshot() {
  if (_args.screenshot.empty() || _captured) return false;
  _captured = true;
  godot::RenderingServer* const rs = godot::RenderingServer::get_singleton();
  if (rs != nullptr) rs->force_draw();  // 把这一帧推完，免得拿到半截
  godot::Viewport* const vp = get_viewport();
  if (vp == nullptr) {
    print_error("[godot] screenshot: no viewport");
    return false;
  }
  const godot::Ref<godot::ViewportTexture> vtex = vp->get_texture();
  if (vtex.is_null()) {
    print_error("[godot] screenshot: no viewport texture");
    return false;
  }
  const godot::Ref<godot::Image> img = vtex->get_image();
  if (img.is_null()) {
    print_error("[godot] screenshot: null image (headless has no renderer ⇒ drop --headless)");
    return false;
  }
  const godot::String path(_args.screenshot.generic_string().c_str());
  const godot::Error err = img->save_png(path);
  char buf[512];
  std::snprintf(buf, sizeof(buf), "[godot] screenshot: %s %dx%d err=%d frame=%d life=%.0f",
                _args.screenshot.generic_string().c_str(), img->get_width(), img->get_height(),
                static_cast<int>(err), _frames, _lfw != nullptr ? _lfw->world().lifetime() : 0.0);
  print_line(buf);
  return err == godot::OK;
}

void LfwGodot::report_frame(int frame) const {
  const lfw::World& world = _lfw->world();
  const std::string digest = frame_digest(world, frame);
  char buf[384];
  std::snprintf(buf, sizeof(buf),
                "[godot frame %6d] entities=%zu ghosts=%zu hp=%.1f digest=%s pages=%s", frame,
                world.entities.size(), world.ghosts.size(), total_hp(world), digest.c_str(),
                ui_pages_text().c_str());
  print_line(buf);
}

void LfwGodot::finish() {
  _running = false;
  const lfw::World& world = _lfw->world();
  const std::string digest = frame_digest(world, _frames - 1);
  GodotWorldRenderer* const renderer = _host->world_renderer();
  char buf[512];
  // ⚠ `renderer(+-)` 必须与 `NullWorldRenderer` 那份逐位一致（`native/README.md` 的三条摘要）：
  // 本渲染器的 `add_entity` / `del_entity` 按**每次调用**计数，与 `NullWorldRenderer` 同口径。
  std::snprintf(buf, sizeof(buf),
                "[godot] done: frames=%d ups=%.0f digest=%s warns=%d errors=%d ignored_images=%lld "
                "renderer(+-)=%lld/%lld clock=%.1fms residual=%.1fms steps=%lld",
                _frames, 1000.0 / _host->step_ms(), digest.c_str(), _host->warn_count(),
                _host->error_count(), _host->ignored_images(),
                renderer != nullptr ? renderer->added() : 0,
                renderer != nullptr ? renderer->removed() : 0, _host->clock().now(),
                _host->residual_ms(), _host->steps());
  print_line(buf);
  // UI 渲染面（DESIGN D4）：与 `lfw_run` 同口径（本宿主也不装 `IRenderScheduler`）。
  std::snprintf(buf, sizeof(buf), "[godot] UI render calls: %lld (unhandled: %lld)",
                world.ui_render_calls(), world.ui_render_unhandled());
  print_line(buf);
  // 音频面（不改三条摘要）：预载/解码/播放/BGM 的账 + 最后碰过的那个资源路径。
  print_line("[godot] sounds: " + audio_report());
  // 绘制面（§G2 第二半，本切片新增的观测量；不进三条摘要）：最后一帧的绘制项与纹理统计。
  if (renderer != nullptr) {
    const GodotFrame& f = renderer->take_frame();
    std::snprintf(
        buf, sizeof(buf),
        "[godot] render: bg=%s cam=%.1f,%.1f scale=%.2f,%.2f df=%.3f items=%zu bg_layers=%d "
        "ents=%d hidden=%d no_pic=%d no_file=%d unnamed_tex=%d outline=%d[%s] rot=%d@%.4f "
        "model=%d[%s] sil=%lld textures=%lld ok/%lld fail uv=%d[%s]",
        f.bg_id.c_str(), f.cam_x, f.cam_y, f.scale_x, f.scale_y, f.dfactor, f.items.size(),
        f.bg_layers, f.drawn_entities, f.hidden_entities, f.no_pic_entities, f.no_file_entities,
        f.unnamed_textures, f.outline_items, f.outline_probe.c_str(), f.rotated_items,
        f.rotated_probe, f.model_items, f.model_probe.c_str(),
        _textures != nullptr ? _textures->silhouettes() : 0,
        _textures != nullptr ? _textures->loaded() : 0,
        _textures != nullptr ? _textures->failed() : 0, f.uv_items, f.uv_probe.c_str());
    print_line(buf);
    // `opoint.__gen_*`（表达式编译 / 闭包侧表）的累计账：模型与特效「生成出来没速度」这类
    // 问题，第一眼要看的数（见 README「opoint 的 `gen_*`」一节）。
    {
      const lfw::GenFieldStats& gen = lfw::gen_field_stats();
      std::snprintf(buf, sizeof(buf), "[godot] gen_field: calls=%lld resolved=%lld closures=%lld",
                    gen.calls, gen.resolved, gen.closures);
      print_line(buf);
    }
    if (_textures != nullptr && !_textures->last_error().empty()) {
      print_line("[godot] last texture error: " + _textures->last_error());
    }
    if (_models != nullptr && (!_models->last_error().empty() || _models->loaded() > 0)) {
      char mline[512];
      std::snprintf(mline, sizeof(mline),
                    "[godot] models: loaded=%lld failed=%lld live=%lld %s%s",
                    _models->loaded(), _models->failed(), _models->live(),
                    _models->report().c_str(), _models->last_error().c_str());
      print_line(mline);
    }
    // UI 那一遍（D4 第二半，本切片新增的观测量；不进三条摘要）。
    const GodotUIStats& ui = renderer->ui_stats();
    std::snprintf(buf, sizeof(buf),
                  "[godot] ui: layers=%lld nodes=%lld drawn=%lld items=%lld texts=%lld hidden=%lld "
                  "empty=%lld clipped=%lld missing_img=%lld total_items=%zu",
                  ui.layers, ui.nodes, ui.drawn, ui.items, ui.texts, ui.hidden, ui.empty,
                  ui.clipped, ui.missing_img, f.items.size());
    print_line(buf);
  }
  // `--ui-dump`：最后一帧逐 UI 节点的一行事实（诊断；不进摘要）。
  if (_args.ui_dump && renderer != nullptr) {
    for (const std::string& line : renderer->ui_dump_lines()) print_line(line);
  }
  quit_with(0);
}

void LfwGodot::quit_with(int code) const {
  godot::SceneTree* const tree = get_tree();
  if (tree != nullptr) tree->quit(code);
}

void LfwGodot::_bind_methods() {}

}  // namespace lfw::host
