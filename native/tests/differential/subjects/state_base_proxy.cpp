#include <cstdio>
#include <fstream>
#include <limits>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"
#include "lfw/state/spawn_ice_piece.h"
#include "lfw/state/state_base_proxy.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Array;
using lfw::Object;
using lfw::Value;
using lfw::buff::Buff;
using lfw::state::State_Base;
using lfw::state::State_15;
using lfw::state::State_Frozen;
using lfw::state::StateBase_Proxy;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;

std::vector<std::string> g_log;

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

struct FakeEnt;
FakeEnt* g_ent = nullptr;

// 台面自己的世界（自带假 `lfw`，见下面的定义）。
// 名字不能叫 `world`：`lfw::Entity` 自己有 `world()` 成员，在派生类的构造初始化列表里
// 写裸 `world()` 会解析到那个成员（同 `entity_fixture.h` 里 `shared_world` 那条注释）。
fx::TestWorld& test_world();

// 切片 4CJ 后 `Entity` 手里是真 `lfw::World` ⇒ 这一刀剩两条观测点各有新家：
//   * `Entity::world_dataset(x)` 已是 `virtual`，台面假实体直接覆写它（TS 的
//     `this.world.dataset` 也是实体面读）；
//   * `Entity::apply_opoints(opoints)` 非虚，但它逐个 `spawn`，第一个 `spawn` 就问
//     `lfw.datas.find(oid)` ⇒ 台面在假 `lfw` 上接住这次读（`g_lfw.datas_find`），
//     记「状态交下一批 opoint」那行。

// 切片 4CF：状态族窄接口退役 ⇒ 假实体派生真 `lfw::Entity`。形状与 TS 台面一致：`data` getter
// 把 `_data` 摊开再盖上 `indexes` / `frames`，库读的几条（`hp` / `data_frames` / `state` …）
// 走 override，`env` 面直接写镜像（不产生日志，与 TS 的 `walkSide` 口径相同）。
struct FakeEnt : lfw::Entity {
  Value _data;
  Value _indexes;
  Value _frames;
  Value _onlanding;
  Value _wdata;
  Value _state;
  Value _hbtype;
  bool _catcher = false;
  double _hp = 50;
  // TS 台面的假件没有 `velocity` / `facing` 后备字段之外的实体面 ⇒ 这里用 `NaN` 承载
  // 「TS 那边读到 `undefined`」的两处（`velocity.x` / `facing` 都进 `to_number`）。
  Value _vx;
  Value _vz;
  mutable Value _data_cache;

  explicit FakeEnt(std::u16string id) : lfw::Entity(test_world(), Value()) {
    this->id = std::move(id);
    this->facing = std::numeric_limits<double>::quiet_NaN();
  }

  // `this.world.dataset`（TS 台面在 Proxy 的 get 上打日志）：切片 4CJ 后 `Entity::world_dataset`
  // 是 `virtual` ⇒ 台面每实例覆写它。
  Value world_dataset(const std::u16string& key) const override {
    g_log.push_back(s_of(id) + ":world_dataset:" + s_of(key));
    return lfw::field_or(_wdata, key.c_str());
  }

  const Value& data() const override {
    Object merged;
    const Object* d = lfw::as_object(_data);
    if (d != nullptr) {
      const std::vector<std::u16string> keys = d->keys();
      for (size_t i = 0; i < keys.size(); ++i) {
        const Value* v = d->get(keys[i]);
        if (v != nullptr) merged.set(keys[i], *v);
      }
    }
    merged.set(u"indexes", _indexes);
    merged.set(u"frames", _frames);
    _data_cache = Value(std::make_shared<Object>(std::move(merged)));
    return _data_cache;
  }
  Value state() const override { return _state; }
  double hp() const override { return _hp; }
  void set_hp(double v) override { _hp = v; }
  bool has_catcher() const override { return _catcher; }
  void catcher_drop_catching() override {
    g_log.push_back(s_of(id) + ":catcher_drop_catching");
  }
  Value holding_base_type() const override { return _hbtype; }
  Value frame_on_landing() const override { return _onlanding; }
  Value data_frames() const override { return _frames; }
  bool has_data_indexes() const override { return lfw::truthy(_indexes); }
  Value dataset(const std::u16string& key) const override {
    g_log.push_back(s_of(id) + ":dataset:" + s_of(key));
    return Value();
  }
  lfw::EnterFrameResult enter_frame(const Value& frame_value,
                                    bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(id) + ":enter_frame:" + render(frame_value));
    return lfw::EnterFrameResult::NotFound;
  }
  lfw::EnterFrameResult enter_frame_by_id(const Value& id_value,
                                          bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(id) + ":enter_frame_by_id:" + render(id_value));
    return lfw::EnterFrameResult::NotFound;
  }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(id) + ":set_velocity:" + render(x) + ":" + render(y) + ":" + render(z));
    _vx = x;
    _vz = z;
  }
  double velocity_x() const override { return lfw::to_number(_vx); }
  double velocity_z() const override { return lfw::to_number(_vz); }
  Entity& set_shaking(double v) override {
    g_log.push_back(s_of(id) + ":set_shaking:" + render(Value(v)));
    return *this;
  }
  Entity& set_motionless(double v) override {
    g_log.push_back(s_of(id) + ":set_motionless:" + render(Value(v)));
    return *this;
  }
  void play_sound(const Value& sounds) override {
    g_log.push_back(s_of(id) + ":play_sound:" + render(sounds));
  }
  void set_position(const Value& x, const Value& y, const Value& z) override {
    position.x = lfw::to_number(x);
    position.y = lfw::to_number(y);
    position.z = lfw::to_number(z);
  }
  void drop_holding() override { g_log.push_back(s_of(id) + ":drop_holding"); }
  void handle_ground_velocity_decay(double factor) override {
    (void)factor;
    g_log.push_back(s_of(id) + ":handle_ground_velocity_decay");
  }
};

// 假 `lfw`：只把 `datas.find` 换成「记一次 `apply_opoints`」。`play_sound` / `create_entity`
// 之类由实体面的覆写接住，不走这儿。
struct FakeLfw : fx::FakeLfw {
  Value datas_find(const Value& oid) override {
    (void)oid;
    if (g_ent == nullptr) return Value();
    // 这一幕里 `datas.find` 只有 `spawn` 一个调用者（`spawn` 只有 `apply_opoints` 一个），
    // 而 `apply_opoints` 首个 opoint 拿不到数据就把剩下的都收手 ⇒ 落一次。
    g_log.push_back(s_of(g_ent->id) + ":apply_opoints:" +
                    std::to_string(lfw::state::ice_piece_opoints().size()));
    return Value();
  }
};

FakeLfw g_lfw;

fx::TestWorld& test_world() {
  static fx::TestWorld w(g_lfw, fx::g_renderer, &fx::g_states);
  return w;
}

Value g_state;
Value g_velocity;
Value g_rid;
StateBase_Proxy* g_obj = nullptr;
std::u16string g_cls = u"proxy";

std::string state_text() {
  const FakeEnt& e = *g_ent;
  return "hp=" + num(e._hp) + " state=" + render(g_obj->state()) + " pos=[" + num(e.position.x) +
         ":" + num(e.position.y) + ":" + num(e.position.z) + "]";
}

void bind() {
  g_lfw.world_override = &test_world();
  // `State_Base::leave` 的 HealSelf 分支会 `grant_buff` ⇒ `world.buffs_get` miss 后走
  // `lfw.create_buff`；台面把这条路打成一行（TS 的 `lfw.factory.create_buff` 同款）。
  g_lfw.on_create_buff = [](const std::u16string& kind, const std::u16string& id) {
    g_log.push_back("create_buff:" + s_of(kind) + ":" + s_of(id));
    return static_cast<Buff*>(nullptr);
  };
}

std::u16string value_text(const Value& v) {
  const std::u16string* s = std::get_if<std::u16string>(&v);
  return s != nullptr ? *s : std::u16string();
}

std::string ret_line(const char* what, const Value& v, const std::vector<std::string>& log) {
  return "run " + std::string(what) + " || " + join(log) + " | r=" + render(v) + " | " +
         state_text();
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_state_base_proxy <case-file>\n");
    return 2;
  }
  bind();
  g_ent = new FakeEnt(u"E1");

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
    if (op == "env") {
      const std::string& sub = t[i++];
      if (sub == "cls") {
        g_cls = value_text(parse_value(t, i));
      } else if (sub == "state") {
        g_state = parse_value(t, i);
      } else if (sub == "data") {
        g_ent->_data = parse_value(t, i);
      } else if (sub == "indexes") {
        g_ent->_indexes = parse_value(t, i);
      } else if (sub == "frames") {
        g_ent->_frames = parse_value(t, i);
      } else if (sub == "onlanding") {
        g_ent->_onlanding = parse_value(t, i);
      } else if (sub == "wdata") {
        g_ent->_wdata = parse_value(t, i);
      } else if (sub == "vstate") {
        g_ent->_state = parse_value(t, i);
      } else if (sub == "hbtype") {
        g_ent->_hbtype = parse_value(t, i);
      } else if (sub == "catcher") {
        g_ent->_catcher = lfw::truthy(parse_value(t, i));
      } else if (sub == "onground") {
        g_ent->is_on_ground = lfw::truthy(parse_value(t, i));
      } else if (sub == "hp") {
        g_ent->_hp = trace::to_double(t[i++]);
      } else if (sub == "pos") {
        const Value v = parse_value(t, i);
        g_ent->position.x = lfw::to_number(lfw::field_or(v, u"x"));
        g_ent->position.y = lfw::to_number(lfw::field_or(v, u"y"));
        g_ent->position.z = lfw::to_number(lfw::field_or(v, u"z"));
      } else if (sub == "vx") {
        g_ent->_vx = parse_value(t, i);
      } else if (sub == "vz") {
        g_ent->_vz = parse_value(t, i);
      } else if (sub == "vel") {
        g_velocity = parse_value(t, i);
      } else if (sub == "rid") {
        g_rid = parse_value(t, i);
      } else if (sub == "rxyz") {
        const Value v = parse_value(t, i);
        g_ent->position.x = lfw::to_number(lfw::field_or(v, u"x"));
        g_ent->position.y = lfw::to_number(lfw::field_or(v, u"y"));
        g_ent->position.z = lfw::to_number(lfw::field_or(v, u"z"));
      } else {
        std::fprintf(stderr, "unknown env '%s' at line %d\n", sub.c_str(), lineno);
        return 2;
      }
      std::printf("env %s\n", sub.c_str());
      continue;
    }
    if (op == "run") {
      const std::string& what = t[i++];
      if (what == "make") {
        delete g_obj;
        if (g_cls == u"15") {
          g_obj = new State_15();
        } else if (g_cls == u"frozen") {
          g_obj = new State_Frozen(g_state);
        } else {
          g_obj = new StateBase_Proxy(g_state);
        }
        std::printf("run make || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "default") {
        delete g_obj;
        g_obj = new State_Frozen();
        std::printf("run default || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "update") {
        g_obj->update(*g_ent);
        std::printf("run update || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "leave") {
        g_obj->leave(*g_ent, Value());
        std::printf("run leave || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "restrict") {
        g_obj->on_restrict(*g_ent, g_ent->position.x, g_ent->position.y, g_ent->position.z);
        std::printf("run restrict || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "preupdate") {
        if (g_obj->pre_update) g_obj->pre_update(*g_ent);
        std::printf("run preupdate || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "enter") {
        if (g_obj->enter) g_obj->enter(*g_ent, Value());
        std::printf("run enter || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "dead") {
        if (g_obj->on_dead) g_obj->on_dead(*g_ent);
        std::printf("run dead || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "landing") {
        if (g_obj->on_landing) g_obj->on_landing(*g_ent, g_velocity);
        std::printf("run landing || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "leaveground") {
        if (g_obj->on_leave_ground) g_obj->on_leave_ground(*g_ent);
        std::printf("run leaveground || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "gravity") {
        const Value v = g_obj->get_gravity ? g_obj->get_gravity(*g_ent) : Value();
        std::printf("%s\n", ret_line("gravity", v, g_log).c_str());
      } else if (what == "auto") {
        const Value v = g_obj->get_auto_frame ? g_obj->get_auto_frame(*g_ent) : Value();
        std::printf("%s\n", ret_line("auto", v, g_log).c_str());
      } else if (what == "sdf") {
        const Value v =
            g_obj->get_sudden_death_frame ? g_obj->get_sudden_death_frame(*g_ent) : Value();
        std::printf("%s\n", ret_line("sdf", v, g_log).c_str());
      } else if (what == "cef") {
        const Value v =
            g_obj->get_caught_end_frame ? g_obj->get_caught_end_frame(*g_ent) : Value();
        std::printf("%s\n", ret_line("cef", v, g_log).c_str());
      } else if (what == "ffbi") {
        const Value v =
            g_obj->find_frame_by_id ? g_obj->find_frame_by_id(*g_ent, g_rid) : Value();
        std::printf("%s\n", ret_line("ffbi", v, g_log).c_str());
      } else {
        std::fprintf(stderr, "unknown run '%s' at line %d\n", what.c_str(), lineno);
        return 2;
      }
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  delete g_obj;
  return 0;
}
