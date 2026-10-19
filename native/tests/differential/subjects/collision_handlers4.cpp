#include <cmath>
#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/collision/handlers4.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Entity;
using lfw::Value;
using lfw::collision::Collision;
using lfw::collision::Handlers4Env;
using lfw::collision::HandlersEnv;
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

bool nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<lfw::NullTag>(v);
}

// 切片 4CE：碰撞族窄接口（`IH4Entity` 等）退役 ⇒ 台面假实体就是真 `lfw::Entity`，只覆写
// 实体面上确实存在的那几条读/写（TS 台面同样只给这几条，见 `collision_handlers4.ts`）。
struct Fake : lfw::Entity {
  // 用例面（TS 台面的后备字段）与显示面（`| 状态`）读的都是镜像；库读的那些走 override。
  std::u16string _id;
  Value _hp = Value(20.0);
  Value _hp_r = Value(30.0);
  Value _state;
  Value _facing = Value(1.0);
  Value _base_type;
  double _vel[3] = {0, 0, 0};
  Value _frame_id = Value(u"f1");
  Value _throwings;
  Value _in_the_skys;
  Value _arest;
  bool _arest_set = false;
  bool _dropping = false;
  Value _hit_sounds;
  Value _type = Value(8.0);

  explicit Fake(std::u16string id) : lfw::Entity(fx::shared_world(), Value()) {
    _id = std::move(id);
    this->id = _id;
  }

  double hp() const override { return lfw::to_number(_hp); }
  void set_hp(double v) override {
    _hp = Value(v);
    g_log.push_back(s_of(_id) + ":set_hp:" + num(v));
  }
  double hp_r() const override { return lfw::to_number(_hp_r); }
  void set_hp_r(double v) override {
    _hp_r = Value(v);
    g_log.push_back(s_of(_id) + ":set_hp_r:" + num(v));
  }
  Value state() const override { return _state; }
  // TS 台面的 `base_type` 是 `undefined`（⇒ `Value(base_type())` 与 `NaN` 同义：只参与
  // `=== 4 / === 5` 这类严格比较，两者都不等）。
  double base_type() const override { return lfw::to_number(_base_type); }

  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    _vel[0] = lfw::to_number(x);
    _vel[1] = lfw::to_number(y);
    _vel[2] = lfw::to_number(z);
    velocity.set(_vel[0], _vel[1], _vel[2]);
    g_log.push_back(s_of(_id) + ":set_velocity:" + render(x) + ":" + render(y) + ":" +
                    render(z));
  }

  // 库把 `arest` 收成 `double`（`set_arest(to_number(arest))`）⇒ 台面的「没设过」到这儿
  // 只剩 `NaN`：映回 TS 台面的 `undefined`（日志打 `u`，状态行也打 `u`）。
  double arest() const override {
    return _arest_set ? lfw::to_number(_arest) : lfw::to_number(Value());
  }
  void set_arest(double v) override {
    if (std::isnan(v)) {
      _arest = Value();
      _arest_set = false;
      g_log.push_back(s_of(_id) + ":set_arest:u");
      return;
    }
    _arest = Value(v);
    _arest_set = true;
    g_log.push_back(s_of(_id) + ":set_arest:" + render(_arest));
  }
  // 台面的假件只打这一行（真 `enter_frame` 会去翻帧表，这里没有帧表可翻）。
  lfw::EnterFrameResult enter_frame(const Value& nf, bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(_id) + ":enter_frame:" + render(nf));
    return lfw::EnterFrameResult::NotFound;
  }
  void set_dropping(bool v) override {
    _dropping = v;
    dropping = v;
    g_log.push_back(s_of(_id) + ":set_dropping:" + (v ? "1" : "0"));
  }
  void play_sound(const Value& sounds) override {
    g_log.push_back(s_of(_id) + ":play_sound:" + render(sounds));
  }
};

Fake g_att(u"A");
Fake g_vic(u"V");
Collision g_c;
HandlersEnv g_henv;
Handlers4Env g_h4;
Value g_dataset;
Value g_itr_motionless;

// 真 `data_base_hit_sounds()` / `frame_id()` 读的是实体自己的 `_data` / `frame`，所以把
// 镜像灌进实体（`reset` 会顺手清掉别的字段，随后按用例再摆回来）。
void sync(Fake& f) {
  auto base = std::make_shared<lfw::Object>();
  base->set(u"hit_sounds", f._hit_sounds);
  auto indexes = std::make_shared<lfw::Object>();
  indexes->set(u"throwings", f._throwings);
  indexes->set(u"in_the_skys", f._in_the_skys);
  auto data = std::make_shared<lfw::Object>();
  data->set(u"type", f._type);
  data->set(u"base", Value(base));
  data->set(u"indexes", Value(indexes));
  f.reset(Value(data));
  f.id = f._id;                              // `reset` 用宿主的 `new_id` 覆盖了 id
  f.facing = lfw::to_number(f._facing);      // `handle_ball_hit_other` 直接读实体字段
  f.velocity.set(f._vel[0], f._vel[1], f._vel[2]);
  auto frame = std::make_shared<lfw::Object>();
  frame->set(u"id", f._frame_id);
  f.frame = Value(frame);
  f.dropping = f._dropping;
}

void bind() {
  g_henv.attacker_itr_motionless = [](const Collision&) { return g_itr_motionless; };
  g_henv.attacker_set_motionless = [](const Collision&, const Value& v) {
    g_log.push_back("A:set_motionless:" + render(v));
  };
  g_henv.victim_set_shaking = [](const Collision&, const Value& v) { g_log.push_back("V:set_shaking:" + render(v)); };
  g_henv.attacker_set_arest = [](const Collision&, double v) {
    g_att._arest = Value(v);
    g_att._arest_set = true;
    g_log.push_back("A:set_arest:" + num(v));
  };
  g_henv.victim_add_v_rest = [](Collision& c) {
    g_log.push_back("add_v_rest:" + s_of(c.vid) + ":" + num(c.rest));
  };
  g_henv.attacker_pick_victim = [](Collision&) {};
  g_henv.buff_get = [](const std::u16string&) { return false; };
  g_henv.buff_lifetime_zero = [](const std::u16string&) {};
  g_henv.buff_create = [](const std::u16string&, const std::u16string&) { return false; };
  g_henv.buff_set_attacker = [](const std::u16string&, const std::u16string&) {};
  g_henv.buff_set_victim = [](const std::u16string&, const std::u16string&) {};
  g_henv.buff_mount = [](const std::u16string&) {};
  g_c.env = &g_henv;

  g_h4.find_entity = [](const std::u16string& id) -> Entity* {
    if (id == g_att._id) return &g_att;
    if (id == g_vic._id) return &g_vic;
    return nullptr;
  };
  g_h4.is_fighter = [](const Entity& e) { return lfw::entity::is_fighter_data(e.data()); };
  g_h4.find_align_frame = [](const Collision&, const Value& fid, const Value& thr, const Value& sky) {
    g_log.push_back("faf:" + render(fid) + ":" + render(thr) + ":" + render(sky));
    return Value(u"faf_result");
  };
  lfw::collision::set_handlers4_env(g_h4);
}

std::string side_text(const Fake& f) {
  return s_of(f._id) + ".hp=" + render(f._hp) + " " + s_of(f._id) + ".hp_r=" + render(f._hp_r) +
         " " + s_of(f._id) + ".state=" + render(f._state) + " " + s_of(f._id) +
         ".facing=" + render(f._facing) + " " + s_of(f._id) +
         ".base_type=" + render(f._base_type) + " " + s_of(f._id) + ".vel=" + num(f._vel[0]) +
         "/" + num(f._vel[1]) + "/" + num(f._vel[2]) + " " + s_of(f._id) +
         ".arest=" + (f._arest_set ? render(f._arest) : std::string("u")) + " " + s_of(f._id) +
         ".dropping=" + (f._dropping ? "1" : "0") + " " + s_of(f._id) +
         ".frame_id=" + render(f._frame_id);
}

std::string state_text() { return side_text(g_att) + " " + side_text(g_vic); }

void walk_side(Fake& f, const std::string& field, const std::vector<std::string>& tok, size_t& i) {
  if (field == "hp") {
    f._hp = parse_value(tok, i);
  } else if (field == "hp_r") {
    f._hp_r = parse_value(tok, i);
  } else if (field == "state") {
    f._state = parse_value(tok, i);
  } else if (field == "facing") {
    f._facing = parse_value(tok, i);
  } else if (field == "base_type") {
    f._base_type = parse_value(tok, i);
  } else if (field == "velx") {
    f._vel[0] = lfw::to_number(parse_value(tok, i));
  } else if (field == "vely") {
    f._vel[1] = lfw::to_number(parse_value(tok, i));
  } else if (field == "velz") {
    f._vel[2] = lfw::to_number(parse_value(tok, i));
  } else if (field == "frame_id") {
    f._frame_id = parse_value(tok, i);
  } else if (field == "throwings") {
    f._throwings = parse_value(tok, i);
  } else if (field == "in_the_sky") {
    f._in_the_skys = parse_value(tok, i);
  } else if (field == "arest") {
    const Value v = parse_value(tok, i);
    f._arest = v;
    f._arest_set = !nullish(v);
  } else if (field == "dropping") {
    f._dropping = tok[i++] == "1";
  } else if (field == "hit_sounds") {
    f._hit_sounds = parse_value(tok, i);
  } else if (field == "type") {
    f._type = parse_value(tok, i);
  } else {
    std::fprintf(stderr, "unknown side field '%s'\n", field.c_str());
    std::exit(2);
  }
}

void run(const std::string& name) {
  sync(g_att);
  sync(g_vic);
  if (name == "ballhitother") {
    lfw::collision::handle_ball_hit_other(g_c);
  } else if (name == "weaponhitother") {
    lfw::collision::handle_weapon_hit_other(g_c);
  } else {
    std::fprintf(stderr, "unknown handler '%s'\n", name.c_str());
    std::exit(2);
  }
  std::printf("run %s || %s | %s\n", name.c_str(), join(g_log).c_str(), state_text().c_str());
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_collision_handlers4 <case-file>\n");
    return 2;
  }
  bind();
  g_c.aid = u"A";
  g_c.vid = u"V";

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
      if (sub == "itr") {
        g_c.itr = parse_value(t, i);
      } else if (sub == "bdy") {
        g_c.bdy = parse_value(t, i);
      } else if (sub == "aframe") {
        g_c.aframe = parse_value(t, i);
      } else if (sub == "dataset") {
        g_dataset = parse_value(t, i);
        g_c.dataset = g_dataset;
      } else if (sub == "rest") {
        g_c.rest = trace::to_double(t[i++]);
      } else if (sub == "itr_motionless") {
        g_itr_motionless = parse_value(t, i);
      } else if (sub == "a" || sub == "v") {
        const std::string& field = t[i++];
        walk_side(sub == "a" ? g_att : g_vic, field, t, i);
        if (i != t.size()) {
          std::fprintf(stderr, "trailing tokens after side field '%s' at line %d\n", field.c_str(),
                       lineno);
          return 2;
        }
      } else {
        std::fprintf(stderr, "unknown env '%s' at line %d\n", sub.c_str(), lineno);
        return 2;
      }
      std::printf("env %s\n", sub.c_str());
      continue;
    }
    if (op == "run") {
      run(t[i++]);
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  return 0;
}
