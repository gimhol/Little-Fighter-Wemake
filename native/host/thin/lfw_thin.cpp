// `lfw_thin`：录制型薄宿主入口 —— 与 `lfw_run` **同一条装配 / 推帧路线**（共用
// `host/common/lfw_boot.{h,cpp}` 的 `boot_scene` / `frame_digest` / `total_hp`），只把世界
// 渲染器换成 `RecordingWorldRenderer`（`host/thin/recording_world_renderer.h`）：
// 它不画，逐帧记下「核心要求渲染器画什么」（字段表与行格式见那个头文件）。
//
// 用法：
//   lfw_thin --root <dir> --zip <dir> [--zip <dir> ...] [--stage <id>] [--frames 600]
//            [--players 2] [--fighter <id>] [--time <ms>] [--every 60] [--dev] [--vs]
//            [--dump <file>] [--sample 3] [--sync-render <档>] [--sub-render N]
//   --root / --zip / --stage / --frames / --players / --fighter / --time / --every / --dev /
//   --vs     与 `lfw_run` 同义（`--vs` = TS 的对战模式口径）
//   --dump <file>   把**整条记录**（每帧帧头 + 每个活体一行）写到文件
//   --sample <n>    `--every` 那几行后面顺带打几条 `E` 记录（缺省 3，0 = 不打）
//   --sync-render <Unlimited|Half|Sync|FPS_60|FPS_120|0..4>   boot 后设 `dataset.sync_render`
//                   （缺省 = 数据里那份 `FPS_60`）。设成 `FPS_120`（或 `Unlimited`）才有
//                   `world.FPS > dataset.UPS` ⇒ 插值那条路（见录制器文件头 + DESIGN D1(c)）
//   --sub-render N  一个 tick 里渲染 N 次，每次 `dt / N`（缺省 1 = 老口径）。要真跑插值，
//                   两个一起用：`--sync-render FPS_120 --sub-render 4` ⇒ `df = 0 / .25 / .5 / .75`
//
// 输出（stdout）：
//   [thin] ...                  装配日志（与 lfw_run 同格式，便于对拍）
//   [frame N] entities=.. digest=.. renders=.. rec=..     每 --every 帧一行（与 lfw_run 同摘要）
//   [draw] <E 行>               该帧前几条绘制记录（真实数据，不是示意）
//   [thin] done: ...            收尾统计（add/del、对拍不一致帧数、最终 digest）
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "host/common/lfw_boot.h"
#include "host/fs_zip.h"
#include "host/thin/recording_world_renderer.h"
#include "host/thin/thin_host.h"
#include "lfw/core/value.h"
#include "lfw/lfw.h"
#include "lfw/utils/utf8.h"
#include "lfw/world.h"

namespace {

using lfw::Value;

struct Args {
  std::vector<std::filesystem::path> roots;
  std::vector<std::filesystem::path> zips;
  std::vector<std::u16string> fighters;
  std::u16string stage;
  std::string dump;
  int frames = 600;
  int players = 2;
  int every = 60;
  int sample = 3;
  int sub_render = 1;
  double time = 0;
  double sync_render = -1;  // < 0 = 不动 `dataset.sync_render`（用数据里的那份）
  bool dev = false;
  bool vs = false;
};

// `--sync-render` 的取值：枚举名（`defines/sync_render_enum.h`）或裸数字。
bool parse_sync_render(const char* s, double& out) {
  static const std::pair<const char*, double> names[] = {
    {"Unlimited", 0}, {"Half", 1}, {"Sync", 2}, {"FPS_60", 3}, {"FPS_120", 4},
  };
  for (const auto& kv : names) {
    if (std::strcmp(s, kv.first) == 0) {
      out = kv.second;
      return true;
    }
  }
  char* end = nullptr;
  const double v = std::strtod(s, &end);
  if (end == s || *end != '\0') return false;
  out = v;
  return true;
}

std::string to_utf8(const std::u16string& s) {
  const std::vector<uint8_t> buf = lfw::encode_utf8(s);
  return std::string(buf.begin(), buf.end());
}

std::u16string from_utf8(const char* s) {
  return lfw::decode_utf8(std::vector<uint8_t>(s, s + std::strlen(s)));
}

double num_field(const Value& v, double fallback) {
  if (std::holds_alternative<std::monostate>(v)) return fallback;
  const double n = lfw::to_number(v);
  return std::isnan(n) ? fallback : n;
}

void usage() {
  std::printf(
      "usage: lfw_thin --root <dir> --zip <dir> [--zip <dir> ...] [--stage <id>] [--frames N]\n"
      "                [--players N] [--fighter <id>] [--time ms] [--every N] [--dev] [--vs]\n"
      "                [--dump <file>] [--sample N] [--sync-render <档>] [--sub-render N]\n"
      "  --root    import 根目录（含 builtin_data/…），可重复\n"
      "  --zip     数据包目录（已解包），可重复；按给定顺序 load\n"
      "  --fighter 指定出场的角色 id，可重复（缺省用数据包里的前几个）\n"
      "  --dump    把整条绘制记录写到文件（字段表见 host/thin/recording_world_renderer.h）\n"
      "  --sync-render  boot 后设 dataset.sync_render（Unlimited/Half/Sync/FPS_60/FPS_120 或 0..4）\n"
      "  --sub-render   一个 tick 渲染几次（每次 dt/N）；跑插值要配上 FPS_120/Unlimited\n");
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
      out.fighters.push_back(from_utf8(v));
    } else if (a == "--stage") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.stage = from_utf8(v);
    } else if (a == "--dump") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.dump = v;
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
    } else if (a == "--sample") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.sample = std::atoi(v);
    } else if (a == "--time") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.time = std::atof(v);
    } else if (a == "--sub-render") {
      const char* v = need(i);
      if (v == nullptr) return false;
      out.sub_render = std::atoi(v);
    } else if (a == "--sync-render") {
      const char* v = need(i);
      if (v == nullptr || !parse_sync_render(v, out.sync_render)) return false;
    } else if (a == "--dev") {
      out.dev = true;
    } else if (a == "--vs") {
      out.vs = true;
    } else if (a == "--help" || a == "-h") {
      usage();
      std::exit(0);
    } else {
      std::fprintf(stderr, "unknown argument: %s\n", a.c_str());
      return false;
    }
  }
  if (out.zips.empty()) return false;
  if (out.roots.empty()) out.roots.emplace_back(".");
  return true;
}

// `--dump`：整条记录（每个记录帧 = 帧头一行 + 每个活体一行）。
bool write_dump(const std::string& path, const std::vector<lfw::host::FrameDrawRecord>& frames) {
  std::FILE* const f = std::fopen(path.c_str(), "wb");
  if (f == nullptr) return false;
  std::fprintf(f, "# lfw_thin draw record: one FRAME header per render() call, then one E line per\n");
  std::fprintf(f, "# live entity (sorted by id).\n%s\n",
               lfw::host::format_entity_field_names().c_str());
  for (const lfw::host::FrameDrawRecord& frame : frames) {
    std::fprintf(f, "%s\n", lfw::host::format_frame_header(frame).c_str());
    for (const lfw::host::EntityDrawRecord& e : frame.entities) {
      std::fprintf(f, "  %s\n", lfw::host::format_entity_record(e).c_str());
    }
  }
  std::fclose(f);
  return true;
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

  lfw::host::ThinHost host(args.roots, args.dev);

  std::vector<std::unique_ptr<lfw::host::FsZip>> zips;
  std::vector<lfw::LFW::ZipItem> items;
  for (const std::filesystem::path& dir : args.zips) {
    std::error_code ec;
    if (!std::filesystem::is_directory(dir, ec)) {
      std::fprintf(stderr, "not a directory: %s\n", dir.generic_string().c_str());
      return 66;
    }
    const std::string dir_name = dir.generic_string();
    zips.push_back(std::make_unique<lfw::host::FsZip>(from_utf8(dir_name.c_str()), dir));
    items.push_back(lfw::LFW::ZipItem{u"", zips.back().get()});
    std::printf("[thin] package: %s (%zu entries)\n", dir_name.c_str(), zips.back()->entry_count());
  }

  lfw::LFW lfw(host, args.dev);
  lfw::host::RecordingWorldRenderer* const rec = &host.recorder();

  std::u16string error;
  if (!lfw.load(items, error)) {
    std::fprintf(stderr, "[thin] load failed: %s\n", to_utf8(error).c_str());
    for (const std::u16string& e : host.last_errors()) {
      std::fprintf(stderr, "  - %s\n", to_utf8(e).c_str());
    }
    return 2;
  }

  lfw::host::BootOptions boot;
  boot.fighters = args.fighters;
  boot.stage = args.stage;
  boot.players = args.players;
  boot.vs = args.vs;
  boot.on_spawn = [](const lfw::host::SpawnInfo& s) {
    std::printf("[thin] spawn p%s %s @(%.1f, %.1f, %.1f) team=%s%s\n", to_utf8(s.player_id).c_str(),
                to_utf8(s.fighter_id).c_str(), s.x, s.y, s.z, to_utf8(s.team).c_str(),
                s.vs ? " (vs)" : "");
  };
  boot.on_failure = [](const lfw::host::BootFailure& f) {
    std::fprintf(stderr,
                 f.create_failed ? "[thin] create fighter failed: %s\n"
                                 : "[thin] fighter data not found: %s\n",
                 to_utf8(f.fighter_id).c_str());
    return true;
  };
  const lfw::host::BootResult booted = lfw::host::boot_scene(lfw, boot);
  if (!booted.ok) {
    std::fprintf(stderr, "[thin] no fighter data in the loaded packages\n");
    return 3;
  }

  lfw::World& world = lfw.world();
  std::printf("[thin] stage=%s bg=%s entities=%zu ghost_ok=%d\n", to_utf8(booted.stage_id).c_str(),
              to_utf8(booted.bg_id).c_str(), world.entities.size(),
              world.entities.size() == static_cast<std::size_t>(rec->retained_count()) ? 1 : 0);

  // 渲染档位：只改 `dataset.sync_render`（帧内比例那一步的输入），不动模拟。缺省不碰。
  const double ups = num_field(world.dataset.get(u"UPS"), 60.0);
  if (args.sync_render >= 0) {
    world.dataset.set(u"sync_render", Value(args.sync_render));
    std::printf("[thin] sync_render=%.0f (FPS=%.0f) ups=%.0f sub_render=%d\n", args.sync_render,
                world.fps_value(), ups, args.sub_render > 0 ? args.sub_render : 1);
  }
  const double dt = 1000.0 / (ups > 0 ? ups : 60.0);
  const int every = args.every > 0 ? args.every : 60;
  const int sub_render = args.sub_render > 1 ? args.sub_render : 1;
  std::string digest;
  for (int frame = 0; frame < args.frames; ++frame) {
    clock.advance(dt);
    host.step_frame(world, dt, sub_render);
    if (frame % every == 0 || frame == args.frames - 1) {
      digest = lfw::host::frame_digest(world, frame);
      std::printf("[frame %6d] entities=%zu ghosts=%zu hp=%.1f digest=%s renders=%d rec=%zu\n",
                  frame, world.entities.size(), world.ghosts.size(),
                  lfw::host::total_hp(world), digest.c_str(), rec->render_count(),
                  rec->frames().empty() ? 0 : rec->frames().back().entities.size());
      const lfw::host::FrameDrawRecord& last = rec->frames().back();
      std::printf("[  frame] %s\n", lfw::host::format_frame_header(last).c_str());
      const int n = args.sample < 0 ? 0 : args.sample;
      for (int i = 0; i < n && i < static_cast<int>(last.entities.size()); ++i) {
        std::printf("[   draw] %s\n", lfw::host::format_entity_record(last.entities[i]).c_str());
      }
    }
  }

  if (!args.dump.empty()) {
    if (!write_dump(args.dump, rec->frames())) {
      std::fprintf(stderr, "[thin] cannot write dump: %s\n", args.dump.c_str());
      return 73;
    }
    std::printf("[thin] dump: %s (%zu frames)\n", args.dump.c_str(), rec->frames().size());
  }

  std::printf(
      "[thin] done: frames=%d ups=%.0f digest=%s renders=%d added=%lld removed=%lld "
      "dup_add=%lld stray_del=%lld mismatch_frames=%lld disposed=%d ents_rec=%lld df01=%lld "
      "interp=%lld moved=%lld\n",
      args.frames, ups, digest.c_str(), rec->render_count(), rec->added(), rec->removed(),
      rec->duplicate_adds(), rec->stray_removes(), rec->mismatched_frames(),
      rec->disposed() ? 1 : 0, rec->entity_records(), rec->df_between_records(),
      rec->interpolated_records(), rec->moving_records());
  // UI 渲染面（DESIGN D4）：本宿主每帧自己补 `render_once` ⇒ 这两个数非 0，且
  // `renders` 帧数 × 层数应当与 `calls` 对得上；`unhandled` 今天必然等于 `calls`
  //（端口没有会画的 `IUINodeRenderer` 实现）。
  std::printf("[thin] UI render calls: %lld (unhandled: %lld)\n", world.ui_render_calls(),
              world.ui_render_unhandled());
  return 0;
}
