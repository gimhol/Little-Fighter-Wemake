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

namespace buff {

class Buff;

// 实体接口已退役（切片 4BY）：`buff` 系统直接以 `lfw::Entity` 为宿主面，原先的
// `Entity` 窄接口连同其 34 个方法一并删除（空值与缺省语义由 `Entity` 自身承担）。

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

struct BuffEnv {
  std::function<Entity*(const std::u16string& id)> find_entity;
  std::function<Entity*(const Value& data)> create_entity;
  std::function<Value(const std::u16string& oid)> find_data;
  std::function<void(const std::u16string& id, Buff* b)> world_buffs_set;
  std::function<Buff*(const std::u16string& id)> world_buffs_get;
  std::function<Buff*(const std::u16string& kind, const std::u16string& id)> create_buff;
};

class Buff {
 public:
  // `virtual`：端口有 7 个 buff 子类，台面按 `std::unique_ptr<Buff>` 持有派生对象 ⇒ 非虚析构
  // 会让派生析构永不执行（clang 只在编译到删除点时才报；删除点在台面里）。
  virtual ~Buff() = default;
  Buff(const BuffEnv* env, const std::u16string& id, const Value& kind);

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

  // 池化复用（`Factory::recycle_buff` → 下一次 `create_buff`）会把这个对象交给**下一个**
  // 世界的实体；而 `_effects` 是裸 `Entity*`、`_victims` 是上一局的 id ⇒ 换宿主时必须丢掉。
  void set_env(const BuffEnv* env) {
    if (_env != nullptr && _env != env) drop_cached_refs();
    _env = env;
  }
  const BuffEnv* env() const { return _env; }
  virtual void init() {}
  void reset(const std::u16string& id);
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

  const BuffEnv* _env = nullptr;
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

Buff* grant_buff(const BuffEnv* env, const std::u16string& kind, Entity* attacker,
                 Entity* victim, double duration);

}
}
