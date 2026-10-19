#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/collision/action_handlers.h"
#include "lfw/controller/base_controller.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Value;
using lfw::collision::ActionEnv;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;

std::vector<std::string> g_log;
lfw::Value g_injury;
lfw::Value g_real_injury;

std::string render(const Value& v) { return to_ascii(render_value(v)); }
std::string s_of(const std::u16string& s) { return to_ascii(s); }
std::string num(double d) { return render(Value(d)); }

std::string join(const std::vector<std::string>& xs) {
  std::string out;
  for (size_t i = 0; i < xs.size(); ++i) {
    if (i) out += ",";
    out += xs[i];
  }
  return out;
}

std::string ids_of(const Value& v) {
  const lfw::Array* a = lfw::as_array(v);
  if (a == nullptr) return render(v);
  std::string out;
  for (size_t i = 0; i < a->size(); ++i) {
    if (i) out += ",";
    out += to_ascii(lfw::to_string(a->at(i)));
  }
  return out;
}

// 切片 4CE：碰撞族窄接口（`IActionEntity` 等）退役 ⇒ 台面假实体改成真 `lfw::Entity`
// 的派生，观测面随之从「窄接口虚函数」换成「实体面的虚函数」：TS 台面里带日志的
// `set hp` / `set hp_r` / `set mp` / `set facing` / `set team` / `set_velocity` /
// `set_invisible` / `set_motionless` / `set_invulnerable` 与 `play_sound` 在实体面上都是
// 虚的 ⇒ 覆写它们并推同样的文本；台面配置（`walk_side`）与 TS 一样直接改背后的「字段」，
// 因此同样不打日志。
//
// 这条用例曾经拦不到的几站，现在都有正当观测点：
//   * `enter_frame` / `set_fuse_bys` / `set_dismiss_data` / `set_dismiss_time` —— 实体面已加
//     `virtual` ⇒ 直接覆写；
//   * `transform` —— 仍非虚，但实体写完 `_data` 后会发 `on_data_changed`（TS 的
//     `Entity.transform` 同样发，见 `src/LFW/entity/Entity.ts`）⇒ 台面挂这条回调补日志；
//   * `set_prop` —— 映射（含 `team`）由实体面的白名单负责，台面只在被写到的虚 setter 上打
//     日志（与 TS 台面对 `entity[name] = value` 的观测同一落点）。
struct Fake;

// 台面全体（`bind()` 里填）：`find_entity` 的解析范围。
std::vector<Fake*> g_all;

// 实体面把 `set_fuse_bys` 的 id 解析交给世界（`world().find_entity`），台面因此要认得自己的
// 三个假实体（切片 4CJ 后这面挂在 `TestWorld::on_find_entity` 上，见 `bind`；缺省的真
// `World::find_entity` 只查自己的实体表 ⇒ 一个也找不着）。

struct Fake : lfw::Entity {
  // --- 台面配置面（与 TS 台面同名；直接写，不打日志）---------------------------------
  Value _data;
  bool bot = false;
  bool src_emitter_set = false;
  Value _src_emitter;
  bool emitter_set = false;
  Value _emitter;

  // --- 观测面（库写进来时的镜像；名字与 TS 台面一致）---------------------------------
  double _hp = 10;
  double _hp_r = 10;
  double _hp_max = 20;
  double _mp = 5;
  double _mp_max = 15;
  bool team_set = false;
  std::u16string _team;
  double _inv = 0;
  double _mot = 0;
  double _invul = 0;
  // `entity::is_bot_ctrl(this.ctrl())` 只看「控制器非空且 `is_bot()`」，而 `ctrl()` 不是
  // 虚的（`set_ctrl(nullptr)` 会被基类早退，挂上就摘不掉）⇒ 每个台面实体常驻一个替身
  // 控制器，`env a bot 0/1` 只翻它的标记（`is_bot()` 为假时与 TS 的 `ctrl: undefined` 同义）。
  lfw::controller::BaseController ctrl_stub;

  explicit Fake(std::u16string id_value) : Entity(fx::shared_world(), Value()) {
    this->id = std::move(id_value);
    velocity.x = 3;  // TS 台面 `_velocity = {x: 3, y: 0, z: 0}`
    facing = 1;
    ctrl_stub.set_kind(false, false);
    // `transform` 非虚，台面拦不到那次调用；实体在写完 `_data` 之后会发 `on_data_changed`
    // （TS 的 `Entity.transform` 也发同一条），载荷首项就是新数据 ⇒ 日志落点与 TS 台面一致。
    callbacks.on(u"on_data_changed", [this](const lfw::Callbacks::Payloads& p) {
      g_log.push_back(s_of(id) + ":transform:" + render(p.empty() ? Value() : p.at(0)));
    });
  }

  // --- 读面 -----------------------------------------------------------------------
  const Value& data() const override { return _data; }
  Value data_type() const override { return lfw::field_or(_data, u"type"); }
  double hp() const override { return _hp; }
  double hp_r() const override { return _hp_r; }
  double hp_max() const override { return _hp_max; }
  double mp() const override { return _mp; }
  double mp_max() const override { return _mp_max; }
  const std::u16string& team() const override { return _team; }

  // --- 写面（TS 台面的 setter 日志）--------------------------------------------------
  void set_hp(double v) override {
    _hp = v;
    g_log.push_back("set_hp:" + num(v));
  }
  void set_hp_r(double v) override {
    _hp_r = v;
    g_log.push_back("set_hp_r:" + num(v));
  }
  void set_mp(double v) override {
    _mp = v;
    g_log.push_back("set_mp:" + num(v));
  }
  // TS 台面的 `team` 允许 `undefined`（`V_TURN_TEAM` 的缺省分支），端口这一面是
  // `u16string` ⇒ 空串按「没设过」记，落回 `undefined` 的显示与 `is_ally` 读法。
  void set_team(std::u16string v) override {
    team_set = !v.empty();
    _team = v;
    g_log.push_back("set_team:" + (team_set ? render(Value(v)) : std::string("u")));
  }
  void set_facing(const Value& v) override {
    facing = lfw::to_number(v);
    g_log.push_back("set_facing:" + render(v));
  }
  void set_velocity_x(const Value& v) override {
    velocity.x = lfw::to_number(v);
    g_log.push_back("set_velocity:" + render(v));
  }
  void set_invisible(double v) override {
    _inv = v;
    g_log.push_back("set_invisible:" + num(v));
  }
  lfw::Entity& set_motionless(double v) override {
    _mot = v;
    g_log.push_back("set_motionless:" + num(v));
    return *this;
  }
  void set_invulnerable(double v) override {
    _invul = v;
    g_log.push_back("set_invulnerable:" + num(v));
  }

  void play_sound(const Value& sounds, const Value& pos) override {
    g_log.push_back(s_of(id) + ":play_sound:" + render(sounds) + ":" + render(pos_of(pos)));
  }

  // `play_sound(path)` 没给位置时 TS 台面用默认参数 `this.position`。
  Value pos_of(const Value& pos) const {
    if (!std::holds_alternative<std::monostate>(pos)) return pos;
    lfw::Object o;
    o.set(u"x", Value(position.x));
    o.set(u"y", Value(position.y));
    o.set(u"z", Value(position.z));
    return Value(std::make_shared<lfw::Object>(o));
  }

  // --- 4CE：实体面已加 `virtual` 的几条 -------------------------------------------------
  void set_dismiss_data(const Value& v) override {
    lfw::Entity::set_dismiss_data(v);
    g_log.push_back("set_dismiss_data:" + render(v));
  }
  void set_dismiss_time(const Value& v) override {
    lfw::Entity::set_dismiss_time(v);
    g_log.push_back("set_dismiss_time:" + render(v));
  }
  void set_fuse_bys(const Value& v) override {
    lfw::Entity::set_fuse_bys(v);
    g_log.push_back("set_fuse_bys:" + ids_of(v));
  }
  lfw::EnterFrameResult enter_frame(const Value& info, bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(id) + ":enter_frame:" + render(info));
    return lfw::EnterFrameResult::NotFound;
  }
};

Fake g_a(u"A");
Fake g_v(u"V");
Fake g_other(u"E2");

lfw::Entity* find_fixture_entity(const std::u16string& id) {
  for (Fake* const f : g_all) {
    if (f != nullptr && f->id == id) return f;
  }
  return nullptr;
}

ActionEnv g_env;
lfw::Value g_data_found;
bool g_has_data = false;
bool g_ally = false;
lfw::buff::Buff* g_granted = nullptr;

bool missing(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<lfw::NullTag>(v);
}

// `Entity::src_emitter()` / `emitter()`（非虚）读的是 `emitters` 的首/末项 ⇒ 用两个
// 「设过没有」的标记重建这个数组（TS 台面的这两个字段互相独立，只在两端可见：只设了
// `emitter` 时首末同项，本用例里读不到这一处）。
void sync_emitters(Fake& f) {
  f.emitters.clear();
  if (f.src_emitter_set) f.emitters.push_back(lfw::to_string(f._src_emitter));
  if (f.emitter_set) f.emitters.push_back(lfw::to_string(f._emitter));
}

void bind() {
  fx::shared_lfw().world_override = &fx::shared_world();
  g_all = {&g_a, &g_v, &g_other};
  // `world.find_entity(id)`：TS 台面上就是 `worldStub.entity_map.get(id)` 那一层。
  fx::shared_world().on_find_entity = [](const std::u16string& id) { return find_fixture_entity(id); };
  g_env.mt_int = []() { return 1.0; };
  g_env.mt_set_mark = [](const std::u16string& m) { g_log.push_back("mt_mark:" + s_of(m)); };
  g_env.find_data = [](const std::u16string& oid, Value& out) {
    g_log.push_back("find_data:" + s_of(oid));
    if (!g_has_data) return false;
    out = g_data_found;
    return true;
  };
  g_env.broadcast = [](const std::u16string& m) { g_log.push_back("broadcast:" + s_of(m)); };
  g_env.alert = [](const std::u16string& m) { g_log.push_back("alert:" + s_of(m)); };
  g_env.find_entity = [](const std::u16string& id) -> lfw::Entity* {
    g_log.push_back("find_entity:" + s_of(id));
    if (id == g_v.id) return &g_v;
    if (id == g_other.id) return &g_other;
    return nullptr;
  };
  g_env.is_ally = [](const lfw::Entity&, const lfw::Entity&) {
    g_log.push_back(std::string("is_ally:") + (g_ally ? "1" : "0"));
    return g_ally;
  };
  // Buff 面同样以真 `Entity` 为准入（4BY 起 `buff_entity()` 退役）⇒ 直接认台面自己。
  fx::shared_world().on_find_entity = [](const std::u16string& id) -> lfw::Entity* {
    if (id == g_a.id) return &g_a;
    if (id == g_v.id) return &g_v;
    return nullptr;
  };
  fx::shared_lfw().on_create_entity = [](const Value&) -> lfw::Entity* { return nullptr; };
  fx::shared_lfw().on_datas_find = [](const std::u16string&) -> Value { return Value(); };
  fx::shared_world().on_buffs_set = [](const std::u16string&, lfw::buff::Buff*) {};
  fx::shared_world().on_buffs_get = [](const std::u16string&) -> lfw::buff::Buff* { return nullptr; };
  fx::shared_lfw().on_create_buff = [](const std::u16string& kind, const std::u16string& id) {
    g_log.push_back("create_buff:" + s_of(kind) + ":" + s_of(id));
    g_granted = new lfw::buff::Buff(fx::shared_lfw(), id, Value(kind));
    return g_granted;
  };
}

std::string team_text(const Fake& f) {
  return f.team_set ? render(Value(f._team)) : std::string("u");
}

// `dismiss_data` / `dismiss_time` 由实体自己保存（`set_dismiss_data` / `set_dismiss_time`
// 在 4CE 之后是非虚的，但写入仍然落在实体字段上）⇒ 状态行直接读实体：端口把「没设过」
// 的 `dismiss_data` 初始化成 `null`（TS 台面是 `undefined`），那一个默认值按 `u` 印。
std::string dismiss_data_text(const Fake& f) {
  return missing(f.dismiss_data) ? std::string("u") : render(f.dismiss_data);
}

std::string dismiss_time_text(const Fake& f) {
  return f.dismiss_time.has_value() ? num(*f.dismiss_time) : std::string("z");
}

std::string state_text() {
  return "a.hp=" + num(g_a._hp) + " a.hp_r=" + num(g_a._hp_r) + " a.mp=" + num(g_a._mp) +
         " a.vel=" + render(Value(g_a.velocity.x)) + " a.face=" + render(Value(g_a.facing)) +
         " a.team=" + team_text(g_a) + " v.hp=" + num(g_v._hp) + " v.hp_r=" + num(g_v._hp_r) +
         " v.mp=" + num(g_v._mp) + " v.vel=" + render(Value(g_v.velocity.x)) + " v.face=" +
         render(Value(g_v.facing)) + " v.team=" + team_text(g_v) + " v.inv=" + num(g_v._inv) +
         "/" + num(g_v._mot) + "/" + num(g_v._invul) + " e2.hp=" + num(g_other._hp) +
         " e2.hp_r=" + num(g_other._hp_r) + " e2.mp=" + num(g_other._mp) + " a.fuse=" +
         ids_of(g_a.fuse_bys_of()) + " a.dismiss=" + dismiss_data_text(g_a) + " a.dtime=" +
         dismiss_time_text(g_a) + " a.bot=" + (g_a.bot ? "1" : "0") + " v.bot=" +
         (g_v.bot ? "1" : "0") + " v.fuse=" + ids_of(g_v.fuse_bys_of()) + " v.dismiss=" +
         dismiss_data_text(g_v) + " v.dtime=" + dismiss_time_text(g_v) + " buff=" +
         (g_granted == nullptr
              ? std::string("none")
              : (num(g_granted->lifetime()) + "/" + num(g_granted->duration()) + "/" +
                 num(g_granted->level())));
}

std::string flag_result(const Value& v) { return "ret=" + render(v); }

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_action_handlers <case-file>\n");
    return 2;
  }
  bind();

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
    const std::string& op = t[0];
    size_t i = 1;
    g_log.clear();
    g_granted = nullptr;
    if (op == "env") {
      const std::string& sub = t[i++];
      if (sub == "injury") {
        g_injury = parse_value(t, i);
      } else if (sub == "real_injury") {
        g_real_injury = parse_value(t, i);
      } else if (sub == "data_found") {
        g_data_found = parse_value(t, i);
        g_has_data = true;
      } else if (sub == "no_data") {
        g_has_data = false;
      } else if (sub == "ally") {
        g_ally = t[i++] == "1";
      } else if (sub == "mt_int") {
        const double mt = trace::to_double(t[i++]);
        g_env.mt_int = [mt]() { return mt; };
      } else if (sub == "a" || sub == "v" || sub == "e") {
        Fake& f = sub == "a" ? g_a : (sub == "v" ? g_v : g_other);
        const std::string& field = t[i++];
        if (field == "hp") {
          f._hp = lfw::to_number(parse_value(t, i));
        } else if (field == "hp_r") {
          f._hp_r = lfw::to_number(parse_value(t, i));
        } else if (field == "hp_max") {
          f._hp_max = lfw::to_number(parse_value(t, i));
        } else if (field == "mp") {
          f._mp = lfw::to_number(parse_value(t, i));
        } else if (field == "mp_max") {
          f._mp_max = lfw::to_number(parse_value(t, i));
        } else if (field == "vel") {
          f.velocity.x = lfw::to_number(parse_value(t, i));
        } else if (field == "face") {
          f.facing = lfw::to_number(parse_value(t, i));
        } else if (field == "team") {
          f._team = lfw::to_string(parse_value(t, i));
          f.team_set = !f._team.empty();
        } else if (field == "data") {
          f._data = parse_value(t, i);
        } else if (field == "bot") {
          f.bot = t[i++] == "1";
          f.ctrl_stub.set_kind(false, f.bot);
          if (f.bot) f.set_ctrl(&f.ctrl_stub);
        } else if (field == "src_emitter") {
          const Value v = parse_value(t, i);
          f.src_emitter_set = !missing(v);
          f._src_emitter = v;
          sync_emitters(f);
        } else if (field == "emitter") {
          const Value v = parse_value(t, i);
          f.emitter_set = !missing(v);
          f._emitter = v;
          sync_emitters(f);
        } else if (field == "fuse_bys") {
          // TS 台面直接写 `_fuse_bys`（不打日志）；端口里 `fuse_bys` 是实体数组 ⇒ 按 id
          // 解析（与库自己的写入同路）。
          static_cast<lfw::Entity&>(f).set_fuse_bys(parse_value(t, i));
        } else if (field == "bearer") {
          f.bearer = t[i++] == "1" ? &g_other : nullptr;
        } else {
          std::fprintf(stderr, "unknown entity field '%s' at line %d\n", field.c_str(), lineno);
          return 2;
        }
      } else {
        std::fprintf(stderr, "unknown env '%s' at line %d\n", sub.c_str(), lineno);
        return 2;
      }
      std::printf("env %s\n", sub.c_str());
      continue;
    }
    if (op == "act") {
      const std::u16string type = trace::parse_js_string_literal(t[i++]);
      const Value action = parse_value(t, i);
      const Value ret = lfw::collision::run_action(g_env, type, action, g_a, g_v, g_injury,
                                                   g_real_injury);
      std::printf("act %s %s || %s | %s\n", s_of(type).c_str(), flag_result(ret).c_str(),
                  join(g_log).c_str(), state_text().c_str());
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  return 0;
}
