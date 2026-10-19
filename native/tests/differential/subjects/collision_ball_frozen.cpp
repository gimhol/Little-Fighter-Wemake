#include <cstddef>
#include <cstdio>
#include <fstream>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "lfw/collision/ball_frozen.h"
#include "lfw/core/value.h"
#include "lfw/defines/entity_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/entity/face_helper.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Value;
using lfw::EnterFrameResult;
using lfw::collision::BallFrozenEnv;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;

std::vector<std::string> g_log;
// `create_entity` 造出来的实体由台面持有（与 TS 的 GC 对齐：进程退出时回收）。
std::vector<std::unique_ptr<lfw::Entity>> g_spawns;
// 切片 4CE：`Entity::spawn` 不是虚函数 ⇒ 台面只能借 `spawn` 一定会问的世界面观测它
//（切片 4CJ 后是 `lfw().datas_find` / `lfw().create_entity` / `world().gen_field`）。
// opoint 是处理器里的**函数静态对象**（每次原地改写 x/y/z），所以从 `gen_field` 抓到的
// 那份引用之后每次读到的都是本次坐标；「生成失败」那条路径（`create_entity` 返回
// nullptr）就靠它补日志。
Value g_opoint;

std::string render(const Value& v) { return to_ascii(render_value(v)); }
std::string s_of(const std::u16string& s) { return to_ascii(s); }

std::string join(const std::vector<std::string>& xs) {
  std::string out;
  for (size_t i = 0; i < xs.size(); ++i) {
    if (i) out += ",";
    out += xs[i];
  }
  return out;
}

Value make_frame(double cx, double cy, double w, double h) {
  lfw::Object o;
  o.set(u"centerx", Value(cx));
  o.set(u"centery", Value(cy));
  o.set(u"width", Value(w));
  o.set(u"height", Value(h));
  return Value(std::make_shared<lfw::Object>(o));
}

struct Fake;
struct Side;

// 切片 4CJ 后实体手里是真 `lfw::World` ⇒ 「每实体一个宿主」变成「每实体一个世界 + 一份假 `lfw`」：
//   * `create_entity_with_bot` 旧缝 = `IWorldLfw::create_entity`（处理器 `spawn` 走真实现），
//     它拿到的那只 `World&` 就是发起方的世界 ⇒ 台面按世界认边；
//   * `gen_field` 旧缝 = `TestWorld::on_gen_field`，`Entity::on_spawn` 用
//     `emitter.gen_or(...)` 触发它 ⇒ 钩子拿到的 `emitter` 就是这次 `spawn` 的发起方。
// `owner` 是发起方实体，`victim` 是另一方（处理器传给 `spawn` 的第三个实参取自受害者）。
struct Side {
  Fake* owner = nullptr;
  Fake* victim = nullptr;
  bool pending_spawn_log = false;

  // 假 `lfw`：`world.lfw.datas.find(oid)` 的 oid 在端口里写死为 `209`；返回非空即让真
  // `spawn` 继续走到 `create_entity`。
  struct Lfw : fx::FakeLfw {
    Side* side = nullptr;
    Value datas_find(const Value& oid) override;
    lfw::Entity* create_entity(lfw::World& world, const Value& data) override;

  // `Entity::spawn` 走的是 `create_entity_with_bot`（真机里它额外建控制器）：本台面
  // 只关心「造出来了没」，所以与 `create_entity` 同一条路。
  lfw::Entity* create_entity_with_bot(const std::u16string& player_id, lfw::World& world,
                                      const Value& data) override {
    (void)player_id;
    return create_entity(world, data);
  }
  };

  Lfw lfw;
  std::unique_ptr<fx::TestWorld> world;

  Side() {
    lfw.side = this;
    world = std::make_unique<fx::TestWorld>(lfw, fx::g_renderer, &fx::g_states);
    // `on_spawn` 里每一条 `opoint.__gen_*` 都会问一次世界；第一次拿到的 `holder` 就是
    // opoint 本体 ⇒ 在那儿补 `A:spawn:...` 那一行（与 TS 假实体的 `spawn` 同时刻）。
    world->on_gen_field = [this](const Value& holder, const std::u16string& kind,
                                 lfw::Entity& emitter) -> std::optional<Value> {
      (void)kind;
      (void)emitter;
      if (!pending_spawn_log) return std::nullopt;
      pending_spawn_log = false;
      g_opoint = holder;
      log_spawn();
      return std::nullopt;
    };
  }

  void log_spawn() const;
};

Side g_side_a;
Side g_side_v;

// 切片 4CE：碰撞族窄接口退役 ⇒ 台面假实体就是真 `lfw::Entity`（TS 台面同样只给
// `group` / `state` / `data` / `frame` / `facing` / `position` / `spawn` 这几条读面）。
struct Fake : lfw::Entity {
  Value _group;
  Value _state;
  Value _type = Value(static_cast<double>(lfw::EntityEnum::Fighter));
  Value _face = Value(1.0);
  bool _spawn_ok = true;
  // `Entity::data()` 返回 `const Value&` ⇒ 镜像必须是成员（不能返回临时量）。
  mutable Value _data_mirror;

  Fake(std::u16string id, Side& s) : Entity(*s.world, Value()) {
    this->id = std::move(id);
    s.owner = this;
    // TS 假实体的字段初值：`_frame = {centerx:0,centery:0,width:0,height:0}`、`_face = 1`。
    frame = make_frame(0, 0, 0, 0);
    facing = 1;
  }

  Value group() const override { return _group; }
  Value state() const override { return _state; }
  const Value& data() const override {
    lfw::Object o;
    o.set(u"type", _type);
    _data_mirror = Value(std::make_shared<lfw::Object>(o));
    return _data_mirror;
  }
  // 处理器用 `v->enter_frame(GONE_FRAME_INFO)` 收尾；`enter_frame` 已是虚函数，
  // 这里逐字复刻 TS 假实体的那条日志（`info.id`），不跑真 `enter_frame` 的帧逻辑
  //（TS 台面的假实体同样只有这一行日志）。
  EnterFrameResult enter_frame(const Value& nf, bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(id) + ":enter_frame:" + render(lfw::field_or(nf, u"id")));
    return EnterFrameResult::NotFound;
  }
};

Fake g_att(u"A", g_side_a);
Fake g_vic(u"V", g_side_v);

void Side::log_spawn() const {
  const Value action = lfw::field_or(g_opoint, u"action");
  // TS 假实体拿到的第三个实参是 `turn_face(v.facing)`；端口把它收成了 `double`
  //（`to_number(...)`），台面按镜像的 `Value` 形态渲染，才保得住 `face` 为 `undefined`
  // 的用例（`env a|v face u`）。
  const Value face = victim != nullptr ? lfw::entity::turn_face(victim->_face) : Value();
  g_log.push_back(s_of(owner->id) + ":spawn:" + render(lfw::field_or(g_opoint, u"oid")) + ":" +
                  render(lfw::field_or(g_opoint, u"kind")) + ":" +
                  render(lfw::field_or(g_opoint, u"x")) + ":" +
                  render(lfw::field_or(g_opoint, u"y")) + ":" +
                  render(lfw::field_or(g_opoint, u"z")) + ":" +
                  render(lfw::field_or(action, u"id")) + ":" + render(face));
}

Value Side::Lfw::datas_find(const Value& oid) {
  if (!lfw::strict_equals(oid, Value(std::u16string(u"209")))) return Value();
  lfw::Object o;
  o.set(u"id", Value(std::u16string(u"209")));
  return Value(std::make_shared<lfw::Object>(o));
}

lfw::Entity* Side::Lfw::create_entity(lfw::World& world, const Value& data) {  (void)world;
  Side& s = *side;
  if (s.owner == nullptr || !s.owner->_spawn_ok) {
    // 生成失败：真 `spawn` 在这儿就早退，之后没有别的缝可打那一行 ⇒ 当场补上。
    s.pending_spawn_log = false;
    if (s.owner != nullptr) s.log_spawn();
    return nullptr;
  }
  s.pending_spawn_log = true;
  // 生成物挂到**无日志**的世界（共享台面世界，没挂钩子）上：它内部的 `on_spawn`
  //（`__judge` / `__gen_*`）属于生成物的实现细节，不是台面的观测点。
  auto e = std::make_unique<lfw::Entity>(fx::shared_world(), data);
  lfw::Entity* raw = e.get();
  g_spawns.push_back(std::move(e));
  return raw;
}

Value g_itr;

void bind() {
  g_side_a.victim = &g_vic;
  g_side_v.victim = &g_att;
  BallFrozenEnv env;
  env.is_ball = [](const lfw::Entity& e) { return lfw::entity::is_ball_data(e.data()); };
  env.is_fighter = [](const lfw::Entity& e) { return lfw::entity::is_fighter_data(e.data()); };
  lfw::collision::set_ball_frozen_env(env);
}

std::string side_text(const Fake& f) {
  const std::string id = s_of(f.id);
  return id + ".group=" + render(f._group) + " " + id + ".state=" + render(f._state) + " " + id +
         ".type=" + render(f._type) + " " + id + ".face=" + render(f._face) + " " + id +
         ".pos=" + render(Value(f.position.x)) + "/" + render(Value(f.position.y)) + "/" +
         render(Value(f.position.z)) + " " + id + ".spawn=" + (f._spawn_ok ? "1" : "0");
}

std::string state_text() { return side_text(g_att) + " " + side_text(g_vic); }

void walk_side(Fake& f, const std::string& field, const std::vector<std::string>& t, size_t& i) {
  if (field == "group") {
    f._group = parse_value(t, i);
  } else if (field == "state") {
    f._state = parse_value(t, i);
  } else if (field == "type") {
    f._type = parse_value(t, i);
  } else if (field == "face") {
    f._face = parse_value(t, i);
    // 真实体读的是 `facing`（`double`）；`u` 按 TS 的 `Number(undefined)` = NaN 落。
    f.facing = lfw::to_number(f._face);
  } else if (field == "posx") {
    f.position.x = trace::to_double(t[i++]);
  } else if (field == "posy") {
    f.position.y = trace::to_double(t[i++]);
  } else if (field == "posz") {
    f.position.z = trace::to_double(t[i++]);
  } else if (field == "frame") {
    f.frame = parse_value(t, i);
  } else if (field == "spawn") {
    f._spawn_ok = t[i++] == "1";
  } else {
    std::fprintf(stderr, "unknown side field '%s'\n", field.c_str());
    std::exit(2);
  }
}

void run() {
  const bool hit = lfw::collision::handle_ball_frozen(g_att, g_vic, g_itr);
  std::printf("run hit || %s | %s | ret=%s\n", join(g_log).c_str(), state_text().c_str(),
              hit ? "1" : "0");
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_collision_ball_frozen <case-file>\n");
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
    if (op == "env") {
      const std::string& sub = t[i++];
      if (sub == "itr") {
        g_itr = parse_value(t, i);
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
      run();
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  return 0;
}
