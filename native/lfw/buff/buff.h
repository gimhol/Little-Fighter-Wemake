#pragma once

#include <functional>
#include <string>
#include <utility>
#include <variant>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/utils/times.h"

namespace lfw {

class LFW;
class World;

namespace buff {

class Buff;

// 实体接口已退役（切片 4BY）：`buff` 系统直接以 `lfw::Entity` 为宿主面，原先的
// `Entity` 窄接口连同其 34 个方法一并删除（空值与缺省语义由 `Entity` 自身承担）。
// 切片 4CP：`BuffEnv` 也退役 —— TS 的 `Buff` 构造收 `lfw: LFW` 并自己记 `this.world = lfw.world`，
// 端口照做（`_lfw` / `_world` 两个只读句柄），`find_entity` / `datas.find` / `create_entity` /
// `world.buffs` / `factory.create_buff` 全都走 `LFW`/`World` 自己的（虚）方法。

inline bool set_mark(Entity& e, const std::u16string& key, const std::u16string& value,
                     const Value& prev) {
  if (std::holds_alternative<std::monostate>(prev) || equals(e.marks_get(key), prev)) {
    e.marks_set(key, value);
    return true;
  }
  return false;
}

inline bool del_mark(Entity& e, const std::u16string& key, const Value& value) {
  if (std::holds_alternative<std::monostate>(value) || equals(e.marks_get(key), value)) {
    return e.marks_delete(key);
  }
  return false;
}

class Buff {
 public:
  // `virtual`：端口有 7 个 buff 子类，台面按 `std::unique_ptr<Buff>` 持有派生对象 ⇒ 非虚析构
  // 会让派生析构永不执行（clang 只在编译到删除点时才报；删除点在台面里）。
  virtual ~Buff() = default;
  // TS `constructor(lfw: LFW, id, kind)`。`LFW` 与 `World` 都是**每局一个**的稳定对象
  // （`LFW::world()` 返回同一个 `World`），所以这两个指针不会悬空。
  Buff(LFW& lfw, const std::u16string& id, const Value& kind);

  LFW& lfw() const { return *_lfw; }
  World& world() const { return *_world; }

  const std::u16string& id() const { return _id; }
  const std::vector<std::u16string>& victims() const { return _victims; }
  bool dead() const { return _lifetime.remains() == 0; }
  double lifetime() const { return _lifetime.value(); }
  void set_lifetime(double v) { _lifetime.set_value(v); }
  double duration() const { return _lifetime.max(); }
  void set_duration(double v) { _lifetime.set_max(v); }
  double ticks() const { return _ticker.max(); }
  void set_ticks(double v) { _ticker.set_max(v); }
  const Value& kind() const { return _kind; }
  double level() const { return _level; }
  void set_level(double v) { _level = v; }
  bool mounted() const { return _mounted; }
  const std::u16string& attacker_id() const { return _attacker_id; }
  size_t effects_size() const { return _effects.size(); }
  Entity* attacter();

  void reset(const std::u16string& id);
  // 池化复用（`Factory::recycle_buff` → 下一次 `create_buff`）可能把这个对象交给别的 `LFW`
  // ⇒ 换主人时丢掉上一局的实体缓存（`_effects` 是裸 `Entity*`、`_victims` 是上一局的 id）。
  void rebind_lfw(LFW& lfw);
  virtual void init() {}
  void set_attacker_by_id(const std::u16string& id);
  void set_attacker_entity(Entity* e);
  void set_victim(Entity* victim);
  void add_victim(Entity* victim);
  void del_victim(Entity* victim);
  void update(double d);
  Value to_snapshot() const;
  void read_snapshot(const Value& s);
  virtual void mount();
  virtual void unmount();

 protected:
  virtual std::u16string effect_oid() const { return std::u16string(); }
  virtual std::u16string effect_frame_id() const { return std::u16string(u"0"); }
  virtual bool has_on_update() const { return false; }
  virtual bool has_on_tick() const { return false; }
  virtual bool has_on_end() const { return false; }
  virtual void on_update(Entity* attacker, Entity* victim) {
    (void)attacker;
    (void)victim;
  }
  virtual void on_tick(Entity* attacker, Entity* victim) {
    (void)attacker;
    (void)victim;
  }
  virtual void on_end(Entity* attacker, Entity* victim) {
    (void)attacker;
    (void)victim;
  }
  Value effect_data();
  virtual void place_effect(Entity* effect, Entity* victim);
  void place_effect_center(Entity* effect, Entity* victim);
  void del_effect(const std::u16string& vid);
  void clear_effects();
  void show_effect(Entity* victim);
  void update_effects();
  bool del_id(const std::u16string& id);
  /** 丢掉一切「属于某个世界的实体」的缓存（`_effects` 是裸指针、`_victims` 是 id）。 */
  void drop_cached_refs();

  LFW* _lfw = nullptr;
  World* _world = nullptr;
  std::u16string _id;
  Value _kind;
  Entity* _attacker = nullptr;
  std::u16string _attacker_id;
  double _level = 0;
  bool _mounted = false;
  std::vector<std::u16string> _victims;
  Times _ticker;
  Times _lifetime{0.0, 1.0};
  std::vector<std::pair<std::u16string, Entity*>> _effects;
  Value _effect_data;
  bool _effect_data_loaded = false;
};

// TS `grant_buff(kind, attacker, victim, duration = 0)`：`lfw` / `world` 从 **victim** 上取
//（`const { lfw, world } = victim`），没有 env 参数。
Buff* grant_buff(const std::u16string& kind, Entity* attacker, Entity* victim,
                 double duration = 0);

}
}
