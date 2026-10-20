// `bot/` 切片的差分台面：`BotController` + `bot/state/*` + `loader/get_val_from_bot_ctrl`。
//
// 端口里控制器看不见 `Entity`：它的一切都从 `CtrlEnv`（bot 段）与 `Value` 引用读。
// 台面照这个边界搭：
//   * `me …`：本机实体（场景对象），每次调用前由台面刷进 `CtrlEnv`（等价于端口里
//     `Entity::refresh_ctrl_env` 在每次 `ctrl.update()` 前的刷新；TS 那边 `this.entity`
//     是活读，台面的 TS 侧直接用同一个场景对象）。
//   * `fx …`：对家/目标（`Value` 引用；TS 侧是同一份字面对象，因为 TS 读的也只是字段）。
//   * `stage …` / `diff …` / `bound …` / `hpa …` / `pup …` / `datas …`：world/lfw 的缝。
//   * `mtseed/mtdebug/mtmark/mtcases`：`lfw.mt`（`_case` / `desire` 都往它上面记）。
//
// TS 侧经 `preprocess_bot_data` 会把 `action.judger` 编好；端口按既有约定（DESIGN §4.57）
// 在 `handle_action` 里按 `expression` 现编 —— 台面的 TS 侧在 `act` 之前做同样的一次附加，
// 让两边跑的是「同一份数据的两条路」。

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "lfw/bot/bot_controller.h"
#include "lfw/bot/bot_env.h"
#include "lfw/bot/nearest_targets.h"
#include "lfw/cases.h"
#include "lfw/controller/base_controller.h"
#include "lfw/core/value.h"
#include "lfw/defines/bin_op.h"
#include "lfw/defines/defines_data.h"
#include "lfw/defines/difficulty.h"
#include "lfw/helper/manhattan_xz.h"
#include "lfw/loader/get_val_from_bot_ctrl.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/mersenne_twister.h"

#include "scripted_entity.h"
#include "trace_util.h"

namespace {

using lfw::NullTag;
using lfw::Value;

using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;

std::unique_ptr<lfw::MersenneTwister> g_mt;
Value g_me;
// `me` / `fx …` 的快照是「真身」，各自有一份**真实体**（`ref_of()` 从它们现读）：
// `NearestTargets` / `following` / `watching` / `CtrlEnv::holding` 现在都收实体指针。
std::unique_ptr<fx::ScriptedEntity> g_me_ent;
std::vector<std::pair<std::u16string, std::unique_ptr<fx::ScriptedEntity>>> g_fx_ent;
// `fx put` / `fx del` 换下来的旧实体（目标表里可能还留着指针）——不发释放，别让指针悬空。
std::vector<std::unique_ptr<fx::ScriptedEntity>> g_fx_grave;
// `meref holding|catching "x"`：`CtrlEnv` 的那两个槽位现在存实体指针（TS 是对象引用，
// 所以这里也钉住那一刻的实体，后面 `fx put` 重建不影响它）。
const lfw::Entity* g_holding = nullptr;
const lfw::Entity* g_catching = nullptr;
std::vector<std::pair<std::u16string, Value>> g_fx;
std::vector<std::pair<std::u16string, Value>> g_stage;
std::vector<std::pair<std::u16string, Value>> g_bg;
Value g_diff = Value(1.0);
std::vector<double> g_bound;
bool g_hpa = true;
std::vector<std::u16string> g_pups;
std::vector<std::pair<std::u16string, Value>> g_datas;
std::vector<std::string> g_log;

std::string opline(const std::vector<std::string>& t) {
  std::string out;
  for (std::size_t i = 0; i < t.size(); ++i) {
    if (i != 0) out += " ";
    out += t[i];
  }
  return out;
}

// 引用对象的两处「形状补齐」（TS 侧同名实现）：
//   * `state` 与 `frame.state` 互写（端口的引用读 `frame.state`，TS 的活实体读 getter）；
//   * `data.base.type` → 顶层 `base_type`（TS 实体有 `get base_type()`）。
void norm_ref(Value& v) {
  lfw::Object* const o = lfw::as_object(v);
  if (o == nullptr) return;
  const Value* const state_p = o->get(u"state");
  Value frame_v = lfw::field_or(*o, u"frame");
  lfw::Object* frame_o = lfw::as_object(frame_v);
  if (state_p != nullptr && frame_o == nullptr) {
    frame_v = Value(std::make_shared<lfw::Object>());
    frame_o = lfw::as_object(frame_v);
    o->set(u"frame", frame_v);
  }
  if (frame_o != nullptr) {
    if (frame_o->get(u"state") == nullptr && state_p != nullptr) {
      frame_o->set(u"state", *state_p);
    }
    const Value* const fs = frame_o->get(u"state");
    if (fs != nullptr) o->set(u"state", *fs);
  }
  Value data_v = lfw::field_or(*o, u"data");
  lfw::Object* const data_o = lfw::as_object(data_v);
  if (data_o == nullptr) return;
  Value base_v = lfw::field_or(*data_o, u"base");
  lfw::Object* const base_o = lfw::as_object(base_v);
  if (base_o != nullptr && o->get(u"base_type") == nullptr) {
    const Value* const t_v = base_o->get(u"type");
    if (t_v != nullptr) o->set(u"base_type", *t_v);
  }
}

lfw::controller::CtrlEnv g_env;
std::unique_ptr<lfw::bot::BotController> g_ctrl;

std::string render(const Value& v) { return to_ascii(render_value(v)); }

std::string num(double d) { return render(Value(d)); }

std::string join_log() {
  std::string out;
  for (std::size_t i = 0; i < g_log.size(); ++i) {
    if (i != 0) out += ",";
    out += g_log[i];
  }
  g_log.clear();
  return out;
}

void emit(const std::string& line) { std::printf("%s\n", line.c_str()); }

const Value* find_fx(const std::u16string& name) {
  for (const auto& kv : g_fx) {
    if (kv.first == name) return &kv.second;
  }
  return nullptr;
}

std::string name_of_ent(const lfw::Entity* const e) {
  if (e == nullptr) return "z";  // TS 的 `null`
  for (const auto& kv : g_fx_ent) {
    if (kv.second.get() == e) return to_ascii(kv.first);
  }
  return "?";
}

// 名字 → 真实体（懒建，字段照快照那一份灌）。
fx::ScriptedEntity* fx_ent(const std::u16string& name, int lineno) {
  for (auto& kv : g_fx_ent) {
    if (kv.first == name) return kv.second.get();
  }
  const Value* const snap = find_fx(name);
  if (snap == nullptr) {
    std::fprintf(stderr, "unknown fx '%s' at line %d\n", to_ascii(name).c_str(), lineno);
    std::exit(2);
  }
  auto e = std::make_unique<fx::ScriptedEntity>(name, *snap);
  fx::ScriptedEntity* const out = e.get();
  g_fx_ent.push_back(std::make_pair(name, std::move(e)));
  return out;
}

const lfw::Entity* find_ent_by_name(const std::u16string& name) {
  for (const auto& kv : g_fx_ent) {
    if (kv.first == name) return kv.second.get();
  }
  return nullptr;
}

std::string name_of(const Value& v) {
  if (std::holds_alternative<std::monostate>(v)) return "u";
  if (std::holds_alternative<NullTag>(v)) return "z";
  for (const auto& kv : g_fx) {
    if (lfw::strict_equals(kv.second, v)) return to_ascii(kv.first);
  }
  return "?";
}

Value fx_arg(const std::u16string& name, int lineno) {
  const Value* v = find_fx(name);
  if (v == nullptr) {
    std::fprintf(stderr, "unknown fx '%s' at line %d\n", to_ascii(name).c_str(), lineno);
    std::exit(2);
  }
  return *v;
}

std::string targets_text(const lfw::bot::NearestTargets& nt) {
  std::string s = "[";
  for (std::size_t i = 0; i < nt.targets().size(); ++i) {
    if (i != 0) s += ",";
    const lfw::Entity* const t = nt.targets()[i];
    s += name_of_ent(t) + ":" + num(lfw::helper::manhattan_xz(*g_me_ent, *t));
  }
  s += "]";
  return s;
}

std::string sets_text() {
  return "ch=" + targets_text(g_ctrl->chasings) + " av=" + targets_text(g_ctrl->avoidings) +
         " def=" + targets_text(g_ctrl->defends);
}

// `me` 的路径写入（`position.x` / `data.base.bot` …）。TS 侧同名实现。
void set_path(Value& root, const std::vector<std::string>& segs, std::size_t at, const Value& v) {
  if (at + 1 == segs.size()) {
    lfw::Object* o = lfw::as_object(root);
    if (o == nullptr) {
      root = Value(std::make_shared<lfw::Object>());
      o = lfw::as_object(root);
    }
    o->set(trace::to_u16(segs[at]), v);
    return;
  }
  lfw::Object* o = lfw::as_object(root);
  if (o == nullptr) {
    root = Value(std::make_shared<lfw::Object>());
    o = lfw::as_object(root);
  }
  const std::u16string key = trace::to_u16(segs[at]);
  const Value* child = o->get(key);
  Value next = child != nullptr ? *child : Value();
  set_path(next, segs, at + 1, v);
  o->set(key, next);
}

// `entity.base_type` 那类读取：difficulty 的 puppets 扫描（`BotController.difficulty`）。
Value stage_value(const std::u16string& key) {
  for (const auto& kv : g_stage) {
    if (kv.first == key) return kv.second;
  }
  return Value();
}

Value void_stage_id() {
  static const Value v = [] {
    const Value* const stage = lfw::defines::find(u"Defines.VOID_STAGE");
    return stage != nullptr ? lfw::field_or(*stage, u"id") : Value();
  }();
  return v;
}

double bot_difficulty() {
  if (!lfw::strict_equals(stage_value(u"id"), void_stage_id())) {
    const std::u16string my_team = lfw::to_string(lfw::field_or(g_me, u"team"));
    for (const std::u16string& name : g_pups) {
      const Value* const f = find_fx(name);
      if (f == nullptr) continue;
      if (lfw::to_string(lfw::field_or(*f, u"team")) != my_team) continue;
      if (lfw::truthy(lfw::field_or(lfw::field_or(*f, u"ctrl"), u"__is_human_ctrl__"))) {
        return static_cast<double>(lfw::Difficulty::Difficult);
      }
    }
  }
  return lfw::to_number(g_diff);
}

// 台面每一次「调用控制器」之前把场景刷进 env（端口里 `Entity::refresh_ctrl_env` 的 bot 段）。
void sync_env() {
  if (g_me_ent) g_me_ent->resync();
  g_env.self = g_me_ent.get();
  const Value pos = lfw::field_or(g_me, u"position");
  const Value vel = lfw::field_or(g_me, u"velocity");
  g_env.id = lfw::to_string(lfw::field_or(g_me, u"id"));
  g_env.hp = lfw::to_number(lfw::field_or(g_me, u"hp"));
  g_env.hp_max = lfw::to_number(lfw::field_or(g_me, u"hp_max"));
  g_env.facing = lfw::to_number(lfw::field_or(g_me, u"facing"));
  g_env.team = lfw::to_string(lfw::field_or(g_me, u"team"));
  g_env.px = lfw::to_number(lfw::field_or(pos, u"x"));
  g_env.py = lfw::to_number(lfw::field_or(pos, u"y"));
  g_env.pz = lfw::to_number(lfw::field_or(pos, u"z"));
  g_env.vx = lfw::to_number(lfw::field_or(vel, u"x"));
  g_env.vy = lfw::to_number(lfw::field_or(vel, u"y"));
  g_env.vz = lfw::to_number(lfw::field_or(vel, u"z"));
  g_env.mounted = lfw::truthy(lfw::field_or(g_me, u"mounted"));
  g_env.invisible = lfw::truthy(lfw::field_or(g_me, u"invisible"));
  g_env.invulnerable = lfw::truthy(lfw::field_or(g_me, u"invulnerable"));
  g_env.toughness = lfw::to_number(lfw::field_or(g_me, u"toughness"));
  g_env.resting = lfw::to_number(lfw::field_or(g_me, u"resting"));
  g_env.ground_y = lfw::to_number(lfw::field_or(g_me, u"ground_y"));
  g_env.is_on_ground = lfw::truthy(lfw::field_or(g_me, u"is_on_ground"));
  g_env.name = lfw::field_or(g_me, u"name");
  g_env.data = lfw::field_or(g_me, u"data");
  g_env.holding = g_holding;
  g_env.catching = g_catching;
  const Value blockers = lfw::field_or(g_me, u"blockers");
  const lfw::Array* const bl = lfw::as_array(blockers);
  g_env.blockers_count = bl != nullptr ? static_cast<double>(bl->size()) : 0;
  g_env.bg_width = 0;
  g_env.bg_near = 0;
  g_env.bg_far = 0;
  for (const auto& kv : g_bg) {
    if (kv.first == u"width") g_env.bg_width = lfw::to_number(kv.second);
    else if (kv.first == u"near") g_env.bg_near = lfw::to_number(kv.second);
    else if (kv.first == u"far") g_env.bg_far = lfw::to_number(kv.second);
  }
  g_env.frame = lfw::field_or(g_me, u"frame");
  g_env.frame_state = lfw::to_number(lfw::field_or(g_env.frame, u"state"));
  g_env.mt = g_mt.get();
}

void bind_env() {
  sync_env();
  g_env.bot_difficulty = [] { return bot_difficulty(); };
  g_env.get_bound = [] { return g_bound; };
  g_env.has_players_alive = [] { return g_hpa; };
  g_env.stage_value = [](const std::u16string& key) { return stage_value(key); };
  g_env.find_bot = [](const std::u16string& bot_id) {
    for (const auto& kv : g_datas) {
      if (kv.first == bot_id) return kv.second;
    }
    return Value();
  };
  g_env.entity_val = [](const std::u16string& word, lfw::BinOp) -> Value {
    // 台面按「实体表里用到的词」仿一个（真表在 `Entity` 那边，台面没有实体）：
    if (word == u"hp") return lfw::field_or(g_me, u"hp");
    if (word == u"x") return lfw::field_or(lfw::field_or(g_me, u"position"), u"x");
    if (word == u"y") return lfw::field_or(lfw::field_or(g_me, u"position"), u"y");
    if (word == u"z") return lfw::field_or(lfw::field_or(g_me, u"position"), u"z");
    if (word == u"vx") return lfw::field_or(lfw::field_or(g_me, u"velocity"), u"x");
    if (word == u"vy") return lfw::field_or(lfw::field_or(g_me, u"velocity"), u"y");
    if (word == u"vz") return lfw::field_or(lfw::field_or(g_me, u"velocity"), u"z");
    return Value(word);
  };
  g_env.set_position = [](const Value& x, const Value& y, const Value& z) {
    g_log.push_back("set_position:" + render(x) + "," + render(y) + "," + render(z));
  };
  g_env.get_next_frame = [](const Value& nf) -> Value {
    g_log.push_back("gnf:" + to_ascii(lfw::to_string(nf)));
    return Value();
  };
}

std::string behavior_text(lfw::bot::BotBehavior b) {
  return render(Value(std::u16string(lfw::bot::bot_behavior_name(b))));
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_bot <case-file>\n");
    return 2;
  }
  g_mt = std::make_unique<lfw::MersenneTwister>(0.0);
  {
    lfw::Object base;
    lfw::Object data;
    data.set(u"base", Value(std::make_shared<lfw::Object>(base)));
    lfw::Object frame;
    frame.set(u"state", Value(0.0));
    lfw::Object pos;
    pos.set(u"x", Value(0.0));
    pos.set(u"y", Value(0.0));
    pos.set(u"z", Value(0.0));
    lfw::Object vel;
    vel.set(u"x", Value(0.0));
    vel.set(u"y", Value(0.0));
    vel.set(u"z", Value(0.0));
    lfw::Object root;
    root.set(u"data", Value(std::make_shared<lfw::Object>(data)));
    root.set(u"frame", Value(std::make_shared<lfw::Object>(frame)));
    root.set(u"blockers", Value(std::make_shared<lfw::Array>()));
    root.set(u"position", Value(std::make_shared<lfw::Object>(pos)));
    root.set(u"velocity", Value(std::make_shared<lfw::Object>(vel)));
    g_me = Value(std::make_shared<lfw::Object>(root));
  }
  g_me_ent = std::make_unique<fx::ScriptedEntity>(u"me", g_me);
  bind_env();

  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "cannot open case file: %s\n", argv[1]);
    return 2;
  }

  std::string raw;
  int lineno = 0;
  while (std::getline(in, raw)) {
    ++lineno;
    const std::vector<std::string> t = split_ws(trace::strip_comment(raw));
    if (t.empty()) continue;
    const std::string line = opline(t);
    const std::string& op = t[0];
    std::size_t i = 1;

    if (op == "mtseed") {
      const Value seed = parse_value(t, i);
      g_mt->reset(lfw::to_number(seed));
      emit(line + " ||  | times=" + num(static_cast<double>(g_mt->times())));
    } else if (op == "mtdebug") {
      const Value v = parse_value(t, i);
      g_mt->debugging = lfw::truthy(v);
      emit(line + " ||  | mark=" + render(Value(g_mt->mark)));
    } else if (op == "mtmark") {
      emit(line + " ||  | mark=" + render(Value(g_mt->mark)));
    } else if (op == "mtcases") {
      const std::u16string text = lfw::mt_cases().submit();
      emit(line + " ||  | text=" + render(Value(text)) + " n=" +
           num(static_cast<double>(lfw::mt_cases().cases().size())));
    } else if (op == "me") {
      const std::string& sub = t[i++];
      const std::vector<std::string> segs = [&] {
        std::vector<std::string> out;
        std::string cur;
        for (const char c : sub) {
          if (c == '.') {
            out.push_back(cur);
            cur.clear();
          } else {
            cur.push_back(c);
          }
        }
        out.push_back(cur);
        return out;
      }();
      const Value v = parse_value(t, i);
      set_path(g_me, segs, 0, v);
      norm_ref(g_me);
      if (g_me_ent) g_me_ent->resync();
      emit(line + " ||  | v=" + render(v));
    } else if (op == "meref") {
      const std::string& sub = t[i++];
      const std::u16string name = trace::parse_js_string_literal(t[i++]);
      const std::vector<std::string> segs = [&] {
        std::vector<std::string> out;
        std::string cur;
        for (const char c : sub) {
          if (c == '.') {
            out.push_back(cur);
            cur.clear();
          } else {
            cur.push_back(c);
          }
        }
        out.push_back(cur);
        return out;
      }();
      set_path(g_me, segs, 0, fx_arg(name, lineno));
      // `holding` / `catching` 在端口是**实体指针**（`CtrlEnv` 的槽位），记下名字到 `sync_env` 里解。
      if (segs.size() == 1 && segs[0] == "holding") g_holding = fx_ent(name, lineno);
      if (segs.size() == 1 && segs[0] == "catching") g_catching = fx_ent(name, lineno);
      if (g_me_ent) g_me_ent->resync();
      emit(line + " ||  | v=" + name_of(fx_arg(name, lineno)));
    } else if (op == "fx") {
      const std::string& sub = t[i++];
      const std::u16string name = trace::parse_js_string_literal(t[i++]);
      if (sub == "put") {
        Value v = parse_value(t, i);
        norm_ref(v);
        bool replaced = false;
        for (auto& kv : g_fx) {
          if (kv.first == name) {
            kv.second = v;
            replaced = true;
            break;
          }
        }
        if (!replaced) g_fx.push_back(std::make_pair(name, v));
        // 快照换了 ⇒ 真实体重建（旧的不释放，目标表里可能还留着它的指针）。
        for (std::size_t k = 0; k < g_fx_ent.size(); ++k) {
          if (g_fx_ent[k].first == name) {
            g_fx_grave.push_back(std::move(g_fx_ent[k].second));
            g_fx_ent.erase(g_fx_ent.begin() + static_cast<std::ptrdiff_t>(k));
            break;
          }
        }
        emit(line + " ||  | v=" + render(v));
      } else {
        for (std::size_t k = 0; k < g_fx.size(); ++k) {
          if (g_fx[k].first == name) {
            g_fx.erase(g_fx.begin() + static_cast<std::ptrdiff_t>(k));
            break;
          }
        }
        for (std::size_t k = 0; k < g_fx_ent.size(); ++k) {
          if (g_fx_ent[k].first == name) {
            g_fx_grave.push_back(std::move(g_fx_ent[k].second));
            g_fx_ent.erase(g_fx_ent.begin() + static_cast<std::ptrdiff_t>(k));
            break;
          }
        }
        emit(line + " ||  | v=u");
      }
    } else if (op == "stage") {
      const std::u16string key = trace::parse_js_string_literal(t[i++]);
      const Value v = parse_value(t, i);
      bool replaced = false;
      for (auto& kv : g_stage) {
        if (kv.first == key) {
          kv.second = v;
          replaced = true;
          break;
        }
      }
      if (!replaced) g_stage.push_back(std::make_pair(key, v));
      emit(line + " ||  | v=" + render(v));
    } else if (op == "bg") {
      const std::u16string key = trace::parse_js_string_literal(t[i++]);
      const Value v = parse_value(t, i);
      bool replaced = false;
      for (auto& kv : g_bg) {
        if (kv.first == key) {
          kv.second = v;
          replaced = true;
          break;
        }
      }
      if (!replaced) g_bg.push_back(std::make_pair(key, v));
      emit(line + " ||  | v=" + render(v));
    } else if (op == "diff") {
      g_diff = parse_value(t, i);
      emit(line + " ||  | v=" + render(g_diff));
    } else if (op == "bound") {
      g_bound.clear();
      while (i < t.size()) g_bound.push_back(lfw::to_number(parse_value(t, i)));
      std::string s = "[";
      for (std::size_t k = 0; k < g_bound.size(); ++k) {
        if (k != 0) s += ",";
        s += num(g_bound[k]);
      }
      s += "]";
      emit(line + " ||  | v=" + s);
    } else if (op == "hpa") {
      g_hpa = trace::to_flag(t[i++]);
      emit(line + " ||  | v=" + render(Value(g_hpa)));
    } else if (op == "pup") {
      const std::string& sub = t[i++];
      if (sub == "add") {
        g_pups.push_back(trace::parse_js_string_literal(t[i++]));
      } else {
        g_pups.clear();
      }
      std::string s = "[";
      for (std::size_t k = 0; k < g_pups.size(); ++k) {
        if (k != 0) s += ",";
        s += to_ascii(g_pups[k]);
      }
      s += "]";
      emit(line + " ||  | v=" + s);
    } else if (op == "datas") {
      const std::string& sub = t[i++];
      const std::u16string id = trace::parse_js_string_literal(t[i++]);
      if (sub == "put") {
        const Value v = parse_value(t, i);
        bool replaced = false;
        for (auto& kv : g_datas) {
          if (kv.first == id) {
            kv.second = v;
            replaced = true;
            break;
          }
        }
        if (!replaced) g_datas.push_back(std::make_pair(id, v));
        emit(line + " ||  | v=" + render(v));
      } else {
        for (std::size_t k = 0; k < g_datas.size(); ++k) {
          if (g_datas[k].first == id) {
            g_datas.erase(g_datas.begin() + static_cast<std::ptrdiff_t>(k));
            break;
          }
        }
        emit(line + " ||  | v=u");
      }
    } else if (op == "make") {
      g_ctrl = std::make_unique<lfw::bot::BotController>();
      bind_env();
      g_ctrl->set_env(&g_env);
      g_ctrl->result.set_resolver(g_env.get_next_frame);
      emit(line + " ||  | state=" + render(g_ctrl->bot_state()) + " mark=" +
                      render(Value(g_mt->mark)) + " idle_x=" + num(g_ctrl->idle_min_x) + "," +
                      num(g_ctrl->idle_max_x) + " idle_z=" + num(g_ctrl->idle_min_z) + "," +
                      num(g_ctrl->idle_max_z));
    } else if (op == "ntclear") {
      const std::string& which = t[i++];
      lfw::bot::NearestTargets* nt = which == "ch" ? &g_ctrl->chasings
                                      : which == "av" ? &g_ctrl->avoidings
                                                      : &g_ctrl->defends;
      nt->clear();
      emit(line + " ||  | " + sets_text());
    } else if (op == "ntlook") {
      const std::string& which = t[i++];
      lfw::bot::NearestTargets* nt = which == "ch" ? &g_ctrl->chasings
                                      : which == "av" ? &g_ctrl->avoidings
                                                      : &g_ctrl->defends;
      const std::u16string name = trace::parse_js_string_literal(t[i++]);
      sync_env();
      nt->look(*g_me_ent, *fx_ent(name, lineno));
      emit(line + " ||  | " + sets_text());
    } else if (op == "ntdel") {
      const std::string& which = t[i++];
      lfw::bot::NearestTargets* nt = which == "ch" ? &g_ctrl->chasings
                                      : which == "av" ? &g_ctrl->avoidings
                                                      : &g_ctrl->defends;
      const std::u16string name = trace::parse_js_string_literal(t[i++]);
      const lfw::Entity* const target = find_ent_by_name(name);
      nt->del([target](const lfw::Entity& b) { return &b == target; });
      emit(line + " ||  | " + sets_text());
    } else if (op == "ntsnap") {
      const std::string& which = t[i++];
      const lfw::bot::NearestTargets* nt = which == "ch" ? &g_ctrl->chasings
                                          : which == "av" ? &g_ctrl->avoidings
                                                          : &g_ctrl->defends;
      emit(line + " ||  | " + sets_text() + " ents=" + [&] {
        std::string s = "[";
        for (std::size_t k = 0; k < nt->targets().size(); ++k) {
          if (k != 0) s += ",";
          s += name_of_ent(nt->targets()[k]);
        }
        return s + "]";
      }());
    } else if (op == "lookup") {
      const std::u16string name = trace::parse_js_string_literal(t[i++]);
      sync_env();
      g_ctrl->lookup(*fx_ent(name, lineno));
      emit(line + " || " + join_log() + " | " + sets_text());
    } else if (op == "should_chase") {
      const std::u16string name = trace::parse_js_string_literal(t[i++]);
      sync_env();
      emit(line + " || " + join_log() + " | v=" +
           render(Value(g_ctrl->should_chase(*fx_ent(name, lineno)))));
    } else if (op == "should_avoid") {
      const std::u16string name = trace::parse_js_string_literal(t[i++]);
      sync_env();
      emit(line + " || " + join_log() + " | v=" +
           render(Value(g_ctrl->should_avoid(*fx_ent(name, lineno)))));
    } else if (op == "should_defend") {
      const std::u16string name = trace::parse_js_string_literal(t[i++]);
      sync_env();
      emit(line + " || " + join_log() + " | v=" +
                      render(Value(static_cast<double>(g_ctrl->should_defend(*fx_ent(name, lineno))))));
    } else if (op == "desire" || op == "adesire") {
      const std::u16string mark = trace::parse_js_string_literal(t[i++]);
      const double v = op == "desire" ? g_ctrl->desire(mark) : g_ctrl->action_desire(mark);
      emit(line + " || " + join_log() + " | v=" + num(v));
    } else if (op == "guess") {
      const std::u16string name = trace::parse_js_string_literal(t[i++]);
      sync_env();
      emit(line + " || " + join_log() + " | v=" + render(g_ctrl->guess_entity_pos(fx_arg(name, lineno))));
    } else if (op == "wtf" || op == "wtc" || op == "backoff" || op == "cornered") {
      const std::u16string name = trace::parse_js_string_literal(t[i++]);
      sync_env();
      const bool v = op == "wtf" ? g_ctrl->w_atk_too_far(fx_arg(name, lineno))
                    : op == "wtc" ? g_ctrl->w_atk_too_close(fx_arg(name, lineno))
                    : op == "backoff" ? g_ctrl->can_back_off(fx_arg(name, lineno))
                                      : g_ctrl->cornered(fx_arg(name, lineno));
      emit(line + " || " + join_log() + " | v=" + render(Value(v)));
    } else if (op == "srun") {
      const std::u16string where = trace::parse_js_string_literal(t[i++]);
      const std::u16string name = trace::parse_js_string_literal(t[i++]);
      sync_env();
      const double v = g_ctrl->should_run(where, fx_arg(name, lineno));
      emit(line + " || " + join_log() + " | v=" + render(Value(v)));
    } else if (op == "enter_goto" || op == "leave_goto" || op == "leave_chase" ||
               op == "enter_avoid" || op == "leave_avoid") {
      const std::u16string name = trace::parse_js_string_literal(t[i++]);
      sync_env();
      const Value target = fx_arg(name, lineno);
      const bool v = op == "enter_goto" ? g_ctrl->is_enter_goto_range(target)
                    : op == "leave_goto" ? g_ctrl->is_leave_goto_range(target)
                    : op == "leave_chase" ? g_ctrl->is_leave_chase_range(target)
                    : op == "enter_avoid" ? g_ctrl->is_enter_avoid_zone(target)
                                          : g_ctrl->is_leave_avoid_zone(target);
      emit(line + " || " + join_log() + " | v=" + render(Value(v)));
    } else if (op == "selfref") {
      // `self_ref_of_env` 的**形状**钉子：拿不到真实体（`CtrlEnv::self == nullptr`）时它是
      // `bot/*` 引用读法的兜底，`{ id, position }` 两样缺一不可（见 `bot_env.h`）。
      sync_env();
      const Value ref = lfw::bot::self_ref_of_env(g_env);
      std::vector<Value> v;
      v.push_back(lfw::field_or(ref, u"id"));
      v.push_back(lfw::field_or(ref, u"position"));
      emit(line + " || " + join_log() + " | v=" +
           render(Value(std::make_shared<lfw::Array>(std::move(v)))));
    } else if (op == "act") {
      const std::u16string where = trace::parse_js_string_literal(t[i++]);
      const Value action = parse_value(t, i);
      sync_env();
      emit(line + " || " + join_log() + " | v=" + render(g_ctrl->handle_action(where, action)));
    } else if (op == "checkbot") {
      sync_env();
      g_ctrl->check_bot();
      emit(line + " || " + join_log() + " | bot_id=" + render(g_ctrl->bot_id) + " bot=" +
                      render(Value(lfw::truthy(g_ctrl->bot))));
    } else if (op == "dummy") {
      const Value id = parse_value(t, i);
      g_ctrl->set_dummy(id);
      lfw::bot::dummy_update(g_ctrl->dummy_value(), *g_ctrl);
      emit(line + " || " + join_log() + " | dummy=" + render(g_ctrl->dummy_value()) +
                      " mark=" + render(Value(g_mt->mark)));
    } else if (op == "ds") {
      std::string s;
      while (i < t.size()) {
        const std::u16string key = trace::parse_js_string_literal(t[i++]);
        if (!s.empty()) s += " ";
        s += to_ascii(key) + "=" + render(Value(g_ctrl->dataset.num(key)));
      }
      emit(line + " || " + join_log() + " | " + s);
    } else if (op == "fsmreset") {
      const Value key = parse_value(t, i);
      sync_env();
      g_ctrl->fsm.reset(key);
      emit(line + " || " + join_log() + " | state=" + render(g_ctrl->bot_state()));
    } else if (op == "fsmupdate") {
      const double dt = trace::to_double(t[i++]);
      sync_env();
      g_ctrl->fsm.update(dt);
      emit(line + " || " + join_log() + " | state=" + render(g_ctrl->bot_state()) +
                      " mark=" + render(Value(g_mt->mark)));
    } else if (op == "update") {
      sync_env();
      g_ctrl->update();
      emit(line + " || " + join_log() + " | state=" + render(g_ctrl->bot_state()) +
                      " mark=" + render(Value(g_mt->mark)) + " " + sets_text() + " res.time=" +
                      num(g_ctrl->result.time()) + " res.kind=" +
                      render(Value(g_ctrl->result.kind())) + " res.v=" +
                      render(g_ctrl->result.result()));
    } else if (op == "updlookup") {
      const int me_idx = static_cast<int>(trace::to_long(t[i++]));
      std::vector<lfw::Entity*> entities;
      while (i < t.size()) {
        entities.push_back(fx_ent(trace::parse_js_string_literal(t[i++]), lineno));
      }
      sync_env();
      g_ctrl->update_lookup(me_idx, entities);
      emit(line + " || " + join_log() + " | " + sets_text());
    } else if (op == "val") {
      const std::u16string word = lfw::to_string(parse_value(t, i));
      const lfw::ValGetter<lfw::bot::BotController> g = lfw::loader::get_val_from_bot_ctrl(word);
      sync_env();
      const Value v = g != nullptr ? g(*g_ctrl, word, lfw::BinOp::kEqual) : Value();
      emit(line + " || " + join_log() + " | v=" + render(v));
    } else if (op == "lockstand") {
      sync_env();
      const bool v = g_ctrl->lock_when_stand_and_rest();
      emit(line + " || " + join_log() + " | v=" + render(Value(v)));
    } else if (op == "follow") {
      const std::u16string name = trace::parse_js_string_literal(t[i++]);
      sync_env();
      g_ctrl->follow(*fx_ent(name, lineno));
      emit(line + " ||  | following=" + name_of_ent(g_ctrl->following) + " goingto=" +
                      render(g_ctrl->goingto) + " behavior=" + behavior_text(g_ctrl->behavior));
    } else if (op == "move") {
      g_ctrl->move();
      emit(line + " ||  | following=" + name_of_ent(g_ctrl->following) + " goingto=" +
                      render(g_ctrl->goingto) + " behavior=" + behavior_text(g_ctrl->behavior));
    } else if (op == "stay") {
      sync_env();
      g_ctrl->stay();
      emit(line + " ||  | following=" + name_of_ent(g_ctrl->following) + " goingto=" +
                      render(g_ctrl->goingto) + " behavior=" + behavior_text(g_ctrl->behavior));
    } else if (op == "come") {
      const double x = trace::to_double(t[i++]);
      const double y = trace::to_double(t[i++]);
      const double z = trace::to_double(t[i++]);
      g_ctrl->come(x, y, z);
      emit(line + " ||  | following=" + name_of_ent(g_ctrl->following) + " goingto=" +
                      render(g_ctrl->goingto) + " behavior=" + behavior_text(g_ctrl->behavior));
    } else if (op == "get") {
      const std::string& field = t[i++];
      sync_env();
      std::string payload;
      if (field == "difficulty") {
        payload = num(g_ctrl->difficulty());
      } else if (field == "facing") {
        payload = num(g_ctrl->facing());
      } else if (field == "team") {
        payload = render(Value(g_ctrl->team()));
      } else if (field == "en") {
        payload = name_of_ent(g_ctrl->chasings.get());
      } else if (field == "av") {
        payload = name_of_ent(g_ctrl->avoidings.get());
      } else if (field == "bot_state") {
        payload = render(g_ctrl->bot_state());
      } else if (field == "atk_f_x") {
        payload = num(g_ctrl->atk_f_x());
      } else if (field == "atk_b_x") {
        payload = num(g_ctrl->atk_b_x());
      } else if (field == "w_atk_f_x") {
        payload = num(g_ctrl->w_atk_f_x());
      } else if (field == "w_atk_b_x") {
        payload = num(g_ctrl->w_atk_b_x());
      } else if (field == "r_atk_x") {
        payload = num(g_ctrl->r_atk_x());
      } else if (field == "d_atk_max_x") {
        payload = num(g_ctrl->d_atk_max_x());
      } else if (field == "d_atk_min_x") {
        payload = num(g_ctrl->d_atk_min_x());
      } else if (field == "j_atk_x") {
        payload = num(g_ctrl->j_atk_x());
      } else if (field == "w_atk_m_x") {
        payload = num(g_ctrl->w_atk_m_x());
      } else if (field == "w_atk_r_x") {
        payload = num(g_ctrl->w_atk_r_x());
      } else if (field == "defend_desire") {
        payload = num(g_ctrl->defend_desire());
      } else if (field == "en_out_of_range") {
        payload = render(Value(g_ctrl->en_out_of_range));
      } else if (field == "idle_min_x") {
        payload = num(g_ctrl->idle_min_x);
      } else if (field == "idle_max_x") {
        payload = num(g_ctrl->idle_max_x);
      } else if (field == "idle_min_z") {
        payload = num(g_ctrl->idle_min_z);
      } else if (field == "idle_max_z") {
        payload = num(g_ctrl->idle_max_z);
      } else if (field == "dummy") {
        payload = render(g_ctrl->dummy_value());
      } else if (field == "behavior") {
        payload = behavior_text(g_ctrl->behavior);
      } else if (field == "goingto") {
        payload = render(g_ctrl->goingto);
      } else if (field == "following") {
        payload = name_of_ent(g_ctrl->following);
      } else if (field == "watching") {
        payload = name_of_ent(g_ctrl->watching);
      } else if (field == "bot_frame") {
        payload = render(g_ctrl->bot_frame);
      } else if (field == "bot_id") {
        payload = render(g_ctrl->bot_id);
      } else if (field == "stage_player_l") {
        payload = num(g_ctrl->stage_player_l());
      } else if (field == "stage_player_r") {
        payload = num(g_ctrl->stage_player_r());
      } else if (field == "stage_near") {
        payload = num(g_ctrl->stage_near());
      } else if (field == "stage_far") {
        payload = num(g_ctrl->stage_far());
      } else if (field == "stage_finish") {
        payload = render(Value(g_ctrl->stage_is_stage_finish()));
      } else if (field == "chapter_finish") {
        payload = render(Value(g_ctrl->stage_is_chapter_finish()));
      } else if (field == "hpa") {
        payload = render(Value(g_ctrl->has_players_alive()));
      } else if (field == "bound") {
        std::string s = "[";
        const std::vector<double> b = g_ctrl->get_bound();
        for (std::size_t k = 0; k < b.size(); ++k) {
          if (k != 0) s += ",";
          s += num(b[k]);
        }
        payload = s + "]";
      } else {
        std::fprintf(stderr, "unknown get field '%s' at line %d\n", field.c_str(), lineno);
        return 2;
      }
      emit(line + " || " + join_log() + " | v=" + payload);
    } else {
      std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
      return 2;
    }
  }
  return 0;
}
