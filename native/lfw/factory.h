#pragma once

#include <functional>
#include <string>
#include <utility>
#include <vector>

#include "lfw/base/graves.h"
#include "lfw/controller/base_controller.h"
#include "lfw/core/value.h"

namespace lfw {

namespace buff {
class Buff;
}
namespace state {
class States;
}
class Entity;
class LFW;
class World;

// TS `Key = string | number | symbol`：注册表 / 对象池的键。端口用 `Value`（`1` 与 `"1"` 分开，
// 与 JS 的 `Map` 一致）；`symbol` 不建模（记 README 偏差表）。
using FactoryKey = Value;

// TS `IEntityCreators`：`(world, data, states?) => Entity | undefined`。`data` 给 `Value`
// （与 `entity/entity.h` 的 `create_entity_with_bot(const Value&)` 一致），`World` 只前置声明。
using IEntityCreators = std::function<Entity*(World*, const Value&, state::States*)>;

// TS `ICtrlCreator` 是「类本身」：`new (player_id, entity) => BaseController`。注册表与对象池都用
// 这个**类**当键（`release_ctrl` 用 `ctrl.constructor`）⇒ 端口给一个接口，用指针身份当键。
class ICtrlCreator {
 public:
  virtual ~ICtrlCreator() = default;
  virtual controller::BaseController* create(const std::u16string& player_id,
                                             Entity* entity) const = 0;
};

// TS `IBuffCreator`：类上带 `KIND` / `GROUPS`，构造是 `new B(lfw, id, B.KIND)`。
class IBuffCreator {
 public:
  virtual ~IBuffCreator() = default;
  virtual const Value& kind() const = 0;
  virtual const std::vector<Value>& groups() const = 0;
  virtual buff::Buff* create(LFW* lfw, const std::u16string& id, const Value& kind) const = 0;
};

namespace ui {
class UIComponent;
class UINode;
}

// TS `Factory.components` 里的一格：`class X extends UIComponent` 的构造器化身。
class IComponentCreator {
 public:
  virtual ~IComponentCreator() = default;
  virtual ui::UIComponent* create(ui::UINode& layout, const std::u16string& f_name,
                                  const Value& info) const = 0;
};

// `Ditto.warn`（`register_*` 的重复告警用）。TS 是全局 `Ditto.warn` ⇒ 端口给一个进程级 sink。
using FactoryWarn = std::function<void(const std::u16string&)>;

// TS `Factory`。
//
// 四张表都用「插入序 + 判重」的 vector 装：JS 的 `Map` / `Set` 是插入序，且覆盖已有键时**位置
// 不变**（`std::map` / `std::set` 会按序重排，遍历时就与 TS 不同了）。`Factory` 本身只按键查表，
// 但差分台面要看表的内容 ⇒ 端口保持同一套顺序语义。
class Factory {
 public:
  static constexpr const char* TAG = "Factory";

  static void set_warn(FactoryWarn warn);
  static void warn(const std::u16string& text);

  static std::vector<std::pair<FactoryKey, IEntityCreators>>& entity_creators();
  static std::vector<std::pair<FactoryKey, const ICtrlCreator*>>& ctrl_creators();
  static std::vector<std::pair<FactoryKey, const IBuffCreator*>>& buff_creators();
  static std::vector<std::pair<Value, std::vector<FactoryKey>>>& buff_groups();
  static std::vector<std::pair<std::u16string, const IComponentCreator*>>& components();

  static void register_entity(const FactoryKey& type, const IEntityCreators& creator);
  static void register_ctrl(const FactoryKey& oid, const ICtrlCreator* creator);
  static void register_buff(const IBuffCreator* creator);
  // TS `register_component(Cls)`：按 `Cls.TAGS` 逐个登记，重名只 warn。
  static void register_component(const std::u16string& name, const IComponentCreator* creator);

  // TS 的三个 `readonly` 池表。
  std::vector<std::pair<FactoryKey, Graves<Entity*>>> graves_maps;
  std::vector<std::pair<FactoryKey, Graves<buff::Buff*>>> buff_graves_maps;
  std::vector<std::pair<const ICtrlCreator*, Graves<controller::BaseController*>>> ctrl_graves_maps;

  buff::Buff* create_buff(const FactoryKey& kind, LFW* lfw, const std::u16string& id);
  Factory& recycle_buff(buff::Buff* buff);
  Factory& recycle_entity(Entity* e);
  Entity* acquire_entity(const FactoryKey& type);
  Entity* create_entity(World* world, const Value& data, state::States* states);
  controller::BaseController* create_ctrl(const FactoryKey& oid, const std::u16string& player_id,
                                          Entity* entity);
  controller::BaseController* acquire_ctrl(const ICtrlCreator* cls,
                                           const std::u16string& player_id, Entity* entity);
  Factory& release_ctrl(controller::BaseController* ctrl);
  Entity* create_entity_with_bot(const std::u16string& player_id, World* world, const Value& data,
                                 state::States* states);
  // TS `create_entity_with_player`：造实体后挂 `LocalController`（`acquire_ctrl`）。
  Entity* create_entity_with_player(const std::u16string& player_id, World* world,
                                    const Value& data, state::States* states);
  // TS `create_components(layout, components)`：按 `cls` 查组件表建实例（返回所有权）。
  std::vector<std::unique_ptr<ui::UIComponent>> create_components(ui::UINode& layout,
                                                                  const Value& components);
};

}
