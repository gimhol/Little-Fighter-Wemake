// `lfw_run`：headless 入口 —— 把 `native/host/headless_host.h` 的宿主接到 `LFW` 上，
// 加载真实数据包（`--zip` 给的已解包目录 + `--root` 下的 `builtin_data/`），起一场
// bot 对 bot 的对局，然后**手动推帧**（`World::update_once`），每 `--every` 帧打一行摘要。
//
// 用法：
//   lfw_run --root <dir> --zip <dir> [--zip <dir> ...] [--stage <id>] [--frames 600]
//           [--players 2] [--fighter <id>] [--time <ms>] [--every 60] [--dev]
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "host/common/key_code.h"
#include "host/common/lfw_boot.h"
#include "host/common/zip_file.h"
#include "host/fs_zip.h"
#include "host/headless_host.h"
#include "lfw/bg/background.h"
#include "lfw/bot/bot_controller.h"
#include "lfw/core/state_hash.h"
#include "lfw/core/js_string.h"
#include "lfw/core/json5.h"
#include "lfw/core/value.h"
#include "lfw/defines/defines_data.h"
#include "lfw/defines/facing_flag.h"
#include "lfw/entity/entity_ref.h"
#include "lfw/helper/manhattan_xz.h"
#include "lfw/lfw.h"
#include "lfw/stage/stage.h"
#include "lfw/ui/uilayer.h"
#include "lfw/ui/uinode.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/cross_bounding.h"
#include "lfw/utils/type_check.h"
#include "lfw/utils/utf8.h"

namespace {

using lfw::Array;
using lfw::Entity;
using lfw::Object;
using lfw::Value;

struct Args {
  std::vector<std::filesystem::path> roots;
  std::vector<std::filesystem::path> zips;
  std::vector<std::u16string> fighters;
  std::u16string stage;
  int frames = 600;
  int players = 2;
  int every = 60;
  double time = 0;
  bool dev = false;
  bool dump = false;
  // `--vs`：按 TS 的「对战模式」构造场景（`GamePrepareLogic.start_game` 的 VS 分支 +
  // `VsModeLogic.on_start`），而不是宿主原来的闯关模式口径。
  bool vs = false;
  // `--click <x>,<y>[@<frame>]`：在第 `frame` 帧注入一次完整点击（按下 + 抬起），坐标是
  // **UI 逻辑像素**（左上原点、794×450 那套，与截图 1:1）。`--click-frame N` 给没写 `@frame`
  // 的那些点击定帧（缺省 60）。
  struct ClickAt {
    int frame = 0;
    double x = 0;
    double y = 0;
  };
  std::vector<ClickAt> clicks;
  std::vector<std::string> click_specs;  // 原文（`--click` 的顺序无关：帧号在解析末尾才定）
  int click_frame = 60;
  // `--key <name>[@<frame>]` / `--key-down` / `--key-up`：往宿主喂一次键盘事件
  //（`host.key_down/key_up`，与 Godot 的 `_input` 走同一条）。键名是**小写
  // `KeyboardEvent.key`**（`host/common/key_code.h` 的别名表；`space` / `esc` / `up`…）。
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
  int key_tap = 2;  // 一次「按一下」的按下 → 抬起间隔（帧）：中间至少隔一帧，别同帧按抬
  // `--zip-diff <zip>,<dir>`：真 `.zip` 与（`Expand-Archive` 出来的）解包目录**逐条比对**
  //（条目名 + 大小 + 内容 MD5）。不是跑游戏的模式：比完就退出，差异 ⇒ 退出码 1。可重复。
  struct ZipDiff {
    std::filesystem::path zip;
    std::filesystem::path dir;
  };
  std::vector<ZipDiff> zip_diffs;
};

std::string to_utf8(const std::u16string& s) {
  const std::vector<uint8_t> buf = lfw::encode_utf8(s);
  return std::string(buf.begin(), buf.end());
}

// UI 的层/页栈（`<层号>:<该层栈顶页 id>`）：点击有没有把页面推下去的**直接**证据。
std::string ui_pages_text(lfw::LFW& lfw) {
  lfw::ui::UILayers* const layers = lfw.ui_layers();
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

// `Value` 里取字符串（`lfw` 侧同名的 `as_str` 是 lfw.cpp 的文件内助手，不是公开 API）。
const std::u16string* as_str(const Value& v) { return std::get_if<std::u16string>(&v); }

// `world.dataset.get(k)` 缺省时（`undefined`）给 TS 的缺省值。
double num_field(const Value& v, double fallback) {
  if (std::holds_alternative<std::monostate>(v)) return fallback;
  const double n = lfw::to_number(v);
  return std::isnan(n) ? fallback : n;
}

void usage() {
  std::printf(
      "usage: lfw_run --root <dir> --zip <dir> [--zip <dir> ...] [--stage <id>] [--frames N]\n"
      "               [--players N] [--fighter <id>] [--time ms] [--every N] [--dev]\n"
      "               [--click <x>,<y>[@<frame>]] [--click-frame N]\n"
      "               [--key <name>[@<frame>]] [--key-down <name>[@<frame>]] [--key-up <name>[@<frame>]]\n"
      "               [--key-frame N] [--key-tap N]\n"
      "               [--zip-diff <zip>,<dir>]\n"
      "  --root    import 根目录（含 builtin_data/…），可重复\n"
      "  --zip     数据包目录（已解包），可重复；按给定顺序 load\n"
      "  --fighter 指定出场的角色 id，可重复（缺省用数据包里的前几个）\n"
      "  --click   在第 `--click-frame` 帧（或 `@frame`）注入一次完整点击（按下 + 抬起）；\n"
      "            坐标是 UI 逻辑像素（左上原点、`dataset.screen_w × screen_h` 那套）。可重复。\n"
      "  --click-frame  没写 `@frame` 的点击落在哪一帧（缺省 60）\n"
      "  --key          在第 `--key-frame` 帧（或 `@frame`）按一下（按下 + `--key-tap` 帧后抬起）；\n"
      "            键名取小写 `KeyboardEvent.key`（`space` / `esc` / `up` / `j`…）。可重复。\n"
      "  --key-down/--key-up  只按下 / 只抬起（要「按住」就用这一对）。\n"
      "  --key-frame    没写 `@frame` 的按键落在哪一帧（缺省 60）\n"
      "  --key-tap      「按一下」的按下 → 抬起间隔（帧，缺省 2）\n"
      "  --zip-diff  <zip>,<dir>：把真 `.zip` 与解包目录**逐条比对**（条目名 + 大小 + 内容 MD5），\n"
      "            差异 ⇒ 退出码 1。只比对、不跑游戏（`--root`/`--zip` 可省）。可重复。\n");
}

// `--click <x>,<y>[@<frame>]`：坐标取 `Number(...)` 口径（与 `--pos` 解析同源）。
bool parse_click(const std::string& text, int default_frame, Args::ClickAt& out) {
  const size_t at = text.find('@');
  const std::string pos = at == std::string::npos ? text : text.substr(0, at);
  const size_t comma = pos.find(',');
  if (comma == std::string::npos) return false;
  const double x = std::strtod(pos.substr(0, comma).c_str(), nullptr);
  const double y = std::strtod(pos.substr(comma + 1).c_str(), nullptr);
  if (!std::isfinite(x) || !std::isfinite(y)) return false;
  out.x = x;
  out.y = y;
  out.frame = default_frame;
  if (at != std::string::npos) out.frame = std::atoi(text.substr(at + 1).c_str());
  return out.frame >= 0;
}

bool parse_args(int argc, char** argv, Args& out) {
  const auto need = [&](int& i) -> const char* {
    if (i + 1 >= argc) return nullptr;
    return argv[++i];
  };
  for (int i = 1; i < argc; ++i) {
    const std::string a = argv[i];
    if (a == "--root") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.roots.emplace_back(v);
    } else if (a == "--zip") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.zips.emplace_back(v);
    } else if (a == "--fighter") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.fighters.push_back(lfw::decode_utf8(std::vector<uint8_t>(v, v + std::strlen(v))));
    } else if (a == "--stage") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.stage = lfw::decode_utf8(std::vector<uint8_t>(v, v + std::strlen(v)));
    } else if (a == "--frames") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.frames = std::atoi(v);
    } else if (a == "--players") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.players = std::atoi(v);
    } else if (a == "--every") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.every = std::atoi(v);
    } else if (a == "--time") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.time = std::atof(v);
    } else if (a == "--dev") {
      out.dev = true;
    } else if (a == "--dump") {
      out.dump = true;
    } else if (a == "--vs") {
      out.vs = true;
    } else if (a == "--click") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.click_specs.emplace_back(v);
    } else if (a == "--click-frame") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.click_frame = std::atoi(v);
      if (out.click_frame < 0) return false;
    } else if (a == "--key" || a == "--key-down" || a == "--key-up") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.key_specs.push_back(Args::KeySpec{
          a == "--key" ? "tap" : (a == "--key-down" ? "down" : "up"), v});
    } else if (a == "--key-frame") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.key_frame = std::atoi(v);
      if (out.key_frame < 0) return false;
    } else if (a == "--key-tap") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.key_tap = std::atoi(v);
      if (out.key_tap < 1) return false;
    } else if (a == "--zip-diff") {
      const char* v = need(i);
      if (v == nullptr) return false;
      const std::string spec = v;
      const size_t comma = spec.find(',');
      if (comma == std::string::npos) {
        std::fprintf(stderr, "bad --zip-diff value: %s (want <zip>,<dir>)\n", spec.c_str());
        return false;
      }
      out.zip_diffs.push_back(
          Args::ZipDiff{std::filesystem::path(spec.substr(0, comma)),
                        std::filesystem::path(spec.substr(comma + 1))});
    } else if (a == "--help" || a == "-h") {
      usage();
      std::exit(0);
    } else {
      std::fprintf(stderr, "unknown argument: %s\n", a.c_str());
      return false;
    }
  }
  if (out.zips.empty() && out.zip_diffs.empty()) return false;
  if (out.roots.empty()) out.roots.emplace_back(".");
  for (const std::string& spec : out.click_specs) {
    Args::ClickAt click;
    if (!parse_click(spec, out.click_frame, click)) {
      std::fprintf(stderr, "bad --click value: %s (want <x>,<y>[@<frame>])\n", spec.c_str());
      return false;
    }
    out.clicks.push_back(click);
  }
  for (const Args::KeySpec& spec : out.key_specs) {
    const size_t at = spec.text.find('@');
    const std::string name = at == std::string::npos ? spec.text : spec.text.substr(0, at);
    int frame = out.key_frame;
    if (at != std::string::npos) frame = std::atoi(spec.text.substr(at + 1).c_str());
    if (name.empty() || frame < 0) {
      std::fprintf(stderr, "bad --key value: %s (want <name>[@<frame>])\n", spec.text.c_str());
      return false;
    }
    const std::u16string key = lfw::host::dom_key_of_name(name);
    if (spec.kind == "tap") {
      out.keys.push_back(Args::KeyAt{frame, true, key});
      out.keys.push_back(Args::KeyAt{frame + out.key_tap, false, key});
    } else {
      out.keys.push_back(Args::KeyAt{frame, spec.kind == "down", key});
    }
  }
  std::stable_sort(out.keys.begin(), out.keys.end(),
                   [](const Args::KeyAt& a, const Args::KeyAt& b) { return a.frame < b.frame; });
  return true;
}

// `--zip-diff`：真 `.zip` ↔ 解包目录逐条比对。返回差异条数（0 = 全对）。
int run_zip_diff(const Args& args) {
  int bad = 0;
  for (const Args::ZipDiff& pair : args.zip_diffs) {
    std::ifstream in(pair.zip, std::ios::binary);
    if (!in) {
      std::fprintf(stderr, "[zip-diff] cannot open %s\n", pair.zip.generic_string().c_str());
      ++bad;
      continue;
    }
    std::string raw((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
    const std::string zp = pair.zip.generic_string();
    const std::u16string name_u16 =
        lfw::decode_utf8(std::vector<uint8_t>(zp.begin(), zp.end()));
    std::vector<uint8_t> bytes(raw.begin(), raw.end());
    std::unique_ptr<lfw::host::ZipFile> zip;
    std::u16string error;
    if (!lfw::host::ZipFile::open(name_u16, std::move(bytes), std::nullopt, zip, error)) {
      std::fprintf(stderr, "[zip-diff] %s\n", to_utf8(error).c_str());
      ++bad;
      continue;
    }
    // 目录那一侧：条目名 = 相对目录的路径（`/` 分隔）—— 与 `FsZip::index` 同口径。
    std::map<std::string, std::filesystem::path> files;
    std::error_code ec;
    for (std::filesystem::recursive_directory_iterator it(pair.dir, ec), end; it != end;
         it.increment(ec)) {
      if (ec) break;
      if (!it->is_regular_file(ec)) continue;
      std::error_code rel_ec;
      const std::filesystem::path rel = std::filesystem::relative(it->path(), pair.dir, rel_ec);
      if (rel_ec) continue;
      files[rel.generic_string()] = it->path();
    }
    size_t ok = 0;
    size_t missing = 0;
    size_t mismatch = 0;
    size_t done = 0;
    size_t stored = 0;
    size_t deflated = 0;
    size_t other = 0;
    for (size_t i = 0; i < zip->entry_count(); ++i) {
      if (zip->entry_method(i) == 0) ++stored;
      else if (zip->entry_method(i) == 8) ++deflated;
      else ++other;
    }
    const size_t kMaxReports = 20;
    std::vector<std::string> reports;
    for (size_t i = 0; i < zip->entry_count(); ++i) {
      const std::string name = to_utf8(zip->entry_name(i));
      const auto found = files.find(name);
      if (found == files.end()) {
        ++missing;
        if (reports.size() < kMaxReports) reports.push_back("missing on disk: " + name);
        continue;
      }
      std::string zip_bytes;
      if (!zip->read_entry(i, zip_bytes, error)) {
        ++mismatch;
        if (reports.size() < kMaxReports) reports.push_back(to_utf8(error));
        continue;
      }
      std::ifstream df(found->second, std::ios::binary);
      std::string dir_bytes((std::istreambuf_iterator<char>(df)), std::istreambuf_iterator<char>());
      const std::string a = lfw::host::md5_hex(zip_bytes);
      const std::string b = lfw::host::md5_hex(dir_bytes);
      if (zip_bytes.size() != dir_bytes.size() || a != b) {
        ++mismatch;
        if (reports.size() < kMaxReports) {
          reports.push_back("mismatch: " + name + " zip=" + std::to_string(zip_bytes.size()) + "/" +
                            a + " dir=" + std::to_string(dir_bytes.size()) + "/" + b);
        }
        continue;
      }
      ++ok;
      files.erase(found);
      ++done;
    }
    for (const std::pair<const std::string, std::filesystem::path>& kv : files) {
      if (reports.size() < kMaxReports) reports.push_back("extra on disk: " + kv.first);
    }
    for (const std::string& line : reports) std::printf("[zip-diff] %s\n", line.c_str());
    std::printf(
        "[zip-diff] %s vs %s: entries=%zu (stored=%zu deflate=%zu other=%zu) compared=%zu ok=%zu "
        "missing=%zu extra=%zu mismatch=%zu\n",
        pair.zip.generic_string().c_str(), pair.dir.generic_string().c_str(), zip->entry_count(),
        stored, deflated, other, done, ok, missing, files.size(), mismatch);
    bad += static_cast<int>(missing + mismatch + files.size());
  }
  return bad;
}

}  // namespace

int main(int argc, char** argv) {
  std::setvbuf(stdout, nullptr, _IONBF, 0);  // 崩了也要看得见走到哪一步
  Args args;
  if (!parse_args(argc, argv, args)) {
    usage();
    return 64;
  }

  lfw::host::ManualClock clock;
  lfw::host::NoopTimeout timeout;
  lfw::set_clock(&clock);
  lfw::set_timeout(&timeout);
  clock.set(args.time);

  // `--zip-diff` 是**离线比对**模式：比完就退出，不装包、不起世界。
  if (!args.zip_diffs.empty()) {
    const int bad = run_zip_diff(args);
    std::printf("[lfw_run] zip-diff: %d difference(s)\n", bad);
    return bad == 0 ? 0 : 1;
  }

  lfw::host::HeadlessHost host(args.roots, args.dev);

  std::vector<std::unique_ptr<lfw::host::FsZip>> zips;
  std::vector<lfw::LFW::ZipItem> items;
  for (const std::filesystem::path& dir : args.zips) {
    std::error_code ec;
    if (!std::filesystem::is_directory(dir, ec)) {
      std::fprintf(stderr, "not a directory: %s\n", dir.generic_string().c_str());
      return 66;
    }
    std::printf("[lfw_run] indexing %s ...\n", dir.generic_string().c_str());
    const std::string dir_name = dir.generic_string();
    const std::u16string zip_name =
        lfw::decode_utf8(std::vector<uint8_t>(dir_name.begin(), dir_name.end()));
    zips.push_back(std::make_unique<lfw::host::FsZip>(zip_name, dir));
    items.push_back(lfw::LFW::ZipItem{u"", zips.back().get()});
    std::printf("[lfw_run] package: %s (%zu entries)\n", dir.generic_string().c_str(),
                zips.back()->entry_count());
  }

  std::printf("[lfw_run] constructing LFW ...\n");
  lfw::LFW lfw(host, args.dev);
  // `--dev` 顺带打开核心的 `lfw_debug`（`LFW::__debugging`；TS 里由 `debug=true` 置位）——
  // 不然 `--dev` 只看得到宿主那几条。
  lfw.__debugging = args.dev;

  std::u16string error;
  std::printf("[lfw_run] loading ...\n");
  if (!lfw.load(items, error)) {
    std::fprintf(stderr, "[lfw_run] load failed: %s\n", to_utf8(error).c_str());
    for (const std::u16string& e : host.last_errors()) {
      std::fprintf(stderr, "  - %s\n", to_utf8(e).c_str());
    }
    return 2;
  }
  std::printf(
      "[lfw_run] loaded: fighters=%zu weapons=%zu balls=%zu entities=%zu stages=%zu bg=%zu bots=%zu "
      "moves=%zu directors=%zu\n",
      lfw.datas().fighters().size(), lfw.datas().weapons().size(), lfw.datas().balls().size(),
      lfw.datas().entities().size(), lfw.datas().stages().size(),
      lfw.datas().backgrounds().size(), lfw.datas().bots().size(), lfw.datas().moves().size(),
      lfw.datas().directors().size());
  if (args.dump) {
    const auto dump = [](const char* tag, const std::vector<Value>& list) {
      for (size_t i = 0; i < list.size() && i < 2; ++i) {
        const lfw::Json5TextResult r = lfw::json5_stringify(list[i]);
        std::u16string s = r.ok ? r.text : lfw::to_string(list[i]);
        if (s.size() > 300) s = s.substr(0, 300) + u"...";
        std::printf("[dump] %s[%zu] = %s\n", tag, i, to_utf8(s).c_str());
      }
    };
    dump("stage", lfw.datas().stages());
    dump("fighter", lfw.datas().fighters());
    dump("bg", lfw.datas().backgrounds());
    // 所有 id 一行一个：挑 `--fighter` / `--stage` 时用。
    const auto ids = [](const char* tag, const std::vector<Value>& list) {
      std::printf("[ids] %s (%zu):", tag, list.size());
      for (const Value& v : list) {
        const Value id_v = lfw::field_or(v, u"id");
        const std::u16string* const id = as_str(id_v);
        std::printf(" %s", id != nullptr ? to_utf8(*id).c_str() : "?");
      }
      std::printf("\n");
    };
    ids("stage", lfw.datas().stages());
    ids("fighter", lfw.datas().fighters());
    ids("bg", lfw.datas().backgrounds());
  }

  lfw::World& world = lfw.world();

  // ---- 装好这场对局（选 stage/bg → 造战士 → `change_stage`）----
  // 这段与 wasm 宿主共用 `host/common/lfw_boot.h`：日志留在宿主侧（`on_spawn` 的格式两边不同），
  // 建不起来时也由宿主决定继续还是停手（`on_failure` 返回 true 就是原来的"记账后继续"）。
  lfw::host::BootOptions boot;
  boot.fighters = args.fighters;
  boot.stage = args.stage;
  boot.players = args.players;
  boot.vs = args.vs;
  boot.on_spawn = [](const lfw::host::SpawnInfo& s) {
    std::printf("[lfw_run] spawn p%s %s @(%.1f, %.1f, %.1f) team=%s%s\n", to_utf8(s.player_id).c_str(),
                to_utf8(s.fighter_id).c_str(), s.x, s.y, s.z, to_utf8(s.team).c_str(),
                s.vs ? " (vs)" : "");
  };
  boot.on_failure = [](const lfw::host::BootFailure& f) {
    std::fprintf(stderr,
                 f.create_failed ? "[lfw_run] create fighter failed: %s\n"
                                 : "[lfw_run] fighter data not found: %s\n",
                 to_utf8(f.fighter_id).c_str());
    return true;
  };
  const lfw::host::BootResult booted = lfw::host::boot_scene(lfw, boot);
  if (!booted.ok) {
    std::fprintf(stderr, "[lfw_run] no fighter data in the loaded packages\n");
    return 3;
  }
  const std::u16string& stage_id = booted.stage_id;
  const std::u16string& bg_id = booted.bg_id;
  std::printf("[lfw_run] stage=%s bg=%s entities=%zu\n", to_utf8(stage_id).c_str(),
              to_utf8(bg_id).c_str(), world.entities.size());

  // ---- 诊断：bg / stage / 每个实体的 bound -------------------------------------------
  // bot 的 `get_bound()`（`can_back_off` / `cornered` / `should_chase`）与
  // `lock_when_stand_and_rest`（bg 的 width/near/far）都吃这些值，所以先打出来。
  if (const lfw::Background* const bg = world.bg()) {
    std::printf(
        "[bg] id=%s name=%s size=(%.1f, %.1f, %.1f) planes=(near=%.1f far=%.1f) "
        "left/right=(%.1f, %.1f) zoom=(%.2f, %.2f, %.2f) layers=%zu update_times=%.1f "
        "layer_data_index=%.1f\n",
        to_utf8(lfw::to_string(bg->id())).c_str(), to_utf8(lfw::to_string(bg->name())).c_str(),
        bg->width(), bg->height(), bg->depth(), bg->near_plane(), bg->far_plane(), bg->left(),
        bg->right(), bg->zoom_x(), bg->zoom_y(), bg->zoom_z(), bg->layers().size(),
        bg->update_times(), bg->layer_data_index());
  } else {
    std::printf("[bg] none\n");
  }
  if (const lfw::Stage* const stage = world.stage()) {
    std::printf(
        "[stage] team=%s player=(%.1f, %.1f) enemy=(%.1f, %.1f) drink=(%.1f, %.1f) "
        "planes=(near=%.1f far=%.1f)\n",
        to_utf8(lfw::to_string(stage->team())).c_str(), stage->player_l, stage->player_r,
        stage->enemy_l, stage->enemy_r, stage->drink_l, stage->drink_r, stage->near_plane(),
        stage->far_plane());
  } else {
    std::printf("[stage] none\n");
  }
  for (Entity* const e : world.entities) {
    if (e == nullptr) continue;
    const std::vector<double> b = world.get_bound(*e);
    std::printf("[bound] %s team=%s type=%s bot=%d l=%.1f r=%.1f near=%.1f far=%.1f\n",
                to_utf8(e->id).c_str(), to_utf8(e->team()).c_str(),
                to_utf8(lfw::to_string(e->data_type())).c_str(), e->ctrl_is_bot() ? 1 : 0,
                b.size() > 0 ? b[0] : 0.0, b.size() > 1 ? b[1] : 0.0, b.size() > 2 ? b[2] : 0.0,
                b.size() > 3 ? b[3] : 0.0);
  }

  // ---- 推帧 ----
  const double ups = num_field(world.dataset.get(u"UPS"), 60.0);
  const double dt = 1000.0 / (ups > 0 ? ups : 60.0);
  const int every = args.every > 0 ? args.every : 60;
  const bool scripted = !args.clicks.empty() || !args.keys.empty();
  const bool scripted_clicks = !args.clicks.empty();
  const bool scripted_keys = !args.keys.empty();
  if (scripted_clicks) std::printf("[ui] pages before clicks: %s\n", ui_pages_text(lfw).c_str());
  if (scripted_keys) std::printf("[ui] pages before keys: %s\n", ui_pages_text(lfw).c_str());
  std::string digest;
  for (int frame = 0; frame < args.frames; ++frame) {
    // 注入点击：命令先入队，再由**这一步**的 `World::step`（`handle_cmds`）消化 ⇒
    // 「点在第 N 帧」就是第 N 帧生效（与 Godot 的 `_input` 走同一条路径）。
    for (const Args::ClickAt& click : args.clicks) {
      if (click.frame != frame) continue;
      host.click_ui(lfw, click.x, click.y);
      std::printf("[click] frame=%d at=(%.1f, %.1f) pages=%s\n", frame, click.x, click.y,
                  ui_pages_text(lfw).c_str());
    }
    // 注入按键：同一条路（`host.key_down` → `LFW::on_key_down` → `KEY_EVENT` 命令 → UI 层）。
    for (const Args::KeyAt& key : args.keys) {
      if (key.frame != frame) continue;
      if (key.down) {
        host.key_down(key.key);
      } else {
        host.key_up(key.key);
      }
      const auto pressed = host.pressed_keys().find(key.key);
      std::printf("[key  ] frame=%d %s key=%s times=%d pages=%s\n", frame,
                  key.down ? "down" : "up", to_utf8(key.key).c_str(),
                  pressed == host.pressed_keys().end() ? 0 : pressed->second,
                  ui_pages_text(lfw).c_str());
    }
    clock.advance(dt);
    world.update_once(dt);
    if (frame % every == 0 || frame == args.frames - 1) {
      digest = lfw::host::frame_digest(world, frame);
      std::printf("[frame %6d] entities=%zu ghosts=%zu hp=%.1f digest=%s\n", frame,
                  world.entities.size(), world.ghosts.size(), lfw::host::total_hp(world),
                  digest.c_str());
      if (scripted_clicks) std::printf("[ui] pages: %s\n", ui_pages_text(lfw).c_str());
      if (scripted_keys) std::printf("[ui] pages after keys: %s\n", ui_pages_text(lfw).c_str());
      // 诊断行：各实体的 state / frame.id / 位置 + bg 运动（看帧链有没有在推进）
      std::printf("[  state]");
      for (Entity* const e : world.entities) {
        if (e == nullptr) continue;
        std::printf(
            " %s{state=%s frame=%s x=%.1f y=%.1f f=%.0f hp=%.0f bot=%d m=%d g=%d h=%s/%s}",
            to_utf8(e->id).c_str(), to_utf8(lfw::to_string(e->state())).c_str(),
            to_utf8(lfw::to_string(e->frame_id())).c_str(), e->position.x, e->position.y, e->facing,
            e->hp(), e->ctrl_is_bot() ? 1 : 0, lfw::truthy(Value(e->mounted())) ? 1 : 0,
            lfw::truthy(Value(e->ghosted())) ? 1 : 0,
            e->holding != nullptr ? to_utf8(e->holding->id).c_str() : "-",
            to_utf8(lfw::to_string(e->holding_base_type())).c_str());
      }
      if (const lfw::Background* const bg = world.bg()) {
        std::printf(" | bg{update_times=%.1f layer_data_index=%.1f left=%.1f right=%.1f}",
                    bg->update_times(), bg->layer_data_index(), bg->left(), bg->right());
      }
      std::printf("\n");
      // 诊断行：bot 决策（目标表 / 行为 / 对每个其它实体的 `should_chase`）
      std::printf("[   bots]");
      for (Entity* const e : world.entities) {
        if (e == nullptr || !e->ctrl_is_bot()) continue;
        lfw::bot::BotController* const bc = static_cast<lfw::bot::BotController*>(e->ctrl());
        if (bc == nullptr) continue;
        const lfw::Entity* const ch = bc->chasings.get();
        const lfw::Entity* const av = bc->avoidings.get();
        std::printf(" %s{behavior=%s dummy=%s has_bot=%d n_chase=%zu n_avoid=%zu n_defend=%zu",
                    to_utf8(e->id).c_str(),
                    to_utf8(lfw::bot::bot_behavior_name(bc->behavior)).c_str(),
                    to_utf8(lfw::to_string(bc->dummy)).c_str(),
                    lfw::truthy(bc->bot) ? 1 : 0, bc->chasings.targets().size(),
                    bc->avoidings.targets().size(), bc->defends.targets().size());
        if (ch != nullptr) {
          std::printf(" chase=%s@%.1f", to_utf8(ch->id).c_str(),
                      lfw::helper::manhattan_xz(*e, *ch));
        }
        if (av != nullptr) {
          std::printf(" avoid=%s@%.1f", to_utf8(av->id).c_str(),
                      lfw::helper::manhattan_xz(*e, *av));
        }
        for (Entity* const o : world.entities) {
          if (o == nullptr || o == e) continue;
          const Value o_ref = lfw::ref_of(*o);
          std::printf(" |chase?(%s)=%d,leave=%d,back_off=%d,cornered=%d", to_utf8(o->id).c_str(),
                      bc->should_chase(*o) ? 1 : 0, bc->is_leave_chase_range(o_ref) ? 1 : 0,
                      bc->can_back_off(o_ref) ? 1 : 0, bc->cornered(o_ref) ? 1 : 0);
        }
        std::printf("}");
      }
      std::printf("\n");
    }
  }

  if (scripted) std::printf("[ui] pages after run: %s\n", ui_pages_text(lfw).c_str());
  std::printf(
      "[lfw_run] done: frames=%d ups=%.0f digest=%s warns=%d errors=%d ignored_images=%lld "
      "renderer(+-)=%lld/%lld clock=%.1fms\n",
      args.frames, ups, digest.c_str(), host.warn_count(), host.error_count(),
      host.ignored_images(), host.renderer().added, host.renderer().removed, clock.now());
  // UI 渲染面（DESIGN D4）：核心每帧对每层的 UI 根节点发一次调用，渲染面在端口是空默认体
  // ⇒ 这两个数就是「发了多少、其中多少没人画」。headless 宿主不装 `IRenderScheduler`
  // （`world.cpp:656` 的 raf 槽空转）⇒ 不自己渲染，这里会是 0。
  std::printf("[lfw_run] UI render calls: %lld (unhandled: %lld)\n", world.ui_render_calls(),
              world.ui_render_unhandled());
  for (const Entity* const e : world.entities) {
    if (e == nullptr) continue;
    std::printf("[lfw_run] final %s team=%s pos=(%.1f, %.1f, %.1f) hp=%.1f/%.1f mp=%.1f state=%s\n",
                to_utf8(e->id).c_str(), to_utf8(e->team()).c_str(), e->position.x, e->position.y,
                e->position.z, e->hp(), e->hp_max(), e->mp(), to_utf8(lfw::to_string(e->state())).c_str());
  }
  return 0;
}
