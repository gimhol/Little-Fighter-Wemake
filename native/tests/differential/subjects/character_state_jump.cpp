#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/state/character_state_jump.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Array;
using lfw::EnterFrameResult;
using lfw::Object;
using lfw::Value;
using lfw::buff::Buff;
using lfw::state::CharacterState_Jump;
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

std::u16string value_text(const Value& v) {
  const std::u16string* s = std::get_if<std::u16string>(&v);
  return s != nullptr ? *s : std::u16string();
}

// 切片 4CF：`state::IStateEntity` 退役 ⇒ 假实体改成**真 `lfw::Entity`**，只覆写虚成员；
// 库要读、但没有虚读面的那几条（位置 / `ground_y` 以外的面）在台面配置时顺带写进真字段
// （配置写入不产生日志，与 TS 侧直写 `f._x` 同款）。`data()` 返回引用 ⇒ 镜必须是成员。
struct FakeEnt : lfw::Entity {
  std::u16string _id;
  Value _gy;
  Value _jx;
  Value _jy;
  Value _jz;
  Value _jt;
  bool _bot = false;
  std::u16string _held;
  double _lr = 0;
  double _ud = 0;
  Value _jumpflag;
  Value _dvals;
  Value _onlanding;
  Value _landing1;
  Value _data;

  explicit FakeEnt(std::u16string id) : lfw::Entity(fx::shared_world(), Value()), _id(std::move(id)) {
    this->id = _id;
    rebuild_data();
  }

  // `world.dataset[key]`：TS 台面在 `get world()` 的 Proxy 上打这行日志，端口这面就是
  // `Entity::world_dataset`（切片 4CJ 起是 `virtual`）。
  Value world_dataset(const std::u16string& key) const override {
    g_log.push_back(s_of(_id) + ":world_dataset:" + s_of(key));
    return lfw::field_or(_dvals, key.c_str());
  }

  void rebuild_data() {
    Object indexes;
    indexes.set(u"landing_1", _landing1);
    Object d;
    d.set(u"indexes", Value(std::make_shared<Object>(indexes)));
    _data = Value(std::make_shared<Object>(d));
  }
  const Value& data() const override { return _data; }

  Value prev_frame_value() const {
    Object o;
    o.set(u"jump_flag", _jumpflag);
    return Value(std::make_shared<Object>(o));
  }
  // 状态面：`get_prev_frame()` / `update_velocity()` / `handle_ground_velocity_decay()` 都是虚的 ⇒
  // 覆写即可（`prev_frame` 的返回值也由覆写给，不再需要 `set_prev_frame` 兜底）。
  Value get_prev_frame() const override {
    g_log.push_back(s_of(_id) + ":prev_frame");
    return prev_frame_value();
  }
  void update_velocity(const Value& v) override {
    g_log.push_back(s_of(_id) + ":update_velocity:" + render(v));
  }
  void handle_ground_velocity_decay(double factor = 1) override {
    (void)factor;
    g_log.push_back(s_of(_id) + ":handle_ground_velocity_decay");
  }

  double ground_y() const override { return lfw::to_number(_gy); }
  bool ctrl_is_bot() const override { return _bot; }
  bool ctrl_is_end(const std::u16string& key) const override {
    g_log.push_back(s_of(_id) + ":ctrl_is_end:" + s_of(key));
    return _held.find(key[0]) == std::u16string::npos;
  }
  double ctrl_lr() const override { return _lr; }
  double ctrl_ud() const override { return _ud; }
  Value jumping_x() const override { return _jx; }
  void set_jumping_x(const Value& v) override { _jx = v; }
  Value jumping_y() const override { return _jy; }
  void set_jumping_y(const Value& v) override { _jy = v; }
  Value jumping_z() const override { return _jz; }
  void set_jumping_z(const Value& v) override { _jz = v; }
  Value jumping_t() const override { return _jt; }
  void set_jumping_t(const Value& v) override { _jt = v; }
  Value dataset(const std::u16string& key) const override {
    g_log.push_back(s_of(_id) + ":dataset:" + s_of(key));
    return lfw::field_or(_dvals, key.c_str());
  }
  Value frame_on_landing() const override { return _onlanding; }
  EnterFrameResult enter_frame(const Value& nf, bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(_id) + ":enter_frame:" + render(nf));
    return EnterFrameResult::Entered;
  }
  EnterFrameResult enter_frame_by_id(const Value& fid, bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(_id) + ":enter_frame_by_id:" + render(fid));
    return EnterFrameResult::Entered;
  }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(_id) + ":set_velocity:" + render(x) + ":" + render(y) + ":" +
                    render(z));
  }
};

FakeEnt* g_ent = nullptr;
Value g_state;
Value g_velocity;
CharacterState_Jump* g_obj = nullptr;

std::string state_text() {
  const FakeEnt& e = *g_ent;
  return "pos=[" + num(e.position.x) + ":" + num(e.position.y) + ":" + num(e.position.z) +
         "] gy=" + render(e._gy) + " jx=" + render(e._jx) + " jy=" + render(e._jy) +
         " jz=" + render(e._jz) + " jt=" + render(e._jt);
}

void bind() {
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_character_state_jump <case-file>\n");
    return 2;
  }
  bind();
  g_ent = new FakeEnt(u"E1");
  g_state = Value(0.0);

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
      if (sub == "state") {
        g_state = parse_value(t, i);
      } else if (sub == "pos") {
        const Value v = parse_value(t, i);
        g_ent->position.set(lfw::to_number(lfw::field_or(v, u"x")),
                            lfw::to_number(lfw::field_or(v, u"y")),
                            lfw::to_number(lfw::field_or(v, u"z")));
      } else if (sub == "gy") {
        g_ent->_gy = parse_value(t, i);
      } else if (sub == "jx") {
        g_ent->_jx = parse_value(t, i);
      } else if (sub == "jy") {
        g_ent->_jy = parse_value(t, i);
      } else if (sub == "jz") {
        g_ent->_jz = parse_value(t, i);
      } else if (sub == "jt") {
        g_ent->_jt = parse_value(t, i);
      } else if (sub == "bot") {
        g_ent->_bot = lfw::truthy(parse_value(t, i));
      } else if (sub == "held") {
        g_ent->_held = value_text(parse_value(t, i));
      } else if (sub == "lr") {
        g_ent->_lr = trace::to_double(t[i++]);
      } else if (sub == "ud") {
        g_ent->_ud = trace::to_double(t[i++]);
      } else if (sub == "jumpflag") {
        g_ent->_jumpflag = parse_value(t, i);
      } else if (sub == "dvals") {
        g_ent->_dvals = parse_value(t, i);
      } else if (sub == "onlanding") {
        g_ent->_onlanding = parse_value(t, i);
      } else if (sub == "landing1") {
        g_ent->_landing1 = parse_value(t, i);
        g_ent->rebuild_data();
      } else if (sub == "vel") {
        g_velocity = parse_value(t, i);
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
        g_obj = new CharacterState_Jump(g_state);
        std::printf("run make || %s | s=%s | %s\n", join(g_log).c_str(),
                    render(g_obj->state()).c_str(), state_text().c_str());
      } else if (what == "default") {
        delete g_obj;
        g_obj = new CharacterState_Jump();
        std::printf("run default || %s | s=%s | %s\n", join(g_log).c_str(),
                    render(g_obj->state()).c_str(), state_text().c_str());
      } else if (what == "enter") {
        if (g_obj->enter) g_obj->enter(*g_ent, Value());
        std::printf("run enter || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "update") {
        g_obj->update(*g_ent);
        std::printf("run update || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "landing") {
        if (g_obj->on_landing) g_obj->on_landing(*g_ent, g_velocity);
        std::printf("run landing || %s | %s\n", join(g_log).c_str(), state_text().c_str());
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
