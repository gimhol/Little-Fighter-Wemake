#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/state/character_state_falling.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Array;
using lfw::EnterFrameResult;
using lfw::Object;
using lfw::Value;
using lfw::buff::Buff;
using lfw::state::CharacterState_Falling;
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

// `fighter.set_velocity(...)` on a fused fighter is observed through the fighter
// object itself, so the log renders it the way the TS side renders its fighters.
std::string fighter_text(const Value& who) {
  Object o;
  o.set(u"key", Value(value_text(who)));
  return render(Value(std::make_shared<Object>(o)));
}

// 切片 4CF：`state::IStateEntity` 退役 ⇒ 假实体改成**真 `lfw::Entity`**，只覆写虚成员。
// 凡是库要读的字段，能走虚读面的（`hp` / `frame_on_landing` / `jumping_*` …）由覆写给镜像，
// 没有虚读面的（`data_id` / `frame_id` / `facing` / `wait` / `bounced` / `lying_*` …）在
// 台面配置时**顺带写进真字段**（配置写入本来就不产生日志，与 TS 侧直写 `f._x` 同款）。
//
// `data()` 返回 `const Value&` ⇒ 镜像必须是成员，配置改动后由 `rebuild_data()` 重搭。
struct FakeEnt : lfw::Entity {
  std::u16string _id;
  Value _dataid;
  Value _frameid;
  Value _onlanding;
  Value _idxbounce;
  Value _idxfalling;
  Value _idxcritical;
  Value _idxlying;
  Value _shaking;
  Value _wait;
  Value _hp;
  Value _bounced;
  bool _catcher = false;
  Value _fall;
  Value _fallmax;
  Value _defend;
  Value _defendmax;
  Value _rest;
  Value _restmax;
  Value _finj;
  Value _tinj;
  Value _dvals;
  Value _data;
  // `fuse_bys` / `fuse_bys_of` 读的是实体面那份 `std::vector<Entity*>` ⇒ 台面造真实体喂它。
  std::vector<std::unique_ptr<Entity>> _fuse_owned;
  std::vector<Entity*> _fuse;

  explicit FakeEnt(std::u16string id) : lfw::Entity(fx::shared_world(), Value()), _id(std::move(id)) {
    this->id = _id;
    rebuild_data();
    rebuild_frame();
  }

  // `world.dataset[key]`：TS 台面在 `get world()` 的 Proxy 上打这行日志，端口这面就是
  // `Entity::world_dataset`（切片 4CJ 起是 `virtual`）。
  Value world_dataset(const std::u16string& key) const override {
    g_log.push_back(s_of(_id) + ":world_dataset:" + s_of(key));
    return lfw::field_or(_dvals, key.c_str());
  }

  void rebuild_data() {
    Object indexes;
    indexes.set(u"bouncing", _idxbounce);
    indexes.set(u"falling", _idxfalling);
    indexes.set(u"critical_hit", _idxcritical);
    indexes.set(u"lying", _idxlying);
    Object d;
    d.set(u"id", _dataid);
    d.set(u"indexes", Value(std::make_shared<Object>(indexes)));
    _data = Value(std::make_shared<Object>(d));
  }
  const Value& data() const override { return _data; }

  // `frame` 是普通数据成员，`frame_id()` 与 `find_direction(e.frame, …)` 都读它。
  void rebuild_frame() {
    Object f;
    f.set(u"id", _frameid);
    f.set(u"on_landing", _onlanding);
    frame = Value(std::make_shared<Object>(f));
  }

  // 状态面那几条（`data_id` / `drop_holding` / `dismiss_fusion` / `handle_ground_velocity_decay`）
  // 现在都是虚的：`data_id` 用库里的新实现（读虚 `data()` ⇒ 拿上面的镜像即可），其余三条覆写。
  void drop_holding() override { g_log.push_back(s_of(_id) + ":drop_holding"); }
  void dismiss_fusion(const std::u16string& frame_id) override {
    g_log.push_back(s_of(_id) + ":dismiss_fusion:" + render(Value(frame_id)));
  }
  void handle_ground_velocity_decay(double factor) override {
    g_log.push_back(s_of(_id) + ":handle_ground_velocity_decay:" + num(factor));
  }

  void set_outline_color(std::u16string v) override {
    g_log.push_back(s_of(_id) + ":outline_color:" + render(Value(v)));
  }
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
  double velocity_y() const override { return velocity.y; }
  double hp() const override { return lfw::to_number(_hp); }
  void set_bounced(const Value& v) override {
    _bounced = v;
    bounced = lfw::truthy(v);
  }
  double fall_value() const override { return lfw::to_number(_fall); }
  void set_fall_value(double v) override { _fall = Value(v); }
  double fall_value_max() const override { return lfw::to_number(_fallmax); }
  double defend_value() const override { return lfw::to_number(_defend); }
  double defend_value_max() const override { return lfw::to_number(_defendmax); }
  void set_defend_value(double v) override { _defend = Value(v); }
  double resting() const override { return lfw::to_number(_rest); }
  void set_resting(double v) override { _rest = Value(v); }
  void set_fallinjury(const Value& v) override { _finj = v; }
  void set_throwinjury(const Value& v) override { _tinj = Value(lfw::to_number(v)); }
  Value frame_on_landing() const override { return _onlanding; }
  Value frame_info() const override {
    Object o;
    o.set(u"id", _frameid);
    return Value(std::make_shared<Object>(o));
  }
  void ctrl_reset_key_list() override { g_log.push_back(s_of(_id) + ":ctrl_reset_key_list"); }
  bool has_catcher() const override { return _catcher; }
  void catcher_drop_catching() override {
    g_log.push_back(s_of(_id) + ":catcher_drop_catching");
  }
  void leave_ground() override { g_log.push_back(s_of(_id) + ":leave_ground"); }
  void set_fuse(const Value& v) {
    _fuse.clear();
    _fuse_owned.clear();
    const Array* arr = as_array(v);
    if (arr == nullptr) {
      has_fuse_bys = false;
      return;
    }
    for (size_t i = 0; i < arr->size(); ++i) {
      auto e = std::make_unique<Entity>(fx::shared_world(), Value());
      e->id = lfw::to_string(arr->at(i));
      _fuse_owned.push_back(std::move(e));
    }
    for (const auto& e : _fuse_owned) _fuse.push_back(e.get());
    fuse_bys = _fuse;
    has_fuse_bys = !_fuse.empty();
  }
  void ref_set_velocity(const Value& who, const Value& x, const Value& y,
                        const Value& z) override {
    g_log.push_back(s_of(_id) + ":ref_set_velocity:" + fighter_text(who) + ":" + render(x) +
                    ":" + render(y) + ":" + render(z));
  }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(_id) + ":set_velocity:" + render(x) + ":" + render(y) + ":" +
                    render(z));
  }
};

FakeEnt* g_ent = nullptr;
Value g_state;
Value g_velocity;
CharacterState_Falling* g_obj = nullptr;

std::string state_text() {
  const FakeEnt& e = *g_ent;
  return "pos=[" + num(e.position.x) + "," + num(e.position.y) + "," + num(e.position.z) +
         "] vel=[" + num(e.velocity.x) + "," + num(e.velocity.y) + "," + num(e.velocity.z) +
         "] dataid=" + render(e._dataid) + " frameid=" + render(e._frameid) + " hp=" +
         render(e._hp) + " facing=" + num(e.facing) + " bounced=" + render(e._bounced) +
         " fall=" + render(e._fall) + "/" + render(e._fallmax) + " defend=" +
         render(e._defend) + "/" + render(e._defendmax) + " rest=" + render(e._rest) + "/" +
         render(e._restmax) + " finj=" + render(e._finj) + " tinj=" + render(e._tinj);
}

void bind() {
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_character_state_falling <case-file>\n");
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
      } else if (sub == "dataid") {
        g_ent->_dataid = parse_value(t, i);
        g_ent->rebuild_data();
      } else if (sub == "frameid") {
        g_ent->_frameid = parse_value(t, i);
        g_ent->rebuild_frame();
      } else if (sub == "onlanding") {
        g_ent->_onlanding = parse_value(t, i);
        g_ent->rebuild_frame();
      } else if (sub == "idxbounce") {
        g_ent->_idxbounce = parse_value(t, i);
        g_ent->rebuild_data();
      } else if (sub == "idxfalling") {
        g_ent->_idxfalling = parse_value(t, i);
        g_ent->rebuild_data();
      } else if (sub == "idxcritical") {
        g_ent->_idxcritical = parse_value(t, i);
        g_ent->rebuild_data();
      } else if (sub == "idxlying") {
        g_ent->_idxlying = parse_value(t, i);
        g_ent->rebuild_data();
      } else if (sub == "shaking") {
        g_ent->_shaking = parse_value(t, i);
        g_ent->shaking = lfw::to_number(g_ent->_shaking);
      } else if (sub == "wait") {
        g_ent->_wait = parse_value(t, i);
        g_ent->wait = lfw::to_number(g_ent->_wait);
      } else if (sub == "hp") {
        g_ent->_hp = parse_value(t, i);
      } else if (sub == "facing") {
        g_ent->facing = lfw::to_number(parse_value(t, i));
      } else if (sub == "vx") {
        g_ent->velocity.x = lfw::to_number(parse_value(t, i));
      } else if (sub == "vy") {
        g_ent->velocity.y = trace::to_double(t[i++]);
      } else if (sub == "vz") {
        g_ent->velocity.z = lfw::to_number(parse_value(t, i));
      } else if (sub == "bounced") {
        g_ent->_bounced = parse_value(t, i);
        g_ent->bounced = lfw::truthy(g_ent->_bounced);
      } else if (sub == "catcher") {
        g_ent->_catcher = lfw::truthy(parse_value(t, i));
      } else if (sub == "fuse") {
        g_ent->set_fuse(parse_value(t, i));
      } else if (sub == "fall") {
        g_ent->_fall = parse_value(t, i);
      } else if (sub == "fallmax") {
        g_ent->_fallmax = parse_value(t, i);
      } else if (sub == "defend") {
        g_ent->_defend = parse_value(t, i);
      } else if (sub == "defmax") {
        g_ent->_defendmax = parse_value(t, i);
      } else if (sub == "rest") {
        g_ent->_rest = parse_value(t, i);
      } else if (sub == "restmax") {
        g_ent->_restmax = parse_value(t, i);
        g_ent->set_resting_max(lfw::to_number(g_ent->_restmax));
      } else if (sub == "finj") {
        g_ent->_finj = parse_value(t, i);
      } else if (sub == "tinj") {
        g_ent->_tinj = parse_value(t, i);
      } else if (sub == "dvals") {
        g_ent->_dvals = parse_value(t, i);
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
        g_obj = new CharacterState_Falling(g_state);
        std::printf("run make || %s | s=%s | %s\n", join(g_log).c_str(),
                    render(g_obj->state()).c_str(), state_text().c_str());
      } else if (what == "default") {
        delete g_obj;
        g_obj = new CharacterState_Falling();
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
      } else if (what == "leave") {
        g_obj->leave(*g_ent, Value());
        std::printf("run leave || %s | %s\n", join(g_log).c_str(), state_text().c_str());
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
