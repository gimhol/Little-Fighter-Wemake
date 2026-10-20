#pragma once

#include <functional>
#include <string>
#include <utility>
#include <vector>

#include "lfw/controller/controller_double_clicks.h"
#include "lfw/controller/controller_key_status.h"
#include "lfw/controller/controller_result.h"
#include "lfw/controller/key_status.h"
#include "lfw/controller/seq_keys.h"
#include "lfw/core/value.h"
#include "lfw/defines/bin_op.h"
#include "lfw/utils/times.h"

namespace lfw {

class Entity;
class MersenneTwister;
// `Factory` 的控制器注册表键：TS 用的是「类本身」，端口用接口指针身份（见 `factory.h`）。
class ICtrlCreator;

namespace controller {

enum class Status { UP = 0, DOWN = 1, HOLD = 2 };

struct CtrlEnv {
  double key_hit_duration = 0;
  double double_click_interval = 0;
  double facing = 1;
  bool alive = true;
  std::u16string team;
  double px = 0;
  double py = 0;
  double pz = 0;
  double frame_state = 0;
  // `BallController` 要的三样：`this.entity.hp` / `.type` / `.frame`
  // （帧上的 `chase` / `behavior` 都是从这里读的）。
  double hp = 0;
  double type = 0;
  Value frame;
  Value pre_hitkeys;
  Value post_hitkeys;
  Value hit;
  Value hld;
  Value kd;
  Value ku;
  Value seq_map;
  Value transform_pre_seq_map;
  Value transform_post_seq_map;
  Value data_pre_seq_map;
  Value data_post_seq_map;
  std::function<Value(const Value&)> get_next_frame;

  // 「自己」的真实体（`Entity::refresh_ctrl_env` 里直接给 `this`）。TS 那边 `bot/*` 读的就是
  // 活实体（`this.entity.position`），有了这条就不用每帧重建 `Value` 投影再去解回来；
  // 差分台面（没有 `Entity`）里它是 `nullptr`，那些地方走 `self_ref()` 的引用版重载。
  Entity* self = nullptr;
  std::function<void(double, double, double, const std::u16string&)> world_etc;
  std::function<void(const std::u16string&, double, double, double)> team_come;
  std::function<void(const std::u16string&)> team_stay;
  std::function<void(const std::u16string&)> team_move;
  std::function<void()> team_follow;

  // ---- `bot/*`（`BotController` / `BotState_*`）读 `this.entity` 的额外自身字段 ----
  std::u16string id;
  double hp_max = 0;
  bool mounted = false;
  bool invisible = false;
  bool invulnerable = false;
  double toughness = 0;
  double resting = 0;
  double ground_y = 0;
  bool is_on_ground = false;
  double vx = 0;
  double vy = 0;
  double vz = 0;
  Value name;
  Value data;
  // `me.holding` / `me.catching`：TS 读的是活实体（`me.holding?.base_type` / `me.catching.hp`），
  // 端口照样给实体（`nullptr` 即 `null`，读法走 `ref_of` 的投影）。
  const Entity* holding = nullptr;
  const Entity* catching = nullptr;
  double blockers_count = 0;
  // `lfw.mt`（`desire` 的 `mark`/`range`、`handle_bot_actions` 的 `pick`/`case`）。
  MersenneTwister* mt = nullptr;

  // ---- `bot/*` 读 world / lfw 的缝（宿主回答；每次读都是活读，同 TS 的 getter）----
  // `get difficulty()`：`stage.id` 门 + `puppets` 扫描 + `dataset.difficulty`。
  std::function<double()> bot_difficulty;
  // `world.get_bound(this.me)` → `[l, r, near, far]`（`can_back_off` / `cornered` /
  // `should_chase` 只读前两位）。
  std::function<std::vector<double>()> get_bound;
  // `world.has_players_alive`
  std::function<bool()> has_players_alive;
  // `world.stage.{id,team,player_l,player_r,near,far,is_stage_finish,is_chapter_finish}`
  std::function<Value(const std::u16string&)> stage_value;
  // `lfw.datas.find_bot(bot_id)`（`check_bot`）
  std::function<Value(const std::u16string&)> find_bot;
  // `get_val_from_bot_ctrl` 的回落：`val_getter(e.entity, word, op)`（实体 getter 表；
  // 未命中时给 `word` 本身，即 TS 的 `() => word`）。由 `Entity` 在刷新时绑上。
  std::function<Value(const std::u16string&, BinOp op)> entity_val;
  // `this.entity.set_position(x, y, z)`（`lock_when_stand_and_rest`）
  std::function<void(const Value&, const Value&, const Value&)> set_position;
  // `world.bg.width` / `.near` / `.far`（`lock_when_stand_and_rest` 的落点）。
  double bg_width = 0;
  double bg_near = 0;
  double bg_far = 0;
};

class BaseController {
 public:
  static constexpr const char* TAG = "BaseController";

  BaseController();

  virtual void set_env(const CtrlEnv* env) { _env = env; }
  const CtrlEnv* env() const { return _env; }
  // `Factory` 的归池键（TS 是 `ctrl.constructor`）。
  void set_creator(const ICtrlCreator* creator) { _creator = creator; }
  const ICtrlCreator* creator() const { return _creator; }
  void set_kind(bool human, bool bot) {
    _is_human = human;
    _is_bot = bot;
  }
  bool is_human() const { return _is_human; }
  bool is_bot() const { return _is_bot; }
  // `is_ball_ctrl(this)`（TS 是 `ctrl.__is_ball_ctrl__ === true`）。`BallController`
  // 重写成本恒真；`set_ball` 留给测试替身（harness 的假控制器）用。
  void set_ball(bool v) { _is_ball = v; }
  virtual bool is_ball_ctrl() const { return _is_ball; }
  // `ctrl.is_invalid_controller`（`InvalidController` 的占位标记）。
  virtual bool is_invalid_controller() const { return false; }
  // `this.player = lfw.players.get(player_id)`：切片 4CX 起由 **`Factory::acquire_ctrl`** 在
  // 造/复用控制器时绑（TS 是在 `BaseController` 的构造与 `reset` 里各做一次，端口把这两处
  // 收在 `Factory` 那一层；`entity == nullptr` 的 `InvalidController` 不绑，同 TS）。
  // `BallController.chasing`：TS 里这个字段在子类上，端口放在基类（`spawn` 的
  // `OpointMultiEnum` 分支要在 `is_ball_ctrl` 门后写它，而端口那边只有 `BaseController*`）。
  // 直接存实体指针（`nullptr` 即 `null`）：实体只入池复用、从不 `delete`，指针不会悬空。
  Entity* chasing = nullptr;

  double time() const { return _time.value(); }

  int LR() const;
  double RL() const { return -static_cast<double>(LR()); }
  int UD() const;
  double DU() const { return -static_cast<double>(UD()); }
  int jd() const;
  double dj() const { return -static_cast<double>(jd()); }

  const std::u16string& key_list() const { return _readable_key_list; }
  const std::u16string& key_list_raw() const { return _key_list; }

  virtual void reset();
  void reset_key_list();
  BaseController& start(const std::vector<std::u16string>& ks);
  BaseController& hold(const std::vector<std::u16string>& ks);
  BaseController& end(const std::vector<std::u16string>& ks);
  BaseController& db_hit(const std::vector<std::u16string>& ks);
  BaseController& click(const std::vector<std::u16string>& ks);
  BaseController& dbl_click(const std::vector<std::u16string>& ks);
  BaseController& key_down(const std::vector<std::u16string>& ks);
  BaseController& key_up(const std::vector<std::u16string>& ks);

  BaseController& ku(const std::vector<std::u16string>& ks) { return key_up(ks); }
  BaseController& kd(const std::vector<std::u16string>& ks) { return key_down(ks); }
  BaseController& ck(const std::vector<std::u16string>& ks) { return click(ks); }

  bool is_hold(const std::u16string& k) const;
  bool is_hit(const std::u16string& k) const;
  bool is_end(const std::u16string& k) const;
  bool is_start(const std::u16string& k) const;
  bool is_db_hit(const std::u16string& k);

  bool tst(const std::u16string& type, const std::u16string& key);

  virtual const ControllerResult& update();

  bool sequence_keys_test(const std::u16string& str) const;
  bool sametime_keys_test(const std::u16string& str) const;

  ControllerKeyStatus keys;
  ControllerDoubleClicks dbc;
  ControllerResult result;
  std::vector<std::pair<Status, std::u16string>> queue;
  std::u16string player_id;
  Value player;

 private:
  bool check_key_act(const Value& map, const std::u16string& kind, KeyStatus* key, bool use);
  bool check_hit_seqs(const Value& seqs, ControllerResult& out);

  const KeyStatus* slot(const std::u16string& k) const { return keys.slot(k); }
  KeyStatus* slot(const std::u16string& k) { return keys.slot(k); }

  const CtrlEnv* _env = nullptr;
  // TS 用 `ctrl.constructor` 当 `Factory` 对象池的键（`release_ctrl`）⇒ 端口在基类上留一个
  // creator 身份（`Factory::acquire_ctrl` / `create_ctrl` 负责写）。
  const ICtrlCreator* _creator = nullptr;
  Times _time{10, 9007199254740991.0};
  std::u16string _key_list;
  std::u16string _readable_key_list;
  bool _is_human = false;
  bool _is_bot = false;
  bool _is_ball = false;
  SeqKeys _seq_djdj;
  SeqKeys _seq_dddd;
  SeqKeys _seq_dada;
  SeqKeys _seq_djjj;
};

}
}
