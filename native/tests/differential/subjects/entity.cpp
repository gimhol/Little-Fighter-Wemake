#include <algorithm>
#include <cstdlib>
#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <utility>
#include <variant>
#include <vector>

#include "lfw/cases.h"
#include "lfw/buff/buff.h"
#include "lfw/controller/base_controller.h"
#include "lfw/core/js_num.h"
#include "lfw/core/value.h"
#include "lfw/defines/frame_id.h"
#include "lfw/defines/game_mode.h"
#include "lfw/entity/entity.h"
#include "lfw/controller/ball_controller.h"
#include "lfw/helper/closer_one.h"
#include "lfw/entity/entity_ref.h"
#include "lfw/entity/entity_snapshot.h"
#include "lfw/entity/summary_mgr.h"
#include "lfw/loader/get_val_from_collision.h"
#include "lfw/loader/get_val_from_entity.h"
#include "lfw/loader/preprocess_next_frame.h"
#include "lfw/state/state_base.h"
#include "lfw/state/states.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/world_dataset.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Entity;
using lfw::Value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;
using trace::to_u16;

// 台面解析出来的值留一份：真登记表（`loader/preprocess_next_frame.cpp` 的 `judger_registry()`）
// 按**对象地址**索引、且用 `emplace` 登记（同一个键不覆盖），而命中时还会拿「源串相同」再确认
// 一次。TS 侧不担心这个 —— `__judger` 就挂在对象自己身上、随对象一起析构；端口这边登记表**不
// 随对象释放**，所以台面一条命令用完就析构的入参，其地址被下一条命令的新对象复用时，登记表里
// 那条旧记录会让 `judger_of` 判成「源串对不上 ⇒ 没有判定器」，判定器就这样丢了（差分表现为
// 少一条 `judge:`、该条目退回成普通下帧）。真加载器登记的帧都是实体数据里的长命对象，撞不上；
// 台面把解析出来的值留一份，登记过的地址就不会被复用。
std::vector<Value> g_kept;

// `entity.ts::parseValue` 末尾那句 `attachJudgers(v)`：TS 台面在**解析点**就把 `__judge`
// 变成能跑的判定器（挂成 `__judger`）。端口不往 `Value` 里塞函数对象（§4.40，也没有
// `__judger` 这个键），改用真加载器的同一条门 —— `lfw::loader::preprocess_next_frame` 把
// 「`expression` 是字符串」的下帧登记进「对象身份 → 判定器」表，运行时由
// `Entity::has_next_frame_judge` / `Entity::next_frame_judge` 查它（等价 TS 的 `!!nf.__judger`
// 与 `nf.__judger?.run(this)`）。登记点因此与 TS 的挂载点一一对应：这里照 `attachJudgers` 的
// 递归形状（数组逐项、对象逐字段）走一遍，然后包住台面自己的 `parse_value`。
void preprocess_deep(const Value& v) {
  Value item = v;  // 登记按对象身份（`Value` 的对象是 `shared_ptr`），拷一份也一样登记到本尊。
  lfw::loader::preprocess_next_frame(item);
  if (const lfw::Array* arr = lfw::as_array(v)) {
    for (std::size_t k = 0; k < arr->size(); ++k) preprocess_deep(arr->at(k));
    return;
  }
  const lfw::Object* obj = lfw::as_object(v);
  if (obj == nullptr) return;
  for (const std::u16string& key : obj->keys()) {
    const Value* child = obj->get(key);
    if (child != nullptr) preprocess_deep(*child);
  }
}

Value parse_value(const std::vector<std::string>& t, std::size_t& i) {
  Value v = trace::parse_value(t, i);
  preprocess_deep(v);
  g_kept.push_back(v);
  return v;
}

std::vector<std::string> g_log;
Value g_bg_dataset;
// `env data` fills the `lfw.datas.find` table (`read_snapshot` looks a data id up).
Value g_datas = Value(std::make_shared<lfw::Object>());
std::u16string g_team = u"1";
int g_id_counter = 0;
std::vector<std::unique_ptr<lfw::controller::BaseController>> g_ctrls;
std::unique_ptr<Entity> g_entity;
std::unique_ptr<Entity> g_buddy;
// `world.restrict` answer (`run restrict`); a nullish value means "no clamp".
Value g_restrict_result;
// The harness MT: `run mtseed` reseeds it (both sides draw from the same stream).
lfw::MersenneTwister g_mt(0.0);
// `spawn` / `attach` 的世界面：`world.entities.length + world.ghosts.length`、
// `world.game_time`、`world.add_entities`、`lfw.factory.create_entity_with_bot`，以及
// `__gen_*` 表达式字段的替身（`env ecount|gtime|gen` —— 切片 4CJ 后分别落在
// `TestWorld::on_entity_count` / `on_game_time` / `on_add_entities` 与假 `lfw` 上）。
double g_ecount = 0;
double g_gtime = 0;
std::vector<std::pair<std::u16string, Value>> g_gen;
std::vector<std::unique_ptr<Entity>> g_spawns;
Entity* g_last_spawn = nullptr;
// `apply_opoints` 的 `world.list_entities` 候选名单（`env ents …`）与「新实体的控制器是不是
// ball ctrl」（`env ballctrl b 1`，读 `lfw.factory.acquire_ctrl`）。
// 名单只存 token：`run make` / `run buddy` 会换掉实体，而真实 `World` 每次筛的是「当前」
// 世界里的实体，所以这里也必须每次现查（存裸指针会留下悬垂项）。
std::vector<std::string> g_candidate_tokens;
bool g_ball_ctrl = false;
// `world.puppets.values()`（`env puppets …`，token 与 `env ents` 同款）、`world.stage.<key>`
// （`env stage <key> <值>`）、`world.ground.step`（`env groundstep <值>`）与
// `lfw.survival_rank_mode`（`env rankmode b 1`）——`update()` 的四个宿主输入。
std::vector<std::string> g_puppet_tokens;
std::vector<std::pair<std::u16string, Value>> g_stage;
double g_ground_step = 10;
bool g_rank_mode = false;
// `world.lfw.survival_rank_available`（`env rankavail b 1`，`survial_rank_mode` getter 用）
// 与 `lfw.is_cheat(name)` 的开关集合（`env cheat <名字> b 1`，三个 `*_ON` getter 用）。
bool g_rank_avail = false;
std::vector<std::u16string> g_cheats;
// `e.buffs` 的宿主所有权（`run buffset` 造的）。
std::vector<std::unique_ptr<lfw::buff::Buff>> g_buffs;
// `run cv …` 手里的那个碰撞（`loader/get_val_from_collision`）。TS 的 `Collision` 没有
// 快照版本，`attacker` / `victim` 就是那两个**活**实体、`aframe` / `bframe` 就是它们的
// `frame`；端口这边 `ActorHandle` 直接拿实体（台面里给的是**真**实体），"世界外"就塞一个
// 只有 `id` 的假句柄（读实体的项于是给 `undefined`）。
lfw::collision::Collision g_cv;
// 世界外的 id：`world.entity_map.get(id) ?? null` 找不到它，读实体的项于是给 `undefined`
// （TS 那边会是 `TypeError`，见 `DESIGN.md`）。
const char16_t* const kCvOutside = u"__outside__";

Entity* candidate_of(const std::string& tok) {
  if (tok == "self") return g_entity.get();
  if (tok == "buddy") return g_buddy.get();
  if (tok.rfind("sp", 0) == 0) {
    const std::size_t n = static_cast<std::size_t>(std::atoi(tok.c_str() + 2));
    return n < g_spawns.size() ? g_spawns[n].get() : nullptr;
  }
  return nullptr;
}

std::string render(const Value& v) { return to_ascii(render_value(v)); }
std::string s_of(const std::u16string& s) { return to_ascii(s); }

// `entity.ts` 那张台面判定器（`attachJudgers`）的 `run` 里有一句
// `log.push("judge:" + r(marker))`，且它返回的就是那个标记。端口这边跑的是**真**登记表里的
// `Expression<Entity>`（`Entity::next_frame_judge` → `Expression::run`，返回 `bool`），`run`
// 不可钩，所以台面只能按真 `get_next_frame` 的同一次序把「会被跑到判定器」的条目先打出来：
//   * 有没有判定器 —— 问真登记表（`has_next_frame_judge`，就是 TS 的 `!!nf.__judger`）；
//   * 停机 —— 照 TS 判定器的语义（判定器返回标记本身 ⇒ 标记为真即命中，数组分支当场返回，
//     其后的条目不再判定）；
//   * 内容 —— `__judge` 标记本身（TS 的 `marker`）。
// 判定本身不在这里跑：真链（`get_next_frame`）会跑一次，次数与 TS 相同。
void log_next_frame_judgers(const Value& nfs) {
  if (g_entity == nullptr) return;
  // `Entity::enter_frame` 的第一句：`gone` 帧直接返回，判定器一次都不跑。
  if (lfw::strict_equals(lfw::field_or(g_entity->frame, u"id"),
                         Value(std::u16string(lfw::frame_id::kGone))))
    return;
  const lfw::Array* arr = lfw::as_array(nfs);
  if (arr == nullptr) {
    // TS 的对象分支：判定器存在就先 `run` 一次（`judger && !judger.run(this)`）。
    if (g_entity->has_next_frame_judge(nfs))
      g_log.push_back("judge:" + render(lfw::field_or(nfs, u"__judge")));
    return;
  }
  // TS 的数组分支：逐项 —— `!nf` 跳过、无判定器进 `remains`，有判定器的跑一次判定
  //（判定为假继续、为真立刻返回）。
  for (std::size_t k = 0; k < arr->size(); ++k) {
    const Value nf = arr->at(k);
    if (!lfw::truthy(nf) || !g_entity->has_next_frame_judge(nf)) continue;
    const Value marker = lfw::field_or(nf, u"__judge");
    g_log.push_back("judge:" + render(marker));
    if (lfw::truthy(marker)) break;
  }
}

// `idRef(x)` 的端口版：`x` 是实体引用（`entity/entity_ref.h`）⇒ 打它里面的 `id`，
// 空值（`undefined` / `null` / `nullptr`）就给 `null`（TS 的 `idRef` 对空值也返回 `null`）。
Value id_probe(const Value& ref) {
  if (!lfw::truthy(ref)) return Value(lfw::NullTag{});
  lfw::Object o;
  o.set(u"id", lfw::field_or(ref, u"id"));
  return Value(std::make_shared<lfw::Object>(o));
}

Value chasing_probe(const lfw::controller::BaseController* c) {
  // `chasing` 是实体指针（TS 同形）⇒ 形状照 `id_probe` 给 `{ id }`。
  if (c == nullptr || c->chasing == nullptr) return Value(lfw::NullTag{});
  lfw::Object o;
  o.set(u"id", Value(c->chasing->id));
  return Value(std::make_shared<lfw::Object>(o));
}

// --- `loader/get_val_from_collision` 的驱动器 -----------------------------------
// `run cvwho <攻击方> <受击方>` 的 token：`self` / `buddy` / `none`（`none` = 世界外的 id，
// `CollisionValEnv` 交给宿主的 `world.entity_map.get(id) ?? null`，找不到 ⇒ 读实体的项
// 给 `undefined`）。
Entity* cv_entity_of(const std::string& tok) {
  return tok == "none" ? nullptr : candidate_of(tok);
}

// TS 的 `collision.itr` / `.bdy` / `.aframe` / `.bframe` **永远是对象**（读不到的字段才是
// `undefined`），所以端口这边也一律塞空对象，别用 `monostate`：`field_of(monostate, …)`
// 也是 `undefined`，但 TS 那边 `undefined.state` 会直接抛。
Value cv_empty() { return Value(std::make_shared<lfw::Object>()); }

// `aframe` / `bframe` 就是实体的 `frame`；实体没有帧时给空对象（同上）。
Value cv_frame_of(const Entity* e) {
  if (e == nullptr || lfw::as_object(e->frame) == nullptr) return cv_empty();
  return e->frame;
}

// 世界外的 id ⇒ 只有 `id`、没有实体的句柄（`entity()` 给 `nullptr`）。
lfw::collision::ActorHandle cv_handle_of(Entity* e) {
  if (e != nullptr) return lfw::collision::ActorHandle::of(*e);
  lfw::collision::CollisionActor fake;
  fake.id = std::u16string(kCvOutside);
  return lfw::collision::ActorHandle::of(fake);
}

void cv_reset() {
  g_cv = lfw::collision::Collision{};
  g_cv.itr = cv_empty();
  g_cv.bdy = cv_empty();
  g_cv.aframe = cv_empty();
  g_cv.bframe = cv_empty();
  g_cv.attacker = cv_handle_of(nullptr);
  g_cv.victim = cv_handle_of(nullptr);
}

void cv_bind(const std::string& a_tok, const std::string& v_tok) {
  Entity* a = cv_entity_of(a_tok);
  Entity* v = cv_entity_of(v_tok);
  g_cv.attacker = cv_handle_of(a);
  g_cv.victim = cv_handle_of(v);
  g_cv.aframe = cv_frame_of(a);
  g_cv.bframe = cv_frame_of(v);
}

// 七个键的 `is_hit` / `is_start` / `is_db_hit` 掩码（`run cvkey` 的回显，让场景能自检）。
std::string cv_key_state(lfw::controller::BaseController* c) {
  std::string hit;
  std::string start;
  std::string db;
  for (const char16_t* k : {u"L", u"R", u"U", u"D", u"d", u"j", u"a"}) {
    hit += c->is_hit(k) ? "1" : "0";
    start += c->is_start(k) ? "1" : "0";
    db += c->is_db_hit(k) ? "1" : "0";
  }
  return "t=" + render(Value(c->time())) + " hit=" + hit + " start=" + start + " db=" + db;
}

// --- `BallController` 的驱动器 -------------------------------------------------
// `run ctrl ball` 造一个**真**控制器挂到实体上（TS 那边也是 `new BallController`），
// 之后 `run ball …` 用它：每次先 `refresh_ctrl_env()`（端口的控制器读 `env()`，
// TS 的控制器直接读 `this.entity`），候选名单复用 `env ents` 的那一份。
std::vector<std::unique_ptr<lfw::controller::BallController>> g_balls;
lfw::controller::BallController* g_ball = nullptr;

Value ball_ref(const std::string& tok) {
  if (tok == "z" || tok == "nil") return Value(lfw::NullTag{});
  Entity* e = candidate_of(tok);
  return e != nullptr ? lfw::ref_of(*e) : Value();
}

std::vector<Value> ball_refs() {
  std::vector<Value> out;
  for (const std::string& tok : g_candidate_tokens) out.push_back(ball_ref(tok));
  return out;
}

// `chase_point` / `dir_*` / `leave_dir` / `gave_up` / 六个键的 hit|hold，外加 `LR/UD/jd`。
std::string ball_state(lfw::controller::BallController* b) {
  const lfw::Vector3& cp = b->chase_point();
  std::string hit;
  std::string hold;
  for (const char16_t* k : {u"L", u"R", u"U", u"D", u"j", u"d"}) {
    hit += b->is_hit(k) ? "1" : "0";
    hold += b->is_hold(k) ? "1" : "0";
  }
  return " chasing=" + render(chasing_probe(b)) + " pt=" + render(Value(cp.x)) + "/" +
         render(Value(cp.y)) + "/" + render(Value(cp.z)) +
         " dir=" + render(Value(b->dir_x)) + "/" + render(Value(b->dir_y)) + "/" +
         render(Value(b->dir_z)) + " leave=" + render(Value(b->leave_dir)) +
         " gaveup=" + render(Value(b->gave_up)) +
         " lr=" + render(Value(static_cast<double>(b->LR()))) +
         " ud=" + render(Value(static_cast<double>(b->UD()))) +
         " jd=" + render(Value(static_cast<double>(b->jd()))) + " hit=" + hit +
         " hold=" + hold;
}
// Defined with the `run` vocabulary further down; the `world` hooks above need it too.
std::string join(const std::vector<std::string>& xs);

// --- state registry + the fake state (the 9g wiring) -------------------------
// The state hooks are no longer injected into the entity: they live on a state
// object that `set_state` selects, so a scene must `run reg` + `run setstate` before
// `run hook ...` can be observed — exactly like the real code, where `set_state` is
// the only way a state becomes active.
lfw::state::States g_states;

// What `run hook ...` configures.  A hook that is "off" returns `undefined` without
// logging, which is what a missing TS callback does (`this._state?.get_gravity?.(…)`).
struct HookConfig {
  bool dead = false;
  bool gravity = false;
  Value gravity_value;
  bool find = false;
  bool find_echo = false;
  Value find_value;
  bool auto_frame = false;
  Value auto_frame_value;
  bool sudden = false;
  Value sudden_value;
  bool caught = false;
  Value caught_value;
  // `run hook view*`: the fake state drives the three `EntityStateView` forwards that
  // nothing else in this subject reaches (`set_position` / `set_frame` /
  // `enter_frame_by_id`).  `view_busy` keeps a view-driven frame swap from re-entering
  // the state and looping forever.
  bool view_position = false;
  bool view_frame = false;
  bool view_enter = false;
  bool view_busy = false;
  // `run hook viewdata|viewdismiss`: the two lookup forwards (`dataset` /
  // `world_dataset`) and the fusion-split forward (`dismiss_fusion`) that only the real
  // state code reaches.  `viewdata` logs both lookups side by side so the frame /
  // world fallback split stays observable.
  bool view_data = false;
  bool view_dismiss = false;
  // `update()` 走的那四个状态钩子：`pre_update` / `update` / `on_landing` /
  // `on_leave_ground`（`run hook preupdate|stateupdate|landing|leaveground`）。
  bool pre_update = false;
  bool state_update = false;
  bool landing = false;
  bool leave_ground = false;
};
HookConfig g_hooks;

std::string fid(const Value& frame) { return render(lfw::field_or(frame, u"id")); }

std::string pos_of(const Entity& e) {
  return render(Value(e.position.x)) + "/" + render(Value(e.position.y)) + "/" +
         render(Value(e.position.z));
}

// 切片 4CF：`state::IStateEntity` 退役 —— 台面发到钩子上的就是实体自己（`lfw::Entity&`），
// 原来那层视图（`entity_self()` / `position(x,y,z)` / `frame_info()`）没有了，直接读实体的
// 公开面（`id` / `position` / `frame`）。
struct HarnessState : lfw::state::State_Base {
  explicit HarnessState(Value key) : State_Base(std::move(key)) {
    enter = [this](Entity& e, const Value& prev) {
      g_log.push_back(render(state()) + ">enter:" + s_of(e.id) + ":" + fid(e.frame) +
                      ":" + fid(prev) + ":hp=" + render(Value(e.hp())) +
                      ":hmax=" + render(Value(e.hp_max())) + ":mp=" + render(Value(e.mp())) +
                      ":ml=" + render(Value(e.motionless)) + ":sh=" + render(Value(e.shaking)) +
                      ":st=" + render(e.state()) + ":og=" + render(Value(e.is_on_ground)) +
                      ":team=" + render(Value(e.team())) + ":dt=" + render(e.data_type()) +
                      ":jx=" + render(e.jumping_x()) + ":vx=" + render(Value(e.velocity_x())) +
                      ":vy=" + render(Value(e.velocity_y())) + ":vz=" + render(Value(e.velocity_z())) +
                      ":pos=" + pos_of(e) + ":pf=" + fid(e.get_prev_frame()));
      // The state touches the entity on entry so the setters stay observable.
      e.set_motionless(e.motionless);
      e.set_hp_r(e.hp_r());
      if (!g_hooks.view_busy) {
        g_hooks.view_busy = true;
        if (g_hooks.view_position) e.set_position(Value(1.0), Value(2.0), Value(3.0));
        if (g_hooks.view_frame) {
          // a *different* frame object, so the swap is visible (TS `set_frame` reads
          // `v.id`, so passing `undefined` would throw there)
          const lfw::Object* src = lfw::as_object(e.frame);
          lfw::Object copy = src != nullptr ? *src : lfw::Object();
          copy.set(u"id", Value(std::u16string(u"w2")));
          e.set_frame(Value(std::make_shared<lfw::Object>(copy)));
        }
        if (g_hooks.view_enter) e.enter_frame_by_id(Value(std::u16string(u"auto")));
        if (g_hooks.view_data) {
          g_log.push_back("state_view_dataset:" + render(e.dataset(u"probe_key")) +
                          ":world=" + render(e.world_dataset(u"probe_key")));
        }
        if (g_hooks.view_dismiss) {
          e.dismiss_fusion(std::u16string(u"112"));
          g_log.push_back("state_view_dismiss:" + fid(e.frame));
        }
        g_hooks.view_busy = false;
      }
    };
    on_dead = [](Entity& e) {
      if (!g_hooks.dead) return;
      g_log.push_back("state_on_dead:" + s_of(e.id) + ":" + render(Value(e.hp_r())));
    };
    get_gravity = [](Entity&) -> Value {
      if (!g_hooks.gravity) return Value();
      return g_hooks.gravity_value;
    };
    find_frame_by_id = [](Entity&, const Value& id) -> Value {
      if (!g_hooks.find) return Value();
      if (g_hooks.find_echo) return id;
      return g_hooks.find_value;
    };
    get_auto_frame = [](Entity&) -> Value {
      if (!g_hooks.auto_frame) return Value();
      return g_hooks.auto_frame_value;
    };
    get_sudden_death_frame = [](Entity&) -> Value {
      if (!g_hooks.sudden) return Value();
      return g_hooks.sudden_value;
    };
    get_caught_end_frame = [](Entity&) -> Value {
      if (!g_hooks.caught) return Value();
      return g_hooks.caught_value;
    };
    pre_update = [](Entity& e) {
      if (!g_hooks.pre_update) return;
      g_log.push_back("state_pre_update:" + s_of(e.id) + ":" + render(Value(e.hp())));
    };
    on_landing = [](Entity& e, const Value& v) {
      if (!g_hooks.landing) return;
      g_log.push_back("state_on_landing:" + s_of(e.id) + ":" + render(v));
    };
    on_leave_ground = [](Entity& e) {
      if (!g_hooks.leave_ground) return;
      g_log.push_back("state_on_leave_ground:" + s_of(e.id));
    };
  }

  void update(Entity& e) override {
    if (!g_hooks.state_update) return;
    g_log.push_back("state_update:" + s_of(e.id) + ":" + render(Value(e.hp())));
  }

  void on_restrict(Entity& e, double x, double y, double z) override {
    g_log.push_back("state_on_restrict:" + s_of(e.id) + ":" + render(Value(x)) + ":" +
                    render(Value(y)) + ":" + render(Value(z)));
  }

  void leave(Entity& e, const Value& next) override {
    g_log.push_back(render(state()) + ">leave:" + s_of(e.id) + ":" + fid(next));
  }
};

std::string dump_states() {
  std::string out;
  bool first = true;
  for (const lfw::state::States::Entry& e : g_states.entries()) {
    if (!first) out += ",";
    first = false;
    out += render(e.key) + ":" + s_of(e.class_name);
  }
  return out;
}

// The `vrests` / `blockers` / `superpunchs` maps render as `["w1":14:3,…]`.  TS keeps
// them insertion-ordered (`Map`) where the port uses `std::map`, so the dump is sorted
// by key on both sides — the insertion order itself is not comparable.
std::string dump_collisions(const std::map<std::u16string, lfw::collision::Collision>& m) {
  std::string out = "[";
  bool first = true;
  for (const auto& kv : m) {
    if (!first) out += ",";
    first = false;
    out += render(Value(kv.first)) + ":" + render(lfw::field_or(kv.second.itr, u"kind")) + ":" +
           render(Value(kv.second.rest));
  }
  out += "]";
  return out;
}

// The four relation slots on both harness entities, so a back-pointer write on the
// *other* entity (`clean_holding` / `drop_catching`) is visible in the trace.
std::string rel_probe() {
  const Entity* a = g_entity.get();
  const Entity* b = g_buddy.get();
  std::string out;
  const bool flags[8] = {
      a != nullptr && a->holding != nullptr,  a != nullptr && a->bearer != nullptr,
      a != nullptr && a->catching != nullptr, a != nullptr && a->catcher != nullptr,
      b != nullptr && b->holding != nullptr,  b != nullptr && b->bearer != nullptr,
      b != nullptr && b->catching != nullptr, b != nullptr && b->catcher != nullptr};
  for (bool f : flags) {
    if (!out.empty()) out += " ";
    out += render(Value(f));
  }
  return out;
}

// Snapshot buffers: `run snapbuf` fills them from `to_snapshot`, `run snappoke`
// edits a slot and `run snapapply` feeds them back through `read_snapshot`.
std::vector<Value> g_snap_nums(static_cast<std::size_t>(lfw::entity::num_slots()));
std::vector<std::u16string> g_snap_strs(static_cast<std::size_t>(lfw::entity::str_slots()));

std::string render_num_slots(const std::vector<Value>& nums) {
  std::string s;
  for (std::size_t k = 0; k < nums.size(); ++k) {
    if (k != 0) s += ",";
    s += render(nums[k]);
  }
  return s;
}

std::string render_str_slots(const std::vector<std::u16string>& strs) {
  std::string s;
  for (std::size_t k = 0; k < strs.size(); ++k) {
    if (k != 0) s += ",";
    s += render(Value(strs[k]));
  }
  return s;
}

std::size_t nslot_index(const std::string& name) {
  for (const lfw::EnumNumberEntry& e : lfw::entity::nslot_entries()) {
    if (s_of(e.name) == name) return static_cast<std::size_t>(e.value);
  }
  std::fprintf(stderr, "unknown nslot '%s'\n", name.c_str());
  std::exit(2);
}

std::size_t sslot_index(const std::string& name) {
  for (const lfw::EnumNumberEntry& e : lfw::entity::sslot_entries()) {
    if (s_of(e.name) == name) return static_cast<std::size_t>(e.value);
  }
  std::fprintf(stderr, "unknown sslot '%s'\n", name.c_str());
  std::exit(2);
}

Value field_of(const Value& v, const std::u16string& key) {
  const lfw::Object* o = lfw::as_object(v);
  if (o == nullptr) return Value();
  const Value* p = o->get(key);
  return p != nullptr ? *p : Value();
}

std::u16string text_of(const Value& v) {
  const std::u16string* s = std::get_if<std::u16string>(&v);
  return s != nullptr ? *s : lfw::to_string(v);
}

// `v ?? null` for the nullable slots (`dismiss_time`): nullish → `nullopt`.
std::optional<double> opt_num_of(const Value& v) {
  if (std::holds_alternative<std::monostate>(v) || std::holds_alternative<lfw::NullTag>(v)) {
    return std::nullopt;
  }
  return std::optional<double>(lfw::to_number(v));
}

// `catching` / `catcher` / `bearer` / `holding` render as `{id}` (or `null`) so the
// two sides print the same thing without dumping a whole entity.
Value id_ref(const Entity* e) {
  if (e == nullptr) return Value(lfw::NullTag{});
  lfw::Object o;
  o.set(u"id", Value(e->id));
  return Value(std::make_shared<lfw::Object>(o));
}

// `run keys` / `run bkeys` 尾部可以再跟任意个单键名（`a` / `j` / `d` / …）：`update` 的
// `check_fusion_dismissing` 要 `sametime_keys_test("dja")` / `sequence_keys_test("ja")`，
// 它需要的 `a` 用 `lr/ud/jd` 三个参数表达不了。返回拼好的命令后缀（`" a j"`）。
bool hit_extra_keys(lfw::controller::BaseController* c, const std::vector<std::string>& t,
                    std::size_t& i, int lineno, std::string& out) {
  while (i < t.size()) {
    const std::string& name = t[i++];
    lfw::controller::KeyStatus* slot = nullptr;
    if (name == "L") slot = &c->keys.L;
    else if (name == "R") slot = &c->keys.R;
    else if (name == "U") slot = &c->keys.U;
    else if (name == "D") slot = &c->keys.D;
    else if (name == "d") slot = &c->keys.d;
    else if (name == "j") slot = &c->keys.j;
    else if (name == "a") slot = &c->keys.a;
    if (slot == nullptr) {
      std::fprintf(stderr, "unknown key '%s' at line %d\n", name.c_str(), lineno);
      return false;
    }
    slot->hit(Value(1.0), 0.0);
    out += " " + name;
  }
  return true;
}

std::u16string ctrl_mark(const Value& v) {
  if (std::holds_alternative<std::monostate>(v)) return u"u";
  if (lfw::truthy(field_of(v, u"__is_human_ctrl__"))) return u"human";
  if (lfw::truthy(field_of(v, u"__is_bot_ctrl__"))) return u"bot";
  return u"base";
}

std::u16string ctrl_mark(const lfw::controller::BaseController* c) {
  if (c == nullptr) return u"u";
  if (c->is_human()) return u"human";
  if (c->is_bot()) return u"bot";
  return u"base";
}

std::string who(const Entity& e, const std::vector<Value>& args, std::size_t idx) {
  if (idx >= args.size()) return "?";
  const std::u16string id = lfw::to_string(field_of(args[idx], u"id"));
  return id == e.id ? "self" : "?";
}

// kind: 0 = base (the factory's `InvalidController`), 1 = human (`LocalController`),
// 2 = bot (`BotController`), 3 = human without a player name; the flags/`set_kind`
// pair is what `is_*_ctrl` reads. The pids mirror the TS harness: `reset()` acquires
// its `InvalidController` with `""` (`Entity.ts:692`), humans/bots carry "7".
lfw::controller::BaseController* make_ctrl(int kind) {
  auto c = std::make_unique<lfw::controller::BaseController>();
  c->set_kind(kind == 1 || kind == 3, kind == 2);
  c->player_id = kind == 3 ? u"9" : (kind == 0 ? std::u16string() : u"7");
  if (kind == 1) {
    lfw::Object player;
    player.set(u"id", Value(7.0));
    player.set(u"name", Value(std::u16string(u"P7")));
    c->player = Value(std::make_shared<lfw::Object>(player));
  } else if (kind == 3) {
    lfw::Object player;
    player.set(u"id", Value(9.0));
    c->player = Value(std::make_shared<lfw::Object>(player));
  }
  lfw::controller::BaseController* raw = c.get();
  g_ctrls.push_back(std::move(c));
  return raw;
}

// `world.entity_map.get(id) ?? null` — answered from the live harness entities so a
// `reset` (new id) never leaves a stale lookup behind.
Entity* fixture_find_entity(const std::u16string& id) {
  if (g_entity != nullptr && g_entity->id == id) return g_entity.get();
  if (g_buddy != nullptr && g_buddy->id == id) return g_buddy.get();
  return nullptr;
}

// 切片 4CJ：`IEntityHost` 退役 ⇒ 旧假宿主那 30 条缝按新家拆成两半：
//   * 实体读 `this.world.*` 的一批 → `TestWorld` 的脚本钩子（`bind_world()`，与 TS 的
//     `worldStub` 一一对应）；
//   * 实体读 `this.lfw.*` 的一批 → 自带一份假 `lfw`（`EntityLfw`，对应 TS 的 `lfwStub`）。
// 世界是真 `lfw::World`（喂假 `lfw` + 假 renderer）。`this.world.dataset` 也是真的
//（TS 台面同样用真 `WorldDataset`）⇒ `env dataset` 直接写世界的 `dataset`。
std::function<Entity*(const Value&)> g_make_entity;

struct EntityLfw : fx::FakeLfw {
  std::u16string new_team() override { return g_team; }

  std::u16string new_id() override {
    ++g_id_counter;
    return u"e" + lfw::number_to_string(static_cast<double>(g_id_counter));
  }

  lfw::controller::BaseController* acquire_invalid_ctrl(lfw::World& world) override {
    (void)world;
    g_log.push_back("acquire_ctrl");
    lfw::controller::BaseController* c = make_ctrl(0);
    if (g_ball_ctrl) c->set_ball(true);
    return c;
  }

  void release_ctrl(lfw::controller::BaseController* c) override {
    g_log.push_back("release_ctrl:" + s_of(ctrl_mark(c)));
  }

  lfw::controller::BaseController* create_ctrl(const std::u16string& data_id,
                                              const std::u16string& player_id) override {
    g_log.push_back("create_ctrl:" + render(Value(data_id)) + ":" + render(Value(player_id)));
    return make_ctrl(0);
  }

  lfw::MersenneTwister* mt() override { return &g_mt; }

  void broadcast(const Value& m) override { g_log.push_back("broadcast:" + render(m)); }

  // `lfw.datas.find(id)`
  Value datas_find(const Value& oid) override {
    return field_of(g_datas, lfw::to_string(oid));
  }

  std::optional<std::u16string> game_mode() const override {
    return g_rank_mode ? std::optional<std::u16string>(lfw::game_mode::kSurvivalRank1P)
                       : std::nullopt;
  }
  bool survival_rank_available() const override { return g_rank_avail; }

  // `lfw.is_cheat(name)`：TS 是 `is_cheat_type(name) && !!world.dataset[name]`，
  // 名字只可能是 `LF2_NET` / `HERO_FT` / `GIM_INK`（表里写死的），所以这里只查开关。
  bool is_cheat(const std::u16string& name) override {
    for (const std::u16string& n : g_cheats) {
      if (n == name) return true;
    }
    return false;
  }

  // `lfw.factory.create_entity_with_bot("", this.world, data)`（端口收成
  // `IWorldLfw::create_entity`）：新实体的 id 来自 `new_id()`（与 TS 的 `lfw.new_id`
  // 同一个计数器）。真正的构造挂在 `g_make_entity` 上（空间上它后面才定义）。
  Entity* create_entity(lfw::World& world, const Value& data) override {
    return create_entity_with_bot(std::u16string(), world, data);
  }

  // TS 台面的假 `lfw.factory.create_entity_with_bot` 只记一行 `create_entity_with_bot:<data>`
  // 然后造实体（工厂里没注册任何 oid ⇒ 真 `create_ctrl` 回 null、也不记 `acquire_ctrl`）。
  // 端口这边同理：**不要**转去假的 `create_ctrl`（那会多记一行 `create_ctrl:`）。
  Entity* create_entity_with_bot(const std::u16string& player_id, lfw::World& world,
                                 const Value& data) override {
    (void)player_id;
    (void)world;
    g_log.push_back("create_entity_with_bot:" + render(data));
    return g_make_entity != nullptr ? g_make_entity(data) : nullptr;
  }
};

EntityLfw g_lfw;

// 台面世界（Meyers 单例）。名字带 `test_` 前缀是刻意的：`lfw::Entity` 自己有 `world()`
// 成员，派生类的构造初始化列表里写裸 `world()` 会解析到那个成员。
fx::TestWorld& test_world() {
  static fx::TestWorld w(g_lfw, fx::g_renderer, &g_states);
  return w;
}

// `this.world.*` 那批旧缝（逐条与 `Host` 的覆写对应）。
void bind_world() {
  fx::TestWorld& w = test_world();
  // `world.bg.data.dataset?.[key]`
  w.on_bg_dataset = [](const std::u16string& key) { return field_of(g_bg_dataset, key); };
  // `world.stage.player_l` / `player_r` / `far` / `near`（`env stage <key> <值>`；没设过
  // 就是 `undefined`，与 TS 里缺字段同形）。
  w.on_stage_value = [](const std::u16string& key) -> Value {
    for (const auto& kv : g_stage) {
      if (kv.first == key) return kv.second;
    }
    return Value();
  };
  // `world.bg.width` / `.near` / `.far`：TS 台面的 `worldStub.bg` 没有这三条 ⇒ 恒 `undefined`。
  w.on_bg_value = [](const std::u16string& key) -> Value {
    (void)key;
    return Value();
  };
  // `world.entities.length + world.ghosts.length`（`spawn` 的 unimportant 门）
  w.on_entity_count = []() { return g_ecount; };
  // `world.puppets.values()`：`env puppets …` 指的名单（`self` / `buddy` / `sp<N>`）。
  w.on_puppets_values = []() {
    std::vector<Entity*> out;
    for (const std::string& tok : g_puppet_tokens) {
      Entity* e = candidate_of(tok);
      if (e != nullptr) out.push_back(e);
    }
    g_log.push_back("puppets:" + join(g_puppet_tokens));
    return out;
  };
  w.on_find_entity = [](const std::u16string& id) { return fixture_find_entity(id); };
  // `world.add_entities(this)`（`attach`）——把实体挂进世界的那一刻，`_spawn_time`
  // 已经写好，所以日志里带上它。
  w.on_add_entities = [](Entity& e) {
    g_log.push_back("add_entities:" + s_of(e.id) + ":" + render(Value(e.spawn_time())));
  };
  // `world.get_bound(this)`：TS 台面没这条面 ⇒ 旧的宿主缝默认值 `[0,0,0,0]`。
  w.on_get_bound = [](Entity& e) -> std::vector<double> {
    (void)e;
    return {0.0, 0.0, 0.0, 0.0};
  };
  w.on_play_sound = [](const Value& sounds, const Value& pos) {
    g_log.push_back("play_sound:" + render(sounds) + "@" + render(pos));
  };
  // `opoint.__gen_x?.get(emitter)` 这类表达式字段：TS 里是编译出来的函数对象，
  // 端口按既有约定不移植（DESIGN §4.57）⇒ 场景用 `env gen` 注册一个常量生成器。
  w.on_gen_field = [](const Value& holder, const std::u16string& kind,
                      Entity& emitter) -> std::optional<Value> {
    (void)holder;
    (void)emitter;
    for (const auto& kv : g_gen) {
      if (kv.first == kind) return kv.second;
    }
    return std::nullopt;
  };
  // `world.list_entities(key, predicate)`（`apply_opoints` 的 multi 计数）：候选实体由
  // `env ents …`（`self` / `buddy` / `sp<N>`）指定，谓词由端口提供；`World` 那层按 key
  // 缓存一份数组的行为属于 World 切片，这里每次真筛（两侧一致即可）。
  w.on_list_entities = [](const std::u16string& key,
                          const std::function<bool(Entity&)>& predicate) {
    std::vector<Entity*> out;
    for (const std::string& tok : g_candidate_tokens) {
      Entity* e = candidate_of(tok);
      if (e != nullptr && predicate(*e)) out.push_back(e);
    }
    g_log.push_back("list_entities:" + s_of(key) + ":" + std::to_string(out.size()));
    return out;
  };
  w.on_mark_players_alive = [](Entity& e, bool alive) {
    (void)e;
    g_log.push_back("mark_players_alive:" + render(Value(alive)));
  };
  // `world.restrict(this)`: the scene programs the answer, or `run restrict none`
  // leaves the position untouched (the real clamp lives in World).
  w.on_restrict = [](Entity& e) -> lfw::Vector3 {
    if (std::holds_alternative<std::monostate>(g_restrict_result) ||
        std::holds_alternative<lfw::NullTag>(g_restrict_result)) {
      return e.position;
    }
    lfw::Vector3 r;
    r.x = lfw::to_number(lfw::field_or(g_restrict_result, u"x"));
    r.y = lfw::to_number(lfw::field_or(g_restrict_result, u"y"));
    r.z = lfw::to_number(lfw::field_or(g_restrict_result, u"z"));
    return r;
  };
  w.on_game_time = []() { return g_gtime; };
}

// `EntityLfw::create_entity` 的实体：id 走 `new_id()`，与 TS 的 `lfw.new_id` 同一个计数器。
void bind_entity_factory() {
  g_make_entity = [](const Value& data) -> Entity* {
    auto e = std::make_unique<Entity>(test_world(), data, &g_states);
    Entity* raw = e.get();
    g_spawns.push_back(std::move(e));
    g_last_spawn = raw;
    return raw;
  };
}

void bind_callbacks(Entity& e) {
  e.callbacks.on(u"on_hp_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_hp_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" + render(a[2]));
  });
  e.callbacks.on(u"on_hp_max_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_hp_max_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" +
                    render(a[2]));
  });
  e.callbacks.on(u"on_mp_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_mp_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" + render(a[2]));
  });
  e.callbacks.on(u"on_mp_max_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_mp_max_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" +
                    render(a[2]));
  });
  e.callbacks.on(u"on_hp_r_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_hp_r_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" +
                    render(a[2]));
  });
  e.callbacks.on(u"on_team_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_team_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" +
                    render(a[2]));
  });
  e.callbacks.on(u"on_name_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_name_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" +
                    render(a[2]));
  });
  e.callbacks.on(u"on_dead", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_dead:" + who(e, a, 0));
  });
  e.callbacks.on(u"on_ctrl_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_ctrl_changed:" + s_of(ctrl_mark(a[0])) + ":" + s_of(ctrl_mark(a[1])) +
                    ":" + who(e, a, 2));
  });
  e.callbacks.on(u"on_reserve_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_reserve_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" +
                    render(a[2]));
  });
  e.callbacks.on(u"on_resting_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_resting_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" +
                    render(a[2]));
  });
  e.callbacks.on(u"on_resting_max_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_resting_max_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" +
                    render(a[2]));
  });
  e.callbacks.on(u"on_fall_value_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_fall_value_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" +
                    render(a[2]));
  });
  e.callbacks.on(u"on_fall_value_max_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_fall_value_max_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" +
                    render(a[2]));
  });
  e.callbacks.on(u"on_defend_value_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_defend_value_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" +
                    render(a[2]));
  });
  e.callbacks.on(u"on_defend_value_max_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_defend_value_max_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" +
                    render(a[2]));
  });
  e.callbacks.on(u"on_toughness_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_toughness_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" +
                    render(a[2]));
  });
  e.callbacks.on(u"on_toughness_max_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_toughness_max_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" +
                    render(a[2]));
  });
  e.callbacks.on(u"on_catch_time_max_changed", [&e](const lfw::Callbacks::Payloads& a) {
    g_log.push_back("on_catch_time_max_changed:" + who(e, a, 0) + ":" + render(a[1]) + ":" +
                    render(a[2]));
  });
}

// Harness-side peek at the stat slots TS keeps private; the TS harness reads the same
// names off the real entity (see PROTOCOL).
Value stat_slots(const Entity& e) {
  lfw::Object o;
  o.set(u"catch_time", Value(e.catch_time()));
  o.set(u"toughness_r_value", Value(e.toughness_r_value()));
  o.set(u"fall_r_value", Value(e.fall_r_value()));
  o.set(u"defend_r_value", Value(e.defend_r_value()));
  o.set(u"toughness_r_tick_max", Value(e.toughness_r_tick_max()));
  o.set(u"hp_r_tick_max", Value(e.hp_r_tick_max()));
  o.set(u"mp_r_tick_max", Value(e.mp_r_tick_max()));
  o.set(u"fall_r_tick_max", Value(e.fall_r_tick_max()));
  o.set(u"defend_r_tick_max", Value(e.defend_r_tick_max()));
  return Value(std::make_shared<lfw::Object>(o));
}

std::string join(const std::vector<std::string>& xs) {
  std::string out;
  for (std::size_t i = 0; i < xs.size(); ++i) {
    if (i) out += ",";
    out += xs[i];
  }
  return out;
}

Value arr_of(const std::vector<Value>& xs) {
  lfw::Array a;
  for (const Value& v : xs) a.push_back(v);
  return Value(std::make_shared<lfw::Array>(a));
}

Value role_probe(const Entity& e) {
  return arr_of({Value(e.name_visible), Value(e.wakeup_invuln), Value(e.dead_gone)});
}

Value vec3_value(const lfw::Vector3& v) {
  lfw::Object o;
  o.set(u"x", Value(v.x));
  o.set(u"y", Value(v.y));
  o.set(u"z", Value(v.z));
  return Value(std::make_shared<lfw::Object>(o));
}

// `run spawn|spawnv|attach` 的观察点：被创建/挂载的那个实体的关键槽位。
// 关系用 `{id}`（与 `idRef` 的 TS 侧一致），没有就是 `null`。
std::string dump_spawn(const Entity* e) {
  if (e == nullptr) return "none";
  const auto id_ref = [](const Entity* p) -> Value {
    if (p == nullptr) return Value(lfw::NullTag{});
    lfw::Object o;
    o.set(u"id", Value(p->id));
    return Value(std::make_shared<lfw::Object>(o));
  };
  lfw::Array emitters;
  for (const std::u16string& id : e->emitters) emitters.push_back(Value(id));
  const lfw::controller::BaseController* ctrl = e->ctrl();
  return "id=" + s_of(e->id) + " pos=" + render(vec3_value(e->position)) +
         " pv=" + render(vec3_value(e->prev_position)) +
         " v=" + render(vec3_value(e->velocity)) +
         " pvv=" + render(vec3_value(e->prev_velocity)) +
         " team=" + render(Value(e->team())) + " facing=" + render(Value(e->facing)) +
         " frame=" + render(lfw::field_or(e->frame, u"id")) +
         " motionless=" + render(Value(e->motionless)) +
         " hp=" + render(e->hp()) + " hp_r=" + render(e->hp_r()) +
         " hp_max=" + render(e->hp_max()) + " mp=" + render(e->mp()) +
         " mp_max=" + render(e->mp_max()) +
         " emitters=" + render(Value(std::make_shared<lfw::Array>(emitters))) +
         " bearer=" + render(id_ref(e->bearer)) + " holding=" + render(id_ref(e->holding)) +
         " mounted=" + render(Value(e->mounted())) +
         " ghosted=" + render(Value(e->ghosted())) +
         " spawn_time=" + render(Value(e->spawn_time())) +
         " ground_y=" + render(Value(e->ground_y())) +
         " on_ground=" + render(Value(e->is_on_ground)) +
         // `is_ball_ctrl(ctrl)` 与 `ctrl.chasing`：两个都打（`chasing` 不因「不是 ball ctrl」
         // 而隐藏，否则「往基控制器上写 chasing」这类变异看不见）。
         // 端口里 `chasing` 是**实体引用**（`entity/entity_ref.h`），TS 那边是活实体
         // （`idRef` 把它打成 `{ id }`）⇒ 这里照着打同样的东西。
         " ball=" + render(Value(ctrl != nullptr && ctrl->is_ball_ctrl())) +
         " chasing=" + render(chasing_probe(ctrl));
}

// `run update` / `run updateg` 的观察点：`update` 自己写的槽位（时钟、五组计数、
// 记账表、落地帧、抓人关系）+ `dump_spawn` 的那一组。
std::string dump_opoints(const std::vector<std::pair<Value, double>>& ops);
// `landing_frame`：`null` 打成 `z`（TS 的 `null`），帧对象打成它的 `id`。
std::string fid_or_null(const Value& f) {
  return std::holds_alternative<lfw::NullTag>(f) ? "z" : fid(f);
}
std::string dump_tick(const Entity& e) {
  const auto id_ref = [](const Entity* p) -> Value {
    if (p == nullptr) return Value(lfw::NullTag{});
    lfw::Object o;
    o.set(u"id", Value(p->id));
    return Value(std::make_shared<lfw::Object>(o));
  };
  const Value prev_cp = e.prev_cpoint_a();
  return "at=" + render(Value(e.atom_time())) + " life=" + render(Value(e.lifetime())) +
         " wait=" + render(Value(e.wait)) + " mticks=" + render(Value(e.motionless_ticks())) +
         " blink=" + render(Value(e.blinking())) + " after=" +
         render(e.after_blink().has_value() ? Value(*e.after_blink()) : Value(lfw::NullTag{})) +
         " inv=" + render(Value(e.invisible())) + " invu=" + render(Value(e.invulnerable())) +
         " arest=" + render(Value(e.arest())) + " catch=" + render(Value(e.catch_time())) +
         " throwinj=" + render(Value(e.throwinjury)) +
         " fallinj=" + render(Value(e.fallinjury)) +
         " on_ground=" + render(Value(e.is_on_ground)) +
         " landing=" + fid_or_null(e.landing_frame()) + " prev_cp=" +
         render(std::holds_alternative<lfw::NullTag>(prev_cp) ? Value(lfw::NullTag{})
                                                             : prev_cp) +
         " fuse=" + render(Value(static_cast<double>(e.fuse_bys.size()))) +
         " aabb=" + render(Value(e.aabb_min_x)) + "," + render(Value(e.aabb_max_x)) + "," +
         render(Value(e.aabb_min_z)) + "," + render(Value(e.aabb_max_z)) +
         " lr=" + render(Value(e.l_len)) + "," + render(Value(e.r_len)) +
         " frame=" + render(lfw::field_or(e.frame, u"id")) +
         " pos=" + render(vec3_value(e.position)) +
         " pv=" + render(vec3_value(e.prev_position)) +
         " v=" + render(vec3_value(e.velocity)) +
         " pvv=" + render(vec3_value(e.prev_velocity)) +
         " hp=" + render(e.hp()) + " hp_r=" + render(e.hp_r()) + " mp=" + render(e.mp()) +
         " team=" + render(Value(e.team())) + " facing=" + render(Value(e.facing)) +
         " motionless=" + render(Value(e.motionless)) + " shaking=" + render(Value(e.shaking)) +
         " catcher=" + render(id_ref(e.catcher)) + " catching=" + render(id_ref(e.catching)) +
         " fromwait=" + render(Value(e.from_wait_block())) +
         " n=" + std::to_string(e.opoints.size()) + " itv=" + dump_opoints(e.opoints);
}

// 第二个实体的观察点：`update` 里只写对方的那几处（`check_fusion_dismissing` /
// `dismiss_fusion` 的成员循环、`update_catching` 的 `caught->*`、`follow_catcher`）。
std::string dump_buddy(const Entity* b) {
  if (b == nullptr) return "z";
  const Value prev_cp = b->prev_cpoint_a();
  return "hp=" + render(b->hp()) + " hp_r=" + render(b->hp_r()) + " mp=" + render(b->mp()) +
         " frame=" + render(lfw::field_or(b->frame, u"id")) +
         " pos=" + render(vec3_value(b->position)) +
         " v=" + render(vec3_value(b->velocity)) +
         " facing=" + render(Value(b->facing)) + " inv=" + render(Value(b->invisible())) +
         " invu=" + render(Value(b->invulnerable())) +
         " ml=" + render(Value(b->motionless)) +
         " prev_cp=" + render(std::holds_alternative<lfw::NullTag>(prev_cp)
                                  ? Value(lfw::NullTag{})
                                  : prev_cp) +
         " catcher=" + render(id_ref(b->catcher)) + " catching=" + render(id_ref(b->catching));
}

// `this._opoints` 的记账转储：`interval_id:tick` 对（`interval_id` 缺失写成 `-`）。
std::string dump_opoints(const std::vector<std::pair<Value, double>>& ops) {  std::string out;
  for (std::size_t i = 0; i < ops.size(); ++i) {
    if (i > 0) out += ",";
    const Value id = lfw::field_or(ops[i].first, u"interval_id");
    out += std::holds_alternative<std::monostate>(id) ? "-" : render(id);
    out += ":";
    out += render(Value(ops[i].second));
  }
  return out;
}

bool get_num(const Entity& e, const std::string& name, double& out) {
  if (name == "lifetime") out = e.lifetime();
  else if (name == "spawn_time") out = e.spawn_time();
  else if (name == "render_effect_time") out = e.render_effect_time();
  else if (name == "outline_alpha") out = e.outline_alpha();
  else if (name == "outline_width") out = e.outline_width();
  else if (name == "mix_strength") out = e.mix_strength();
  else if (name == "greyscale") out = e.greyscale();
  else if (name == "ground_y") out = e.ground_y();
  else if (name == "mounted") out = e.mounted();
  else if (name == "ghosted") out = e.ghosted();
  else if (name == "reserve") out = e.reserve();
  else if (name == "toughness_resting_max") out = e.toughness_resting_max();
  else if (name == "resting_max") out = e.resting_max();
  else if (name == "resting") out = e.resting();
  else if (name == "fall_value") out = e.fall_value();
  else if (name == "toughness") out = e.toughness();
  else if (name == "toughness_max") out = e.toughness_max();
  else if (name == "toughness_resting") out = e.toughness_resting();
  else if (name == "catch_time_max") out = e.catch_time_max();
  else if (name == "fall_value_max") out = e.fall_value_max();
  else if (name == "defend_value") out = e.defend_value();
  else if (name == "defend_value_max") out = e.defend_value_max();
  else if (name == "defend_ratio") out = e.defend_ratio();
  else if (name == "mp") out = e.mp();
  else if (name == "hp_r") out = e.hp_r();
  else if (name == "hp") out = e.hp();
  else if (name == "mp_max") out = e.mp_max();
  else if (name == "hp_max") out = e.hp_max();
  else if (name == "blinking") out = e.blinking();
  else if (name == "invisible") out = e.invisible();
  else if (name == "invulnerable") out = e.invulnerable();
  else if (name == "arest") out = e.arest();
  else if (name == "catch_time") out = e.catch_time();
  else if (name == "gravity") out = e.gravity();
  else if (name == "itr_motionless") out = e.itr_motionless();
  else if (name == "weight") out = e.weight();
  else if (name == "base_type") out = e.base_type();
  else if (name == "type") out = e.type();
  else if (name == "variant") out = e.variant;
  else if (name == "wait") out = e.wait;
  else if (name == "stat_bar") out = e.stat_bar;
  else if (name == "facing") out = e.facing;
  else if (name == "motionless") out = e.motionless;
  else if (name == "shaking") out = e.shaking;
  else if (name == "fallinjury") out = e.fallinjury;
  else if (name == "throwinjury") out = e.throwinjury;
  else if (name == "name_visible") out = e.name_visible;
  else if (name == "wakeup_invuln") out = e.wakeup_invuln;
  else if (name == "dead_gone") out = e.dead_gone;
  else if (name == "ctrl_visible") out = e.ctrl_visible;
  else if (name == "puppet") out = e.puppet ? 1.0 : 0.0;
  else if (name == "is_on_ground") out = e.is_on_ground ? 1.0 : 0.0;
  else if (name == "transform_index") out = e.transform_index;
  else if (name == "jumping.x") out = e.jumping.x;
  else if (name == "jumping.y") out = e.jumping.y;
  else if (name == "jumping.z") out = e.jumping.z;
  else if (name == "jumping.t") out = e.jumping.t;
  else if (name == "aabb_min_x") out = e.aabb_min_x;
  else if (name == "aabb_max_x") out = e.aabb_max_x;
  else if (name == "l_len") out = e.l_len;
  else if (name == "r_len") out = e.r_len;
  else if (name == "atom_time") out = e.atom_time();
  else if (name == "from_wait_block") out = e.from_wait_block() ? 1.0 : 0.0;
  else return false;
  return true;
}

bool get_value(const Entity& e, const std::string& name, Value& out) {
  if (name == "outline_color") out = Value(e.outline_color());
  else if (name == "mix_color") out = Value(e.mix_color());
  else if (name == "outline_enabled") out = e.outline_enabled();
  else if (name == "name") out = e.name();
  else if (name == "team") out = Value(e.team());
  else if (name == "origin_data_id") out = Value(e.origin_data_id());
  else if (name == "group") out = e.group();
  else if (name == "bot_ignore") out = e.bot_ignore();
  else if (name == "state") out = e.state();
  else if (name == "armor") out = e.armor;
  else if (name == "dead_join") out = e.dead_join;
  else if (name == "transforms") out = e.transforms;
  else if (name == "itr") out = e.itr();
  else if (name == "bdy") out = e.bdy();
  else if (name == "frame") out = e.frame;
  else if (name == "prev_frame") out = e.get_prev_frame();
  else if (name == "data") out = e.data();
  else if (name == "emitter") {
    const std::u16string* p = e.emitter();
    out = p != nullptr ? Value(*p) : Value();
  } else if (name == "src_emitter") {
    const std::u16string* p = e.src_emitter();
    out = p != nullptr ? Value(*p) : Value();
  } else if (name == "drink") out = e.drink != nullptr ? Value(true) : Value();
  else if (name == "id") out = Value(e.id);
  else if (name == "ref") out = e.ref();
  else if (name == "velocity") out = vec3_value(e.velocity);
  else if (name == "prev_velocity") out = vec3_value(e.prev_velocity);
  else if (name == "position") out = vec3_value(e.position);
  else if (name == "prev_position") out = vec3_value(e.prev_position);
  else if (name == "dvx") out = e.dvx();
  else if (name == "dvy") out = e.dvy();
  else if (name == "dvz") out = e.dvz();
  else if (name == "landing_frame") out = e.landing_frame();
  else if (name == "dismiss_time")
    out = e.dismiss_time.has_value() ? Value(*e.dismiss_time) : Value(lfw::NullTag{});
  else if (name == "dismiss_data") out = e.dismiss_data;
  else if (name == "catching") out = id_ref(e.catching);
  else if (name == "catcher") out = id_ref(e.catcher);
  else if (name == "bearer") out = id_ref(e.bearer);
  else if (name == "holding") out = id_ref(e.holding);
  else if (name == "ctrl")
    out = e.ctrl() != nullptr ? Value(ctrl_mark(e.ctrl())) : Value();
  else return false;
  return true;
}

bool set_num(Entity& e, const std::string& name, double v) {
  if (name == "outline_alpha") e.set_outline_alpha(v);
  else if (name == "atom_time") e.set_atom_time(v);
  else if (name == "outline_width") e.set_outline_width(v);
  else if (name == "mix_strength") e.set_mix_strength(v);
  else if (name == "greyscale") e.set_greyscale(v);
  else if (name == "ghosted") e.set_ghosted(v);
  else if (name == "reserve") e.set_reserve(v);
  else if (name == "toughness_resting_max") e.set_toughness_resting_max(v);
  else if (name == "resting_max") e.set_resting_max(v);
  else if (name == "resting") e.set_resting(v);
  else if (name == "fall_value") e.set_fall_value(v);
  else if (name == "toughness") e.set_toughness(v);
  else if (name == "toughness_max") e.set_toughness_max(v);
  else if (name == "toughness_resting") e.set_toughness_resting(v);
  else if (name == "catch_time_max") e.set_catch_time_max(v);
  else if (name == "fall_value_max") e.set_fall_value_max(v);
  else if (name == "defend_value") e.set_defend_value(v);
  else if (name == "defend_value_max") e.set_defend_value_max(v);
  else if (name == "defend_ratio") e.set_defend_ratio(v);
  else if (name == "mp") e.set_mp(v);
  else if (name == "hp_r") e.set_hp_r(v);
  else if (name == "hp") e.set_hp(v);
  else if (name == "mp_max") e.set_mp_max(v);
  else if (name == "hp_max") e.set_hp_max(v);
  else if (name == "blinking") e.set_blinking(v);
  else if (name == "invisible") e.set_invisible(v);
  else if (name == "invulnerable") e.set_invulnerable(v);
  else if (name == "arest") e.set_arest(v);
  else if (name == "catch_time") e.set_catch_time(v);
  else if (name == "variant") e.variant = v;
  else if (name == "wait") e.wait = v;
  else if (name == "stat_bar") e.stat_bar = v;
  else if (name == "facing") e.facing = v;
  else if (name == "motionless") e.motionless = v;
  else if (name == "shaking") e.shaking = v;
  else if (name == "fallinjury") e.fallinjury = v;
  else if (name == "throwinjury") e.throwinjury = v;
  else if (name == "name_visible") e.name_visible = v;
  else if (name == "wakeup_invuln") e.wakeup_invuln = v;
  else if (name == "dead_gone") e.dead_gone = v;
  else if (name == "ctrl_visible") e.ctrl_visible = v;
  else if (name == "puppet") e.puppet = lfw::truthy(Value(v));
  else if (name == "is_on_ground") e.is_on_ground = lfw::truthy(Value(v));
  else if (name == "transform_index") e.transform_index = v;
  else if (name == "jumping.x") e.jumping.x = v;
  else if (name == "jumping.y") e.jumping.y = v;
  else if (name == "jumping.z") e.jumping.z = v;
  else if (name == "jumping.t") e.jumping.t = v;
  else return false;
  return true;
}

bool set_value(Entity& e, const std::string& name, const Value& v) {
  if (name == "outline_color") e.set_outline_color(text_of(v));
  else if (name == "mix_color") e.set_mix_color(text_of(v));
  else if (name == "outline_enabled") e.set_outline_enabled(v);
  else if (name == "name") e.set_name(v);
  else if (name == "team") e.set_team(text_of(v));
  else if (name == "dismiss_time") e.dismiss_time = opt_num_of(v);
  else if (name == "dismiss_data") e.dismiss_data = v;
  else if (name == "landing_frame") e.set_landing_frame(v);
  else if (name == "transforms") e.transforms = v;
  else if (name == "dead_join") e.dead_join = v;
  else return false;
  return true;
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_entity <case-file>\n");
    return 2;
  }

  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "cannot open case file: %s\n", argv[1]);
    return 2;
  }

  // 世界（真 `lfw::World`）与它的脚本钩子先立起来：实体构造时就要问它。
  bind_world();
  bind_entity_factory();
  cv_reset();
  {
    lfw::Object o;
    g_bg_dataset = Value(std::make_shared<lfw::Object>(o));
  }

  std::string raw;
  int lineno = 0;
  while (std::getline(in, raw)) {
    ++lineno;
    const std::vector<std::string> t = split_ws(trace::strip_comment(raw));
    if (t.empty()) continue;
    const std::string& op = t[0];
    std::size_t i = 1;
    g_log.clear();
    if (op == "env") {
      const std::string& sub = t[i++];
      if (sub == "dataset") {
        const std::u16string key = text_of(parse_value(t, i));
        test_world().dataset.set(key, parse_value(t, i));
      } else if (sub == "bg") {
        const std::u16string key = text_of(parse_value(t, i));
        lfw::Object* o = lfw::as_object(g_bg_dataset);
        o->set(key, parse_value(t, i));
      } else if (sub == "team") {
        g_team = text_of(parse_value(t, i));
      } else if (sub == "data") {
        const std::u16string id = text_of(parse_value(t, i));
        lfw::Object* o = lfw::as_object(g_datas);
        o->set(id, parse_value(t, i));
      } else if (sub == "ecount") {
        g_ecount = lfw::to_number(parse_value(t, i));
      } else if (sub == "gtime") {
        g_gtime = lfw::to_number(parse_value(t, i));
      } else if (sub == "gen") {
        const std::u16string kind = text_of(parse_value(t, i));
        const Value v = parse_value(t, i);
        bool replaced = false;
        for (auto& kv : g_gen) {
          if (kv.first == kind) {
            kv.second = v;
            replaced = true;
          }
        }
        if (!replaced) g_gen.emplace_back(kind, v);
      } else if (sub == "genclear") {
        g_gen.clear();
      } else if (sub == "ents") {
        // `world.list_entities` 的候选名单：`self` / `buddy` / `sp<N>`（只记 token，
        // 实体在筛的时候现查，见 `candidate_of`）。
        g_candidate_tokens.assign(t.begin() + static_cast<std::ptrdiff_t>(i), t.end());
        g_log.push_back("ents:" + join(g_candidate_tokens));
      } else if (sub == "ballctrl") {
        const std::string& flag = t[i++];
        const std::string& v = t[i++];
        g_ball_ctrl = flag == "b" && v == "1";
      } else if (sub == "puppets") {
        // `world.puppets.values()` 的名单（token 与 `env ents` 同款）。
        g_puppet_tokens.assign(t.begin() + static_cast<std::ptrdiff_t>(i), t.end());
        g_log.push_back("puppets:" + join(g_puppet_tokens));
      } else if (sub == "stage") {
        // `env stage <key> <值>`：舞台边界（`player_l` / `player_r` / `far` / `near`）。
        const std::u16string key = text_of(parse_value(t, i));
        const Value v = parse_value(t, i);
        bool replaced = false;
        for (auto& kv : g_stage) {
          if (kv.first == key) {
            kv.second = v;
            replaced = true;
            break;
          }
        }
        if (!replaced) g_stage.emplace_back(key, v);
      } else if (sub == "groundstep") {
        // `world.ground.step`（TS 台面用 `defineProperty` 换掉那个只读字段）。
        g_ground_step = to_number(parse_value(t, i));
        test_world().ground.set_step(g_ground_step);
      } else if (sub == "rankmode") {
        const std::string& flag = t[i++];
        const std::string& v = t[i++];
        g_rank_mode = flag == "b" && v == "1";
      } else if (sub == "rankavail") {
        const std::string& flag = t[i++];
        const std::string& v = t[i++];
        g_rank_avail = flag == "b" && v == "1";
      } else if (sub == "cheat") {
        // `lfw.is_cheat(name)` 的第二段：`world.dataset` 里有没有这个作弊键。
        const std::u16string name = text_of(parse_value(t, i));
        const std::string& flag = t[i++];
        const std::string& v = t[i++];
        const bool on = flag == "b" && v == "1";
        for (std::size_t k = 0; k < g_cheats.size();) {
          if (g_cheats[k] == name) {
            g_cheats.erase(g_cheats.begin() + static_cast<std::ptrdiff_t>(k));
          } else {
            ++k;
          }
        }
        if (on) g_cheats.push_back(name);
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
        g_entity = std::make_unique<Entity>(test_world(), parse_value(t, i), &g_states);
        bind_callbacks(*g_entity);
        std::printf("run make || id=%s | %s\n", s_of(g_entity->id).c_str(),
                    join(g_log).c_str());
      } else if (what == "reset") {
        g_entity->reset(parse_value(t, i));
        std::printf("run reset || id=%s | %s\n", s_of(g_entity->id).c_str(),
                    join(g_log).c_str());
      } else if (what == "resetstates") {
        // `reset(data, states)`: the registry switch is observable, so the scene can
        // tell the default `ENTITY_STATES` apart from the harness registry.
        g_entity->reset(parse_value(t, i), &g_states);
        std::printf("run resetstates || id=%s | %s\n", s_of(g_entity->id).c_str(),
                    join(g_log).c_str());
      } else if (what == "get") {
        const std::string& name = t[i++];
        double n = 0;
        Value v;
        if (get_num(*g_entity, name, n)) v = Value(n);
        else if (get_value(*g_entity, name, v)) {
        } else {
          std::fprintf(stderr, "unknown get '%s' at line %d\n", name.c_str(), lineno);
          return 2;
        }
        std::printf("run get %s || %s | v=%s\n", name.c_str(), join(g_log).c_str(),
                    render(v).c_str());
      } else if (what == "set") {
        const std::string& name = t[i++];
        const Value in_v = parse_value(t, i);
        double n = 0;
        Value out_v;
        if (set_value(*g_entity, name, in_v)) {
          get_value(*g_entity, name, out_v);
        } else if (set_num(*g_entity, name, lfw::to_number(in_v))) {
          get_num(*g_entity, name, n);
          out_v = Value(n);
        } else {
          std::fprintf(stderr, "unknown set '%s' at line %d\n", name.c_str(), lineno);
          return 2;
        }
        std::printf("run set %s %s || %s | v=%s\n", name.c_str(), render(in_v).c_str(),
                    join(g_log).c_str(), render(out_v).c_str());
      } else if (what == "slots") {
        std::printf("run slots || %s | v=%s\n", join(g_log).c_str(),
                    render(stat_slots(*g_entity)).c_str());
      } else if (what == "armor") {
        g_entity->reset_armor();
        std::printf("run armor || %s | v=%s\n", join(g_log).c_str(),
                    render(stat_slots(*g_entity)).c_str());
      } else if (what == "catch") {
        g_entity->set_catch_time(lfw::to_number(parse_value(t, i)));
        std::printf("run catch || %s | v=%s\n", join(g_log).c_str(),
                    render(stat_slots(*g_entity)).c_str());
      } else if (what == "addcatch") {
        g_entity->add_catch_time(lfw::to_number(parse_value(t, i)));
        std::printf("run addcatch || %s | v=%s\n", join(g_log).c_str(),
                    render(stat_slots(*g_entity)).c_str());
      } else if (what == "catching") {
        g_entity->set_catching(nullptr);
        std::printf("run catching || %s\n", join(g_log).c_str());
      } else if (what == "role") {
        g_entity->as_key_role(parse_value(t, i));
        std::printf("run role || %s | v=%s\n", join(g_log).c_str(), render(role_probe(*g_entity)).c_str());
      } else if (what == "autorole") {
        g_entity->auto_key_role();
        std::printf("run autorole || %s | v=%s\n", join(g_log).c_str(),
                    render(role_probe(*g_entity)).c_str());
      } else if (what == "dataset") {
        const Value key = parse_value(t, i);
        std::printf("run dataset %s || %s | v=%s\n", render(key).c_str(), join(g_log).c_str(),
                    render(g_entity->dataset(text_of(key))).c_str());
      } else if (what == "itrfall") {
        const Value itr = parse_value(t, i);
        std::printf("run itrfall %s || %s | v=%s\n", render(itr).c_str(), join(g_log).c_str(),
                    render(g_entity->itr_fall(itr)).c_str());
      } else if (what == "ctrl") {
        const std::string& kind = t[i++];
        if (kind == "none") g_entity->set_ctrl(nullptr);
        else if (kind == "base") g_entity->set_ctrl(make_ctrl(0));
        else if (kind == "base_released") {
          lfw::controller::BaseController* c = make_ctrl(0);
          c->keys.d.hit(Value(1.0), 0.0);
          g_entity->set_ctrl(c);
        } else if (kind == "human") g_entity->set_ctrl(make_ctrl(1));
        else if (kind == "human_bare") g_entity->set_ctrl(make_ctrl(3));
        else if (kind == "bot") g_entity->set_ctrl(make_ctrl(2));
        else if (kind == "ball") {
          // 真控制器（TS 那边同样是 `new BallController(...)`）。
          g_balls.push_back(std::make_unique<lfw::controller::BallController>());
          g_ball = g_balls.back().get();
          g_ball->reset();
          g_entity->set_ctrl(g_ball);
          std::printf("run ctrl ball || %s | v=ball\n", join(g_log).c_str());
          continue;
        } else if (kind == "same") g_entity->set_ctrl(g_entity->ctrl());
        else {
          std::fprintf(stderr, "unknown ctrl '%s' at line %d\n", kind.c_str(), lineno);
          return 2;
        }
        std::printf("run ctrl %s || %s | v=%s\n", kind.c_str(), join(g_log).c_str(),
                    s_of(ctrl_mark(g_entity->ctrl())).c_str());
      } else if (what == "ball") {
        // `BallController` 的驱动器（`controller/ball_controller.h`）。
        // `run ctrl ball` 已经把真控制器挂上去了；这里每次先刷一遍 `CtrlEnv`
        // （TS 的控制器直接读 `this.entity`，端口的控制器读 `env()`）。
        const std::string& sub = t[i++];
        if (g_ball == nullptr) {
          std::fprintf(stderr, "run ball without `run ctrl ball` at line %d\n", lineno);
          return 2;
        }
        g_entity->refresh_ctrl_env();
        std::string head = "run ball " + sub;
        if (sub == "point") {
          const double x = lfw::to_number(parse_value(t, i));
          const double y = lfw::to_number(parse_value(t, i));
          const double z = lfw::to_number(parse_value(t, i));
          g_ball->set_chase_point(x, y, z);
          head += " " + render(Value(x)) + " " + render(Value(y)) + " " + render(Value(z));
        } else if (sub == "aim") {
          const std::string& tok = t[i++];
          head += " " + tok;
          const Value ref = ball_ref(tok);
          if (i < t.size()) {
            const double oy = lfw::to_number(parse_value(t, i));
            head += " " + render(Value(oy));
            g_ball->aim_at(ref, oy);
          } else {
            g_ball->aim_at(ref);
          }
        } else if (sub == "lookup") {
          const std::string& me_tok = t[i++];
          head += " " + me_tok;
          // 世界侧真实运行时给的是实体（`LFW::ctrl_update_lookup`），台面这里也照给 ——
          // 引用快照会让 `chasing` 读到冻结的旧字段（TS 读的是活实体）。
          std::vector<Entity*> ents;
          for (const std::string& tok : g_candidate_tokens) ents.push_back(candidate_of(tok));
          int me = -1;
          for (int k = 0; k < static_cast<int>(g_candidate_tokens.size()); ++k) {
            if (g_candidate_tokens[static_cast<std::size_t>(k)] == me_tok) me = k;
          }
          g_ball->update_lookup(me, ents);
        } else if (sub == "should") {
          const std::string& tok = t[i++];
          head += " " + tok;
          std::printf("%s || %s | v=%s\n", head.c_str(), join(g_log).c_str(),
                      render(Value(g_ball->should_chase(ball_ref(tok)) ? 1.0 : 0.0)).c_str());
          continue;
        } else if (sub == "closer") {
          // 直连 `helper/closer_one`（TS 那边调真函数）：`s` / `t1` / `t2` 都用 token，
          // `z` / `nil` 给 `null`，认不出的 token 给 `undefined`。
          const std::string& s_tok = t[i++];
          const std::string& a_tok = t[i++];
          const std::string& b_tok = t[i++];
          head += " " + s_tok + " " + a_tok + " " + b_tok;
          std::printf("%s || %s | v=%s\n", head.c_str(), join(g_log).c_str(),
                      render(id_probe(lfw::helper::closer_one(
                          ball_ref(s_tok), ball_ref(a_tok), ball_ref(b_tok)))).c_str());
          continue;
        } else if (sub == "dir") {
          const double delta = lfw::to_number(parse_value(t, i));
          const double over = lfw::to_number(parse_value(t, i));
          const double prev = lfw::to_number(parse_value(t, i));
          head += " " + render(Value(delta)) + " " + render(Value(over)) + " " +
                  render(Value(prev));
          std::printf("%s || %s | v=%s\n", head.c_str(), join(g_log).c_str(),
                      render(Value(g_ball->calc_dir(delta, over, prev))).c_str());
          continue;
        } else if (sub == "stop") {
          g_ball->stop_chasing();
        } else if (sub == "update") {
          g_ball->update();
        } else {
          std::fprintf(stderr, "unknown ball '%s' at line %d\n", sub.c_str(), lineno);
          return 2;
        }
        std::printf("%s || %s |%s\n", head.c_str(), join(g_log).c_str(),
                    ball_state(g_ball).c_str());
      } else if (what == "frame") {
        g_entity->frame = parse_value(t, i);
        std::printf("run frame %s || %s | v=%s\n", render(g_entity->frame).c_str(),
                    join(g_log).c_str(), render(g_entity->frame).c_str());
      } else if (what == "pos") {
        const double x = lfw::to_number(parse_value(t, i));
        const double y = lfw::to_number(parse_value(t, i));
        const double z = lfw::to_number(parse_value(t, i));
        g_entity->position.set(x, y, z);
        std::printf("run pos %s %s %s || %s | p=%s\n", render(Value(x)).c_str(),
                    render(Value(y)).c_str(), render(Value(z)).c_str(), join(g_log).c_str(),
                    render(vec3_value(g_entity->position)).c_str());
      } else if (what == "ground") {
        const double y = lfw::to_number(parse_value(t, i));
        g_entity->set_ground_y(y);
        std::printf("run ground %s || %s | g=%s\n", render(Value(y)).c_str(),
                    join(g_log).c_str(), render(Value(g_entity->ground_y())).c_str());
      } else if (what == "link") {
        const std::string& field = t[i++];
        const std::string& to = t[i++];
        Entity* v = to == "self"   ? g_entity.get()
                    : to == "buddy" ? g_buddy.get()
                                    : nullptr;
        if (field == "bearer") g_entity->bearer = v;
        else if (field == "catcher") g_entity->catcher = v;
        else if (field == "holding") g_entity->holding = v;
        else if (field == "catching") g_entity->catching = v;
        else {
          std::fprintf(stderr, "unknown link '%s' at line %d\n", field.c_str(), lineno);
          return 2;
        }
        std::printf("run link %s %s || %s | b=%s c=%s\n", field.c_str(), to.c_str(),
                    join(g_log).c_str(),
                    render(Value(g_entity->bearer != nullptr)).c_str(),
                    render(Value(g_entity->catcher != nullptr)).c_str());
      } else if (what == "fuseby") {
        // `this.fuse_bys`（`check_fusion_dismissing` / `dismiss_fusion` 的成员链）。
        const std::string& tok = t[i++];
        Entity* e = candidate_of(tok);
        if (e == nullptr) {
          std::fprintf(stderr, "unknown fuseby '%s' at line %d\n", tok.c_str(), lineno);
          return 2;
        }
        g_entity->fuse_bys.push_back(e);
        g_entity->has_fuse_bys = true;
        std::printf("run fuseby %s || %s | n=%d\n", tok.c_str(), join(g_log).c_str(),
                    static_cast<int>(g_entity->fuse_bys.size()));
      } else if (what == "fuseclear") {
        g_entity->fuse_bys.clear();
        g_entity->has_fuse_bys = false;
        std::printf("run fuseclear || %s | n=0\n", join(g_log).c_str());
      } else if (what == "buddyframe") {
        const Value v = parse_value(t, i);
        g_buddy->set_frame(v);
        std::printf("run buddyframe %s || %s | f=%s\n", render(v).c_str(), join(g_log).c_str(),
                    fid(g_buddy->frame).c_str());
      } else if (what == "linkb") {        const std::string& field = t[i++];
        const std::string& to = t[i++];
        Entity* v = to == "self" ? g_entity.get() : to == "buddy" ? g_buddy.get() : nullptr;
        if (field == "bearer") g_buddy->bearer = v;
        else if (field == "catcher") g_buddy->catcher = v;
        else if (field == "holding") g_buddy->holding = v;
        else if (field == "catching") g_buddy->catching = v;
        else {
          std::fprintf(stderr, "unknown linkb '%s' at line %d\n", field.c_str(), lineno);
          return 2;
        }
        std::printf("run linkb %s %s || %s | %s\n", field.c_str(), to.c_str(),
                    join(g_log).c_str(), rel_probe().c_str());
      } else if (what == "gv") {
        // `get_val_getter_from_entity(word)` 查表再调用。`has` 区分表里有没有这一项
        // （TS 的 `undefined` 不能被调用，所以表里没有时只能印 `v=-`）。
        const std::u16string word = text_of(parse_value(t, i));
        const lfw::ValGetter<Entity> getter = lfw::loader::get_val_getter_from_entity(word);
        if (getter == nullptr) {
          std::printf("run gv %s || %s | has=0 v=-\n", render(Value(word)).c_str(),
                      join(g_log).c_str());
        } else {
          const Value v = getter(*g_entity, word, lfw::BinOp{});
          std::printf("run gv %s || %s | has=1 v=%s\n", render(Value(word)).c_str(),
                      join(g_log).c_str(), render(v).c_str());
        }
      } else if (what == "cvwho") {
        const std::string& a_tok = t[i++];
        const std::string& v_tok = t[i++];
        cv_bind(a_tok, v_tok);
        std::printf("run cvwho %s %s || %s | a=%s v=%s af=%s bf=%s\n", a_tok.c_str(),
                    v_tok.c_str(), join(g_log).c_str(), s_of(g_cv.attacker.id()).c_str(),
                    s_of(g_cv.victim.id()).c_str(), fid(g_cv.aframe).c_str(),
                    fid(g_cv.bframe).c_str());
      } else if (what == "cvclear") {
        cv_reset();
        std::printf("run cvclear || %s | v=1\n", join(g_log).c_str());
      } else if (what == "cvset") {
        const std::string& field = t[i++];
        const Value v = parse_value(t, i);
        if (field == "itr") g_cv.itr = v;
        else if (field == "bdy") g_cv.bdy = v;
        else if (field == "aframe") g_cv.aframe = v;
        else if (field == "bframe") g_cv.bframe = v;
        else if (field == "aid") {
          g_cv.attacker = cv_handle_of(nullptr);
          g_cv.attacker.snap_mut().id = text_of(v);
        } else if (field == "vid") {
          g_cv.victim = cv_handle_of(nullptr);
          g_cv.victim.snap_mut().id = text_of(v);
        }
        else {
          std::fprintf(stderr, "unknown cvset '%s' at line %d\n", field.c_str(), lineno);
          return 2;
        }
        std::printf("run cvset %s %s || %s | v=%s\n", field.c_str(), render(v).c_str(),
                    join(g_log).c_str(), render(v).c_str());
      } else if (what == "cvkey") {
        // 键状态：`hit` = `keys[k].hit(1)`（`_d_time = 1`）、`start` = `keys[k].hit()`
        // （TS 的默认参数 ⇒ `_d_time = ctrl.time`，所以 `is_start` 为真）、
        // `db` = `dbc[k].press(ctrl.time, undefined, 1000)`（`is_db_hit` 为真）。
        const std::string& who = t[i++];
        const std::string& mode = t[i++];
        Entity* e = who == "buddy" ? g_buddy.get() : g_entity.get();
        lfw::controller::BaseController* c = e != nullptr ? e->ctrl() : nullptr;
        if (c == nullptr) {
          std::fprintf(stderr, "run cvkey without a controller at line %d\n", lineno);
          return 2;
        }
        e->refresh_ctrl_env();
        while (i < t.size()) {
          const std::string& name = t[i++];
          const std::u16string k = to_u16(name);
          lfw::controller::KeyStatus* s = c->keys.slot(k);
          lfw::controller::DoubleClick* d = c->dbc.slot(k);
          if (s == nullptr || d == nullptr) {
            std::fprintf(stderr, "unknown key '%s' at line %d\n", name.c_str(), lineno);
            return 2;
          }
          if (mode == "hit") {
            s->hit(Value(1.0), 0.0);
          } else if (mode == "start") {
            s->hit(Value(), c->time());
          } else if (mode == "db") {
            d->press(c->time(), Value(), 1000.0);
          } else {
            std::fprintf(stderr, "unknown cvkey mode '%s' at line %d\n", mode.c_str(), lineno);
            return 2;
          }
        }
        std::printf("run cvkey %s %s || %s | %s\n", who.c_str(), mode.c_str(),
                    join(g_log).c_str(), cv_key_state(c).c_str());
      } else if (what == "cv") {
        // `get_val_getter_from_collision(word)` 查表再调用。`has` 区分表里有没有这一项
        // （TS 的 `undefined` 不能被调用，所以表里没有时只能印 `v=-`）。
        const std::u16string word = text_of(parse_value(t, i));
        // 控制器读 `CtrlEnv`（TS 的 `KeyStatus` 直接读 `this.ctrl.time` / `world.dataset`）。
        if (g_entity != nullptr) g_entity->refresh_ctrl_env();
        if (g_buddy != nullptr) g_buddy->refresh_ctrl_env();
        const lfw::ValGetter<lfw::collision::Collision> getter =
            lfw::loader::get_val_getter_from_collision(word);
        if (getter == nullptr) {
          std::printf("run cv %s || %s | has=0 v=-\n", render(Value(word)).c_str(),
                      join(g_log).c_str());
        } else {
          const Value v = getter(g_cv, word, lfw::BinOp{});
          std::printf("run cv %s || %s | has=1 v=%s\n", render(Value(word)).c_str(),
                      join(g_log).c_str(), render(v).c_str());
        }
      } else if (what == "supern") {
        // `e.superpunchs.size`（`RequireSuperPunch`）：清空后塞 n 条。
        const double n = lfw::to_number(parse_value(t, i));
        g_entity->superpunchs.clear();
        for (int k = 0; k < static_cast<int>(n); ++k) {
          const std::u16string key = u"s" + to_u16(std::to_string(k));
          g_entity->superpunchs[key] = lfw::collision::Collision{};
        }
        std::printf("run supern %s || %s | n=%d\n", render(Value(n)).c_str(),
                    join(g_log).c_str(), static_cast<int>(g_entity->superpunchs.size()));
      } else if (what == "buffset") {
        // `e.buffs.values()`（`HitByMagicFlute`）：清空后按行尾给出的 kind 逐个插入。
        g_buffs.clear();
        g_entity->buffs.clear();
        int k = 0;
        while (i < t.size()) {
          const std::u16string id = u"b" + to_u16(std::to_string(k));
          g_buffs.push_back(
              std::make_unique<lfw::buff::Buff>(fx::shared_lfw(), id, parse_value(t, i)));
          g_entity->buffs[id] = g_buffs.back().get();
          ++k;
        }
        std::printf("run buffset || %s | n=%d\n", join(g_log).c_str(),
                    static_cast<int>(g_entity->buffs.size()));
      } else if (what == "addcoll") {
        // `collided_list` / `collision_list` 追加一项。`aframe` / `itr` / `bframe` 用对象
        // 字面量（`o 1 state n 3` / `o 0`），`attacker` / `victim` 只给 `data.type`：
        // `CollisionActor` 是快照，只保留了这个字段。
        const std::string& which = t[i++];
        lfw::collision::Collision c;
        c.attacker.snap_mut().data_type = lfw::to_number(parse_value(t, i));
        c.victim.snap_mut().data_type = lfw::to_number(parse_value(t, i));
        c.aframe = parse_value(t, i);
        c.itr = parse_value(t, i);
        c.bframe = parse_value(t, i);
        if (which == "collided") g_entity->collided_list.push_back(std::move(c));
        else if (which == "collision") g_entity->collision_list.push_back(std::move(c));
        else {
          std::fprintf(stderr, "unknown addcoll '%s' at line %d\n", which.c_str(), lineno);
          return 2;
        }
        std::printf("run addcoll %s || %s | nc=%d no=%d\n", which.c_str(), join(g_log).c_str(),
                    static_cast<int>(g_entity->collided_list.size()),
                    static_cast<int>(g_entity->collision_list.size()));
      } else if (what == "collclear") {
        const std::string& which = t[i++];
        if (which == "collided" || which == "both") g_entity->collided_list.clear();
        if (which == "collision" || which == "both") g_entity->collision_list.clear();
        if (which != "collided" && which != "collision" && which != "both") {
          std::fprintf(stderr, "unknown collclear '%s' at line %d\n", which.c_str(), lineno);
          return 2;
        }
        std::printf("run collclear %s || %s | nc=%d no=%d\n", which.c_str(),
                    join(g_log).c_str(), static_cast<int>(g_entity->collided_list.size()),
                    static_cast<int>(g_entity->collision_list.size()));
      } else if (what == "setvel") {
        const Value x = parse_value(t, i);
        const Value y = parse_value(t, i);
        const Value z = parse_value(t, i);
        g_entity->set_velocity(x, y, z);
        std::printf("run setvel %s %s %s || %s | v=%s pv=%s g=%s\n", render(x).c_str(),
                    render(y).c_str(), render(z).c_str(), join(g_log).c_str(),
                    render(vec3_value(g_entity->velocity)).c_str(),
                    render(vec3_value(g_entity->prev_velocity)).c_str(),
                    render(Value(g_entity->is_on_ground)).c_str());
      } else if (what == "leaveground") {
        g_entity->leave_ground();
        std::printf("run leaveground || %s | p=%s g=%s\n", join(g_log).c_str(),
                    render(vec3_value(g_entity->position)).c_str(),
                    render(Value(g_entity->is_on_ground)).c_str());
      } else if (what == "gravity") {
        g_entity->handle_gravity();
        std::printf("run gravity || %s | v=%s\n", join(g_log).c_str(),
                    render(vec3_value(g_entity->velocity)).c_str());
      } else if (what == "gdecay") {
        const Value factor = parse_value(t, i);
        if (std::holds_alternative<std::monostate>(factor))
          g_entity->handle_ground_velocity_decay();
        else
          g_entity->handle_ground_velocity_decay(lfw::to_number(factor));
        std::printf("run gdecay %s || %s | v=%s pv=%s\n", render(factor).c_str(),
                    join(g_log).c_str(), render(vec3_value(g_entity->velocity)).c_str(),
                    render(vec3_value(g_entity->prev_velocity)).c_str());
      } else if (what == "vdecay") {
        const Value accx = parse_value(t, i);
        const Value accz = parse_value(t, i);
        const Value factor = parse_value(t, i);
        g_entity->handle_velocity_decay(
            accx,
            std::holds_alternative<std::monostate>(accz) ? std::nullopt
                                                         : std::optional<Value>(accz),
            std::holds_alternative<std::monostate>(factor) ? 1.0
                                                           : lfw::to_number(factor));
        std::printf("run vdecay %s %s %s || %s | v=%s pv=%s\n", render(accx).c_str(),
                    render(accz).c_str(), render(factor).c_str(), join(g_log).c_str(),
                    render(vec3_value(g_entity->velocity)).c_str(),
                    render(vec3_value(g_entity->prev_velocity)).c_str());
      } else if (what == "velocity") {
        const Value vinfo = parse_value(t, i);
        g_entity->update_velocity(vinfo);
        std::printf("run velocity %s || %s | v=%s pv=%s g=%s\n", render(vinfo).c_str(),
                    join(g_log).c_str(), render(vec3_value(g_entity->velocity)).c_str(),
                    render(vec3_value(g_entity->prev_velocity)).c_str(),
                    render(Value(g_entity->is_on_ground)).c_str());
      } else if (what == "land") {
        const bool self = t[i] == "self";
        const Value v = self ? g_entity->frame : parse_value(t, i);
        g_entity->set_landing_frame(v);
        std::printf("run land %s || %s | v=%s\n", self ? "self" : render(v).c_str(),
                    join(g_log).c_str(), render(g_entity->landing_frame()).c_str());
      } else if (what == "keys") {
        const double lr = trace::to_double(t[i++]);
        const double ud = trace::to_double(t[i++]);
        const double jd = trace::to_double(t[i++]);
        lfw::controller::BaseController* c = make_ctrl(0);
        if (lr > 0) c->keys.R.hit(Value(1.0), 0.0);
        else if (lr < 0) c->keys.L.hit(Value(1.0), 0.0);
        if (ud > 0) c->keys.D.hit(Value(1.0), 0.0);
        else if (ud < 0) c->keys.U.hit(Value(1.0), 0.0);
        if (jd > 0) c->keys.j.hit(Value(1.0), 0.0);
        else if (jd < 0) c->keys.d.hit(Value(1.0), 0.0);
        std::string extra;
        if (!hit_extra_keys(c, t, i, lineno, extra)) return 2;
        g_entity->set_ctrl(c);
        std::printf("run keys %s %s %s%s || %s | lr=%d ud=%d jd=%d\n",
                    render(Value(lr)).c_str(), render(Value(ud)).c_str(),
                    render(Value(jd)).c_str(), extra.c_str(), join(g_log).c_str(), c->LR(),
                    c->UD(), c->jd());      } else if (what == "bkeys") {
        // `keys` for the buddy: `follow_catcher` / `follow_bearer` scale one velocity
        // term by the *other* entity's controller direction.
        const double lr = trace::to_double(t[i++]);
        const double ud = trace::to_double(t[i++]);
        const double jd = trace::to_double(t[i++]);
        lfw::controller::BaseController* c = make_ctrl(0);
        if (lr > 0) c->keys.R.hit(Value(1.0), 0.0);
        else if (lr < 0) c->keys.L.hit(Value(1.0), 0.0);
        if (ud > 0) c->keys.D.hit(Value(1.0), 0.0);
        else if (ud < 0) c->keys.U.hit(Value(1.0), 0.0);
        if (jd > 0) c->keys.j.hit(Value(1.0), 0.0);
        else if (jd < 0) c->keys.d.hit(Value(1.0), 0.0);
        std::string extra;
        if (!hit_extra_keys(c, t, i, lineno, extra)) return 2;
        if (g_buddy != nullptr) g_buddy->set_ctrl(c);
        std::printf("run bkeys %s %s %s%s || %s | lr=%d ud=%d jd=%d\n",
                    render(Value(lr)).c_str(), render(Value(ud)).c_str(),
                    render(Value(jd)).c_str(), extra.c_str(), join(g_log).c_str(), c->LR(),
                    c->UD(), c->jd());
      } else if (what == "buddy") {
        // Replacing the buddy would leave the entity pointing at a freed object, so the
        // four relation slots are detached first (the TS side would keep the old object
        // alive instead, which is not what a scene wants to compare).
        if (g_buddy != nullptr) {
          if (g_entity->holding == g_buddy.get()) g_entity->holding = nullptr;
          if (g_entity->catching == g_buddy.get()) g_entity->catching = nullptr;
          if (g_entity->bearer == g_buddy.get()) g_entity->bearer = nullptr;
          if (g_entity->catcher == g_buddy.get()) g_entity->catcher = nullptr;
        }
        g_buddy = std::make_unique<Entity>(test_world(), parse_value(t, i), &g_states);
        std::printf("run buddy || id=%s | %s\n", s_of(g_buddy->id).c_str(),
                    join(g_log).c_str());
      } else if (what == "buddyset") {
        const std::string& name = t[i++];
        const Value in_v = parse_value(t, i);
        double n = 0;
        Value out_v;
        if (set_value(*g_buddy, name, in_v)) get_value(*g_buddy, name, out_v);
        else if (set_num(*g_buddy, name, lfw::to_number(in_v))) {
          get_num(*g_buddy, name, n);
          out_v = Value(n);
        } else {
          std::fprintf(stderr, "unknown buddyset '%s' at line %d\n", name.c_str(), lineno);
          return 2;
        }
        std::printf("run buddyset %s %s || %s | v=%s\n", name.c_str(), render(in_v).c_str(),
                    join(g_log).c_str(), render(out_v).c_str());
      } else if (what == "prev") {
        const Value v = parse_value(t, i);
        g_entity->set_prev_frame(v);
        std::printf("run prev %s || %s | v=%s\n", render(v).c_str(), join(g_log).c_str(),
                    render(g_entity->get_prev_frame()).c_str());
      } else if (what == "findframe") {
        const Value id = parse_value(t, i);
        std::printf("run findframe %s || %s | v=%s\n", render(id).c_str(),
                    join(g_log).c_str(),
                    render(g_entity->find_frame_by_id(id)).c_str());
      } else if (what == "autoframe") {
        std::printf("run autoframe || %s | v=%s\n", join(g_log).c_str(),
                    render(g_entity->find_auto_frame()).c_str());
      } else if (what == "align") {
        const Value fid = parse_value(t, i);
        const Value src = parse_value(t, i);
        const Value dst = parse_value(t, i);
        std::printf("run align %s %s %s || %s | v=%s\n", render(fid).c_str(),
                    render(src).c_str(), render(dst).c_str(), join(g_log).c_str(),
                    render(g_entity->find_align_frame(text_of(fid), src, dst)).c_str());
      } else if (what == "suddenframe") {
        std::printf("run suddenframe || %s | v=%s\n", join(g_log).c_str(),
                    render(g_entity->get_sudden_death_frame()).c_str());
      } else if (what == "caughtframe") {
        const Value v = g_entity->get_caught_end_frame();
        std::printf("run caughtframe || %s | v=%s p=%s\n", join(g_log).c_str(),
                    render(v).c_str(), render(vec3_value(g_entity->position)).c_str());
      } else if (what == "facingflag") {
        const Value f = parse_value(t, i);
        std::printf("run facingflag %s || %s | v=%s f=%s\n", render(f).c_str(),
                    join(g_log).c_str(),
                    render(Value(g_entity->handle_facing_flag(f))).c_str(),
                    render(Value(g_entity->facing)).c_str());
      } else if (what == "waitflag") {
        const Value w = parse_value(t, i);
        const Value f = parse_value(t, i);
        const std::optional<Value> frame =
            std::holds_alternative<std::monostate>(f) ? std::nullopt
                                                      : std::optional<Value>(f);
        std::printf("run waitflag %s %s || %s | v=%s w=%s\n", render(w).c_str(),
                    render(f).c_str(), join(g_log).c_str(),
                    render(Value(g_entity->handle_wait_flag(w, frame))).c_str(),
                    render(Value(g_entity->wait)).c_str());
      } else if (what == "framewait") {
        const Value f = parse_value(t, i);
        std::printf("run framewait %s || %s | v=%s\n", render(f).c_str(),
                    join(g_log).c_str(),
                    render(Value(g_entity->get_frame_wait(f))).c_str());
      } else if (what == "waitblock") {
        const double b = trace::to_double(t[i++]);
        g_entity->set_from_wait_block(b != 0);
        std::printf("run waitblock %s || %s | v=%s\n", render(Value(b)).c_str(),
                    join(g_log).c_str(),
                    render(Value(g_entity->from_wait_block() ? 1.0 : 0.0)).c_str());
      } else if (what == "summaries") {
        const std::vector<std::pair<std::u16string, std::shared_ptr<lfw::Summary>>>& items =
            lfw::summary_mgr().items();
        std::string s;
        std::string picks;
        for (const auto& kv : items) {
          s += " " + s_of(kv.first) + ":" + render(kv.second->hp_lost()) + "/" +
               render(kv.second->mp_usage());
          picks += " " + s_of(kv.first) + ":" + render(kv.second->picking_sum());
        }
        std::printf("run summaries || %s | graves=%zu items%s p%s\n", join(g_log).c_str(),
                    lfw::summary_mgr().grave_count(), s.c_str(), picks.c_str());
      } else if (what == "mark" || what == "delmark") {
        const Value key = parse_value(t, i);
        const std::optional<Value> value =
            what == "mark"
                ? std::optional<Value>(parse_value(t, i))
                : std::nullopt;
        const std::optional<Value> guard =
            i < t.size() ? std::optional<Value>(parse_value(t, i)) : std::nullopt;
        const bool ok = what == "mark"
                            ? g_entity->set_mark(text_of(key), text_of(*value), guard)
                            : g_entity->del_mark(text_of(key), guard);
        std::string marks;
        {
          std::vector<std::pair<std::string, std::string>> entries;
          for (const auto& kv : g_entity->marks) {
            entries.emplace_back(s_of(kv.first), s_of(kv.second));
          }
          // `std::map` is key-ordered, but the TS side has to sort a `Map` by hand;
          // sorting here too keeps the two dumps identical.
          std::sort(entries.begin(), entries.end());
          for (const auto& kv : entries) {
            if (!marks.empty()) marks += ",";
            marks += kv.first + ":" + kv.second;
          }
        }
        std::printf("run %s %s %s %s || %s | v=%s marks=%s\n", what.c_str(),
                    render(key).c_str(),
                    value.has_value() ? render(*value).c_str() : "-",
                    guard.has_value() ? render(*guard).c_str() : "-", join(g_log).c_str(),
                    render(Value(ok)).c_str(), marks.c_str());
      } else if (what == "ally") {
        const std::string& which = t[i++];
        const Entity* other = which == "buddy" ? g_buddy.get() : g_entity.get();
        std::printf("run ally %s || %s | v=%s team=%s other=%s\n", which.c_str(),
                    join(g_log).c_str(), render(Value(g_entity->is_ally(*other))).c_str(),
                    render(Value(g_entity->team())).c_str(),
                    other != nullptr ? render(Value(other->team())).c_str() : "-");
      } else if (what == "emit") {
        const std::string& idx_tok = t[i++];
        const double idx = trace::to_double(idx_tok);
        const Value id_value = parse_value(t, i);
        if (idx < 0 || std::floor(idx) != idx) {
          std::fprintf(stderr, "bad emitter index at line %d\n", lineno);
          return 2;
        }
        const std::size_t k = static_cast<std::size_t>(idx);
        if (g_entity->emitters.size() <= k) g_entity->emitters.resize(k + 1);
        g_entity->emitters[k] = text_of(id_value);
        std::printf("run emit %s %s || %s | n=%zu\n", idx_tok.c_str(),
                    render(id_value).c_str(), join(g_log).c_str(),
                    g_entity->emitters.size());
      } else if (what == "emitid") {
        const std::string& idx_tok = t[i++];
        const std::string& which = t[i++];
        const double idx = trace::to_double(idx_tok);
        const Entity* target = which == "buddy" ? g_buddy.get() : g_entity.get();
        const std::u16string eid = target != nullptr ? target->id : std::u16string();
        if (idx < 0 || std::floor(idx) != idx) {
          std::fprintf(stderr, "bad emitter index at line %d\n", lineno);
          return 2;
        }
        const std::size_t k = static_cast<std::size_t>(idx);
        if (g_entity->emitters.size() <= k) g_entity->emitters.resize(k + 1);
        g_entity->emitters[k] = eid;
        std::printf("run emitid %s %s || %s | n=%zu\n", idx_tok.c_str(), which.c_str(),
                    join(g_log).c_str(), g_entity->emitters.size());
      } else if (what == "getemitter") {
        const std::string& idx_tok = t[i++];
        Entity* e = g_entity->get_emitter(trace::to_double(idx_tok));
        std::printf("run getemitter %s || %s | v=%s\n", idx_tok.c_str(), join(g_log).c_str(),
                    e != nullptr ? render(id_ref(e)).c_str() : "u");
      } else if (what == "rec") {
        const std::string& which = t[i++];
        if (which == "stat") g_entity->stat_recovering();
        else if (which == "hp") g_entity->hp_recovering();
        else if (which == "mp") g_entity->mp_recovering();
        else if (which == "toughness") g_entity->toughness_recovering();
        else if (which == "fall") g_entity->fall_value_recovering();
        else if (which == "defend") g_entity->defend_value_recovering();
        else {
          std::fprintf(stderr, "unknown rec '%s' at line %d\n", which.c_str(), lineno);
          return 2;
        }
        std::printf(
            "run rec %s || %s | hp=%s hpr=%s mp=%s mpmax=%s r=%s t=%s tr=%s fv=%s dv=%s\n",
            which.c_str(), join(g_log).c_str(), render(Value(g_entity->hp())).c_str(),
            render(Value(g_entity->hp_r())).c_str(), render(Value(g_entity->mp())).c_str(),
            render(Value(g_entity->mp_max())).c_str(), render(Value(g_entity->resting())).c_str(),
            render(Value(g_entity->toughness())).c_str(),
            render(Value(g_entity->toughness_resting())).c_str(),
            render(Value(g_entity->fall_value())).c_str(),
            render(Value(g_entity->defend_value())).c_str());
      } else if (what == "snap" || what == "snapbuf" || what == "snapapply") {
        if (what == "snapapply") g_entity->read_snapshot(g_snap_nums, g_snap_strs);
        std::vector<Value> nums(static_cast<std::size_t>(lfw::entity::num_slots()));
        std::vector<std::u16string> strs(static_cast<std::size_t>(lfw::entity::str_slots()));
        g_entity->to_snapshot(nums, strs);
        if (what == "snapbuf") {
          g_snap_nums = nums;
          g_snap_strs = strs;
        }
        std::printf("run %s || %s | n=%s s=%s\n", what.c_str(), join(g_log).c_str(),
                    render_num_slots(nums).c_str(), render_str_slots(strs).c_str());
      } else if (what == "snappoke") {
        const std::string& name = t[i++];
        const Value v = parse_value(t, i);
        g_snap_nums[nslot_index(name)] = v;
        std::printf("run snappoke %s %s || %s | v=%s\n", name.c_str(),
                    render(g_snap_nums[nslot_index(name)]).c_str(), join(g_log).c_str(),
                    render(g_snap_nums[nslot_index(name)]).c_str());
      } else if (what == "snappokestr") {
        const std::string& name = t[i++];
        const Value v = parse_value(t, i);
        g_snap_strs[sslot_index(name)] = text_of(v);
        std::printf("run snappokestr %s %s || %s | v=%s\n", name.c_str(),
                    render(Value(g_snap_strs[sslot_index(name)])).c_str(), join(g_log).c_str(),
                    render(Value(g_snap_strs[sslot_index(name)])).c_str());
      } else if (what == "snappokeid") {
        const std::string& name = t[i++];
        const std::string& which = t[i++];
        Entity* target = which == "buddy" ? g_buddy.get() : g_entity.get();
        const std::u16string poke_id = target != nullptr ? target->id : std::u16string();
        g_snap_strs[sslot_index(name)] = poke_id;
        std::printf("run snappokeid %s %s || %s | v=%s\n", name.c_str(), which.c_str(),
                    join(g_log).c_str(), render(Value(poke_id)).c_str());
      } else if (what == "copy") {
        const Value v = parse_value(t, i);
        const bool added = g_entity->add_copy(text_of(v));
        std::printf("run copy %s || %s | added=%s\n", render(v).c_str(), join(g_log).c_str(),
                    render(Value(added)).c_str());
      } else if (what == "copyself") {
        const bool added = g_entity->add_copy(g_entity->id);
        std::printf("run copyself || %s | added=%s\n", join(g_log).c_str(),
                    render(Value(added)).c_str());
      } else if (what == "frameb") {
        const Value v = parse_value(t, i);
        if (g_buddy != nullptr) g_buddy->frame = v;
        std::printf("run frameb %s || %s\n", render(v).c_str(), join(g_log).c_str());
      } else if (what == "hook") {
        const std::string& sub = t[i++];
        if (sub == "dead") {
          g_hooks.dead = true;
        } else if (sub == "gravity") {
          g_hooks.gravity = true;
          g_hooks.gravity_value = parse_value(t, i);
        } else if (sub == "frameid") {
          g_hooks.find = true;
          if (t[i] == "echo") {
            ++i;
            g_hooks.find_echo = true;
          } else {
            g_hooks.find_echo = false;
            g_hooks.find_value = parse_value(t, i);
          }
        } else if (sub == "autoframe") {
          g_hooks.auto_frame = true;
          g_hooks.auto_frame_value = parse_value(t, i);
        } else if (sub == "sudden") {
          g_hooks.sudden = true;
          g_hooks.sudden_value = parse_value(t, i);
        } else if (sub == "caught") {
          g_hooks.caught = true;
          g_hooks.caught_value = parse_value(t, i);
        } else if (sub == "viewpos") {
          g_hooks.view_position = true;
        } else if (sub == "viewframe") {
          g_hooks.view_frame = true;
        } else if (sub == "viewenter") {
          g_hooks.view_enter = true;
        } else if (sub == "viewdata") {
          g_hooks.view_data = true;
        } else if (sub == "viewdismiss") {
          g_hooks.view_dismiss = true;
        } else if (sub == "preupdate") {
          g_hooks.pre_update = true;
        } else if (sub == "stateupdate") {
          g_hooks.state_update = true;
        } else if (sub == "landing") {
          g_hooks.landing = true;
        } else if (sub == "leaveground") {
          g_hooks.leave_ground = true;
        } else if (sub == "none") {
          g_hooks = HookConfig{};
        } else {
          std::fprintf(stderr, "unknown hook '%s' at line %d\n", sub.c_str(), lineno);
          return 2;
        }
        std::printf("run hook %s || %s\n", sub.c_str(), join(g_log).c_str());
      } else if (what == "reg" || what == "regbare" || what == "regkey") {
        const bool bare = what == "regbare";
        Value key;
        if (what == "regkey") {
          key = parse_value(t, i);
        } else {
          const double code = trace::to_double(t[i++]);
          key = Value(code);
        }
        if (bare) {
          g_states.set(key, std::make_unique<lfw::state::State_Base>(key), u"State_Base");
        } else {
          g_states.set(key, std::make_unique<HarnessState>(key), u"HarnessState");
        }
        std::printf("run %s %s || %s | n=%zu\n", what.c_str(), render(key).c_str(),
                    join(g_log).c_str(), g_states.size());
      } else if (what == "lastcollided") {
        const std::u16string aid = text_of(parse_value(t, i));
        const Value team = parse_value(t, i);
        g_entity->lastest_collided = lfw::collision::Collision{};
        g_entity->lastest_collided->attacker.snap_mut().id = aid;
        g_entity->lastest_collided->attacker.snap_mut().team = team;
        std::printf("run lastcollided %s %s || %s | a=%s t=%s\n", render(Value(aid)).c_str(),
                    render(team).c_str(), join(g_log).c_str(),
                    render(Value(g_entity->lastest_collided->attacker.id())).c_str(),
                    render(g_entity->lastest_collided->attacker.team()).c_str());
      } else if (what == "setstate" || what == "setstateb") {
        const double code = trace::to_double(t[i++]);
        Entity* target = what == "setstateb" ? g_buddy.get() : g_entity.get();
        target->set_state(Value(code));
        std::printf("run %s %s || %s | n=%zu st=%s\n", what.c_str(), render(Value(code)).c_str(),
                    join(g_log).c_str(), g_states.size(),
                    render(Value(target->state_ptr() != nullptr)).c_str());
      } else if (what == "vrest" || what == "vrestget" || what == "vrestdel") {
        const Value aid_value = parse_value(t, i);
        const std::u16string aid = text_of(aid_value);
        std::string head = "run " + what + " " + render(aid_value);
        if (what == "vrest") {
          const Value kind = parse_value(t, i);
          const Value rest = parse_value(t, i);
          head += " " + render(kind) + " " + render(rest);
          // The harness builds the ported `Collision` struct directly: only `aid`,
          // `itr.kind` and `rest` are read by the three v_rest entry points.
          lfw::collision::Collision c;
          c.aid = aid;
          lfw::Object itr;
          itr.set(u"kind", kind);
          c.itr = Value(std::make_shared<lfw::Object>(itr));
          c.rest = lfw::to_number(rest);
          g_entity->add_v_rest(c);
        } else if (what == "vrestdel") {
          g_entity->del_v_rest(aid);
        }
        std::printf("%s || %s | n=%zu b=%zu s=%zu g=%s\n", head.c_str(), join(g_log).c_str(),
                    g_entity->vrests.size(), g_entity->blockers.size(),
                    g_entity->superpunchs.size(),
                    render(Value(g_entity->get_v_rest(aid))).c_str());
      } else if (what == "vratt") {
        const std::u16string aid = text_of(parse_value(t, i));
        const double ax = lfw::to_number(parse_value(t, i));
        const double az = lfw::to_number(parse_value(t, i));
        const auto it = g_entity->vrests.find(aid);
        if (it != g_entity->vrests.end()) it->second.attacker.snap_mut().px = ax;
        const auto ib = g_entity->blockers.find(aid);
        if (ib != g_entity->blockers.end()) ib->second.attacker.snap_mut().px = ax;
        const auto ibz = g_entity->blockers.find(aid);
        if (ibz != g_entity->blockers.end()) ibz->second.attacker.snap_mut().pz = az;
        const auto iz = g_entity->vrests.find(aid);
        if (iz != g_entity->vrests.end()) iz->second.attacker.snap_mut().pz = az;
        std::printf("run vratt %s %s %s || %s | ax=%s az=%s\n", render(Value(aid)).c_str(),
                    render(Value(ax)).c_str(), render(Value(az)).c_str(), join(g_log).c_str(),
                    render(Value(ax)).c_str(), render(Value(az)).c_str());
      } else if (what == "setframe") {
        const Value v = parse_value(t, i);
        g_entity->set_frame(v);
        std::string ids;
        for (const auto& kv : g_entity->opoints) {
          if (!ids.empty()) ids += ",";
          ids += render(lfw::field_or(kv.first, u"interval_id"));
        }
        std::printf(
            "run setframe %s || %s | f=%s pf=%s lf=%s ar=%s mt=%s in=%s bl=%s iv=%s op=[%s] "
            "p=%s bp=%s %s\n",
            render(v).c_str(), join(g_log).c_str(), fid(g_entity->frame).c_str(),
            fid(g_entity->get_prev_frame()).c_str(),
            render(g_entity->landing_frame()).c_str(), render(Value(g_entity->arest())).c_str(),
            render(Value(g_entity->motionless_ticks())).c_str(),
            render(Value(g_entity->invisible())).c_str(),
            render(Value(g_entity->blinking())).c_str(),
            render(Value(g_entity->invulnerable())).c_str(), ids.c_str(),
            render(vec3_value(g_entity->position)).c_str(),
            g_buddy != nullptr ? render(vec3_value(g_buddy->position)).c_str() : "z",
            rel_probe().c_str());
      } else if (what == "buddydump") {
        std::printf("run buddydump || %s | %s\n", join(g_log).c_str(),
                    dump_buddy(g_buddy.get()).c_str());
      } else if (what == "vrestdump") {
        std::printf("run vrestdump || %s | n=%s b=%s s=%s\n", join(g_log).c_str(),
                    dump_collisions(g_entity->vrests).c_str(),
                    dump_collisions(g_entity->blockers).c_str(),
                    dump_collisions(g_entity->superpunchs).c_str());
      } else if (what == "flag") {
        const std::string& which = t[i++];
        const Entity* other = which == "buddy" ? g_buddy.get() : g_entity.get();
        std::printf("run flag %s || %s | v=%s t=%s ot=%s ty=%s h=%s\n", which.c_str(),
                    join(g_log).c_str(),
                    render(Value(g_entity->get_flag(*other))).c_str(),
                    render(Value(g_entity->team())).c_str(),
                    render(Value(other->team())).c_str(),
                    // `this.type` is the raw `_data.type` in TS (it may be a string),
                    // so the trace prints the field, not `Entity::type()`'s number.
                    render(lfw::field_or(g_entity->data(), u"type")).c_str(),
                    render(Value(g_entity->hp())).c_str());
      } else if (what == "cleanhold" || what == "cleancatch") {
        if (what == "cleanhold") {
          g_entity->clean_holding();
        } else {
          g_entity->clean_catching();
        }
        std::printf("run %s || %s | %s\n", what.c_str(), join(g_log).c_str(),
                    rel_probe().c_str());
      } else if (what == "dropcatch") {
        const bool dropped = g_entity->drop_catching();
        std::printf("run dropcatch || %s | v=%s %s f=%s\n", join(g_log).c_str(),
                    render(Value(dropped)).c_str(), rel_probe().c_str(),
                    fid(g_entity->frame).c_str());
      } else if (what == "blinkgone" || what == "blinkrespawn") {
        const Value d = parse_value(t, i);
        if (what == "blinkgone") {
          g_entity->blink_and_gone(lfw::to_number(d));
        } else {
          g_entity->blink_and_respawn(lfw::to_number(d));
        }
        const std::optional<std::u16string>& ab = g_entity->after_blink();
        std::printf("run %s %s || %s | bl=%s ab=%s\n", what.c_str(), render(d).c_str(),
                    join(g_log).c_str(), render(Value(g_entity->blinking())).c_str(),
                    render(ab.has_value() ? Value(*ab) : Value(lfw::NullTag{})).c_str());
      } else if (what == "itrground") {
        const Value itrs = parse_value(t, i);
        g_entity->update_itr_bdy_hit_ground(itrs);
        std::printf("run itrground %s || %s | p=%s g=%s f=%s w=%s\n", render(itrs).c_str(),
                    join(g_log).c_str(), render(vec3_value(g_entity->position)).c_str(),
                    render(Value(g_entity->ground_y())).c_str(),
                    fid(g_entity->frame).c_str(), render(Value(g_entity->wait)).c_str());
      } else if (what == "restrict") {
        const std::string& sub = t[i++];
        if (sub == "none") {
          g_restrict_result = Value();
        } else {
          --i;
          g_restrict_result = parse_value(t, i);
        }
        std::printf("run restrict %s || %s | v=%s\n", sub.c_str(), join(g_log).c_str(),
                    render(g_restrict_result).c_str());
      } else if (what == "mtseed") {
        const Value seed = parse_value(t, i);
        g_mt.reset(lfw::to_number(seed));
        std::printf("run mtseed %s || %s | times=%s\n", render(seed).c_str(), join(g_log).c_str(),
                    render(Value(static_cast<double>(g_mt.times()))).c_str());
      } else if (what == "mtdebug") {
        const Value v = parse_value(t, i);
        g_mt.debugging = lfw::truthy(v);
        std::printf("run mtdebug %s || %s | mark=%s\n", render(v).c_str(), join(g_log).c_str(),
                    render(Value(g_mt.mark)).c_str());
      } else if (what == "mtmark") {
        std::printf("run mtmark || %s | mark=%s\n", join(g_log).c_str(),
                    render(Value(g_mt.mark)).c_str());
      } else if (what == "mtcases") {
        const std::u16string text = lfw::mt_cases().submit();
        std::printf("run mtcases || %s | text=%s n=%s\n", join(g_log).c_str(),
                    render(Value(text)).c_str(),
                    render(Value(static_cast<double>(lfw::mt_cases().cases().size()))).c_str());
      } else if (what == "spawn" || what == "spawnv") {
        const Value opoint = parse_value(t, i);
        lfw::Vector3 off;
        double fv = g_entity->facing;
        if (what == "spawnv") {
          off.x = lfw::to_number(parse_value(t, i));
          off.y = lfw::to_number(parse_value(t, i));
          off.z = lfw::to_number(parse_value(t, i));
          fv = lfw::to_number(parse_value(t, i));
        }
        g_last_spawn = nullptr;
        Entity* made = (what == "spawnv") ? g_entity->spawn(opoint, off, fv)
                                          : g_entity->spawn(opoint);
        lfw::Array copy_ids;
        for (const std::u16string& cid : g_entity->copies) copy_ids.push_back(Value(cid));
        std::printf("run %s || %s | %s | copies=%s\n", what.c_str(), join(g_log).c_str(),
                    dump_spawn(made).c_str(),
                    render(Value(std::make_shared<lfw::Array>(copy_ids))).c_str());
      } else if (what == "spawndump") {
        std::printf("run spawndump || %s | %s\n", join(g_log).c_str(),
                    dump_spawn(g_last_spawn).c_str());
      } else if (what == "attach") {
        const Value ghost = parse_value(t, i);
        Entity& e = g_entity->attach(ghost);
        std::printf("run attach %s || %s | %s\n", render(ghost).c_str(), join(g_log).c_str(),
                    dump_spawn(&e).c_str());
      } else if (what == "setpos") {
        const Value x = parse_value(t, i);
        const Value y = parse_value(t, i);
        const Value z = parse_value(t, i);
        g_entity->set_position(x, y, z);
        std::printf("run setpos %s %s %s || %s | p=%s pv=%s g=%s\n", render(x).c_str(),
                    render(y).c_str(), render(z).c_str(), join(g_log).c_str(),
                    render(vec3_value(g_entity->position)).c_str(),
                    render(vec3_value(g_entity->prev_position)).c_str(),
                    render(Value(g_entity->ground_y())).c_str());
      } else if (what == "terrain") {
        const Value v = parse_value(t, i);
        lfw::ITerrainInfo seg = lfw::terrain_info_new();
        seg.id = text_of(lfw::field_or(v, u"id"));
        seg.name = text_of(lfw::field_or(v, u"name"));
        seg.type = static_cast<int>(lfw::to_number(lfw::field_or(v, u"type")));
        seg.x1 = lfw::to_number(lfw::field_or(v, u"x1"));
        seg.x2 = lfw::to_number(lfw::field_or(v, u"x2"));
        seg.z1 = lfw::to_number(lfw::field_or(v, u"z1"));
        seg.z2 = lfw::to_number(lfw::field_or(v, u"z2"));
        seg.h1 = lfw::to_number(lfw::field_or(v, u"h1"));
        seg.h2 = lfw::to_number(lfw::field_or(v, u"h2"));
        g_entity->terrain = seg;
        std::printf("run terrain %s || %s | g=%s\n", render(v).c_str(), join(g_log).c_str(),
                    render(Value(g_entity->ground_y())).c_str());
      } else if (what == "updatepos") {
        g_entity->update_position();
        std::printf("run updatepos || %s | p=%s pv=%s v=%s\n", join(g_log).c_str(),
                    render(vec3_value(g_entity->position)).c_str(),
                    render(vec3_value(g_entity->prev_velocity)).c_str(),
                    render(vec3_value(g_entity->velocity)).c_str());
      } else if (what == "update") {
        g_entity->update();
        std::printf("run update || %s | %s\n", join(g_log).c_str(),
                    dump_tick(*g_entity).c_str());
      } else if (what == "updateg") {
        g_entity->update_ghost();
        std::printf("run updateg || %s | %s\n", join(g_log).c_str(),
                    dump_tick(*g_entity).c_str());
      } else if (what == "seedop") {
        // 直接塞 `_opoints`（9i 的 `set_frame` 区间过滤场景用），不走 `apply_opoints`。
        const Value list = parse_value(t, i);
        g_entity->opoints.clear();
        const lfw::Array* arr = lfw::as_array(list);
        if (arr != nullptr) {
          for (std::size_t k = 0; k < arr->size(); ++k) {
            g_entity->opoints.push_back(std::make_pair(arr->at(k), 0.0));
          }
        }
        std::printf("run seedop %s || %s | n=%zu itv=%s\n", render(list).c_str(),
                    join(g_log).c_str(), g_entity->opoints.size(),
                    dump_opoints(g_entity->opoints).c_str());
      } else if (what == "opoints") {
        // `this.apply_opoints(list)`：记账 + multi 计数 + spreading + 逐个 spawn。
        const Value list = parse_value(t, i);
        g_last_spawn = nullptr;
        g_entity->apply_opoints(list);
        std::printf("run opoints %s || %s | n=%zu itv=%s | %s\n", render(list).c_str(),
                    join(g_log).c_str(), g_entity->opoints.size(),
                    dump_opoints(g_entity->opoints).c_str(), dump_spawn(g_last_spawn).c_str());
      } else if (what == "enter" || what == "enternext" || what == "enterid") {
        Value arg;
        bool fallback = false;
        if (what == "enter" || what == "enterid") {
          arg = parse_value(t, i);
        } else {
          arg = lfw::field_or(g_entity->frame, u"next");
        }
        if (i < t.size() && t[i] == "b") {
          fallback = lfw::truthy(parse_value(t, i));
        }
        // `enterid` 走的是 `Entity::_next_frame_by_id`（内部物件，没登记判定器），只有
        // `enter` / `enternext` 的入参会进真 `get_next_frame`（见 `log_next_frame_judgers`）。
        if (what != "enterid") log_next_frame_judgers(arg);
        const lfw::EnterFrameResult r = what == "enternext" ? g_entity->enter_frame(arg, fallback)
                                          : what == "enterid"
                                              ? g_entity->enter_frame_by_id(arg, fallback)
                                              : g_entity->enter_frame(arg, fallback);
        std::printf(
            "run %s %s%s || %s | r=%s f=%s w=%s fa=%s bl=%s pf=%s ar=%s mt=%s\n",
            what.c_str(), render(arg).c_str(), fallback ? " b1" : "", join(g_log).c_str(),
            s_of(lfw::enter_frame_result_name(r)).c_str(), fid(g_entity->frame).c_str(),
            render(Value(g_entity->wait)).c_str(), render(Value(g_entity->facing)).c_str(),
            render(Value(g_entity->blinking())).c_str(),
            fid(g_entity->get_prev_frame()).c_str(), render(Value(g_entity->arest())).c_str(),
            render(Value(g_entity->motionless_ticks())).c_str());
      } else if (what == "followbearer" || what == "followcatcher") {
        if (what == "followbearer") g_entity->follow_bearer();
        else g_entity->follow_catcher();
        std::printf("run %s || %s | p=%s pv=%s v=%s fa=%s team=%s f=%s dr=%s\n", what.c_str(),
                    join(g_log).c_str(), render(vec3_value(g_entity->position)).c_str(),
                    render(vec3_value(g_entity->prev_position)).c_str(),
                    render(vec3_value(g_entity->velocity)).c_str(),
                    render(Value(g_entity->facing)).c_str(),
                    render(Value(g_entity->team())).c_str(), fid(g_entity->frame).c_str(),
                    render(Value(g_entity->dropping)).c_str());
      } else if (what == "drop") {
        g_entity->drop_holding();
        std::string held = "z";
        if (g_buddy != nullptr) {
          held = render(vec3_value(g_buddy->position)) + " " + render(Value(g_buddy->team())) +
                 " " + render(Value(g_buddy->dropping)) + " " +
                 render(Value(g_buddy->bearer != nullptr)) + " " + render(Value(g_buddy->holding != nullptr)) +
                 " " + render(Value(static_cast<double>(g_buddy->vrests.size()))) +
                 " bf=" + fid(g_buddy->frame) +
                 " bpv=" + render(vec3_value(g_buddy->prev_position));
        }
        std::printf("run drop || %s | %s held=[%s]\n", join(g_log).c_str(), rel_probe().c_str(),
                    held.c_str());
      } else if (what == "pick") {
        if (g_buddy != nullptr) g_entity->pick(*g_buddy);
        std::printf("run pick || %s | %s vrests=%zu bdr=%s bf=%s\n", join(g_log).c_str(),
                    rel_probe().c_str(), g_buddy != nullptr ? g_buddy->vrests.size() : 0,
                    g_buddy != nullptr ? render(Value(g_buddy->dropping)).c_str() : "z",
                    g_buddy != nullptr ? fid(g_buddy->frame).c_str() : "z");
      } else if (what == "transform" || what == "transnext") {
        std::string head = "run " + what;
        bool ok = false;
        if (what == "transform") {
          const Value data = parse_value(t, i);
          head += " " + render(data);
          g_entity->transform(data);
        } else {
          ok = g_entity->transfrom_to_another(std::nullopt);
        }
        std::vector<lfw::Value> copy_list;
        for (const std::u16string& cid : g_entity->copies) copy_list.push_back(lfw::Value(cid));
        const std::string copies_text =
            render(lfw::Value(std::make_shared<lfw::Array>(copy_list)));
        std::printf("%s || %s | v=%s idx=%s data=%s tr=%s cp=%s\n", head.c_str(), join(g_log).c_str(),
                    render(Value(ok)).c_str(), render(Value(g_entity->transform_index)).c_str(),
                    render(lfw::field_or(g_entity->data(), u"id")).c_str(),
                    render(g_entity->transforms).c_str(), copies_text.c_str());
      } else if (what == "statesdump") {
        std::printf("run statesdump || %s | v=%s\n", join(g_log).c_str(), dump_states().c_str());
      } else {
        std::fprintf(stderr, "unknown run '%s' at line %d\n", what.c_str(), lineno);
        return 2;
      }
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  return 0;
}
