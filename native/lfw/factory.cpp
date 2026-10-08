#include "lfw/factory.h"

#include <string>
#include <utility>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/controller/creators.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/ui/component/ui_component.h"
#include "lfw/ui/uinode.h"
#include "lfw/utils/container_help/field_or.h"

namespace lfw {

namespace {

FactoryWarn g_warn;

// JS `Map` / `Set` 的键相等是 SameValueZero：`FactoryKey`（`Value`）走 `strict_equals`
// （`Number` / `String` 那一档与 JS 一致；`NaN` 当键这种角落不建模，记在偏差表），
// 控制器注册表 / 对象池的键是 `const ICtrlCreator*`（指针身份）⇒ 指针比较。
template <typename V>
size_t index_of(const std::vector<std::pair<FactoryKey, V>>& list, const FactoryKey& key) {
  for (size_t i = 0; i < list.size(); ++i) {
    if (strict_equals(list[i].first, key)) return i;
  }
  return static_cast<size_t>(-1);
}

template <typename V>
size_t index_of(const std::vector<std::pair<const ICtrlCreator*, V>>& list,
                const ICtrlCreator* const& key) {
  for (size_t i = 0; i < list.size(); ++i) {
    if (list[i].first == key) return i;
  }
  return static_cast<size_t>(-1);
}

// `map.set(k, v)`：已有键 ⇒ 改值但**位置不变**。
template <typename K, typename V>
void map_set(std::vector<std::pair<K, V>>& list, const K& key, const V& value) {
  const size_t i = index_of(list, key);
  if (i == static_cast<size_t>(-1)) {
    list.push_back(std::make_pair(key, value));
    return;
  }
  list[i].second = value;
}

// `Set.add`：判重后按插入序追加。
void set_add(std::vector<FactoryKey>& list, const FactoryKey& key) {
  for (const FactoryKey& v : list) {
    if (strict_equals(v, key)) return;
  }
  list.push_back(key);
}

// `graves_maps.get(k)`：缺就建一张（`recycle_*` 的写法）。
template <typename K, typename T>
Graves<T>& pool_of(std::vector<std::pair<K, Graves<T>>>& list, const K& key) {
  const size_t i = index_of(list, key);
  if (i != static_cast<size_t>(-1)) return list[i].second;
  list.push_back(std::make_pair(key, Graves<T>()));
  return list.back().second;
}

}

void Factory::set_warn(FactoryWarn warn) { g_warn = std::move(warn); }

void Factory::warn(const std::u16string& text) {
  if (g_warn) g_warn(text);
}

std::vector<std::pair<FactoryKey, IEntityCreators>>& Factory::entity_creators() {
  static std::vector<std::pair<FactoryKey, IEntityCreators>> list;
  return list;
}

std::vector<std::pair<FactoryKey, const ICtrlCreator*>>& Factory::ctrl_creators() {
  static std::vector<std::pair<FactoryKey, const ICtrlCreator*>> list;
  return list;
}

std::vector<std::pair<FactoryKey, const IBuffCreator*>>& Factory::buff_creators() {
  static std::vector<std::pair<FactoryKey, const IBuffCreator*>> list;
  return list;
}

std::vector<std::pair<Value, std::vector<FactoryKey>>>& Factory::buff_groups() {
  static std::vector<std::pair<Value, std::vector<FactoryKey>>> list;
  return list;
}

std::vector<std::pair<std::u16string, const IComponentCreator*>>& Factory::components() {
  static std::vector<std::pair<std::u16string, const IComponentCreator*>> list;
  return list;
}

void Factory::register_component(const std::u16string& name, const IComponentCreator* creator) {
  std::vector<std::pair<std::u16string, const IComponentCreator*>>& list = components();
  for (std::pair<std::u16string, const IComponentCreator*>& entry : list) {
    if (entry.first == name) {
      warn(u"[Factory::register_component] name already exists, " + name);
      entry.second = creator;
      return;
    }
  }
  list.push_back(std::make_pair(name, creator));
}

void Factory::register_entity(const FactoryKey& type, const IEntityCreators& creator) {
  if (index_of(entity_creators(), type) != static_cast<size_t>(-1)) {
    warn(u"[Factory::register_entity] type already exists, " + to_string(type));
  }
  map_set(entity_creators(), type, creator);
}

void Factory::register_ctrl(const FactoryKey& oid, const ICtrlCreator* creator) {
  if (index_of(ctrl_creators(), oid) != static_cast<size_t>(-1)) {
    warn(u"[Factory::register_ctrl] oid already exists, " + to_string(oid));
  }
  map_set(ctrl_creators(), oid, creator);
}

void Factory::register_buff(const IBuffCreator* creator) {
  const Value& kind = creator->kind();
  if (index_of(buff_creators(), kind) != static_cast<size_t>(-1)) {
    warn(u"[Factory::register_buff] kind already exists, " + to_string(kind));
  }
  for (const Value& g : creator->groups()) {
    const size_t i = index_of(buff_groups(), g);
    if (i == static_cast<size_t>(-1)) {
      buff_groups().push_back(std::make_pair(g, std::vector<FactoryKey>()));
      set_add(buff_groups().back().second, kind);
    } else {
      set_add(buff_groups()[i].second, kind);
    }
  }
  map_set(buff_creators(), kind, creator);
}

buff::Buff* Factory::create_buff(const FactoryKey& kind, LFW* lfw, const std::u16string& id) {
  const size_t ci = index_of(buff_creators(), kind);
  if (ci == static_cast<size_t>(-1)) return nullptr;
  const IBuffCreator* const b = buff_creators()[ci].second;
  buff::Buff* ret = nullptr;
  const size_t pi = index_of(buff_graves_maps, kind);
  if (pi != static_cast<size_t>(-1)) {
    const std::optional<buff::Buff*> taken = buff_graves_maps[pi].second.take();
    if (taken.has_value()) ret = *taken;
  }
  if (ret == nullptr) ret = b->create(lfw, id, b->kind());
  ret->reset(id);
  ret->init();
  return ret;
}

Factory& Factory::recycle_buff(buff::Buff* buff) {
  pool_of(buff_graves_maps, buff->kind()).add(buff);
  return *this;
}

Factory& Factory::recycle_entity(Entity* e) {
  pool_of(graves_maps, field_or(e->data(), u"type")).add(e);
  return *this;
}

Entity* Factory::acquire_entity(const FactoryKey& type) {
  const size_t i = index_of(graves_maps, type);
  if (i == static_cast<size_t>(-1)) return nullptr;
  const std::optional<Entity*> taken = graves_maps[i].second.take();
  return taken.has_value() ? *taken : nullptr;
}

Entity* Factory::create_entity(World* world, const Value& data, state::States* states) {
  const size_t i = index_of(entity_creators(), field_or(data, u"type"));
  if (i == static_cast<size_t>(-1)) return nullptr;
  return entity_creators()[i].second(world, data, states);
}

controller::BaseController* Factory::create_ctrl(const FactoryKey& oid,
                                                 const std::u16string& player_id, Entity* entity) {
  const size_t i = index_of(ctrl_creators(), oid);
  if (i == static_cast<size_t>(-1)) return nullptr;
  return acquire_ctrl(ctrl_creators()[i].second, player_id, entity);
}

controller::BaseController* Factory::acquire_ctrl(const ICtrlCreator* cls,
                                                  const std::u16string& player_id, Entity* entity) {
  const size_t i = index_of(ctrl_graves_maps, cls);
  if (i != static_cast<size_t>(-1)) {
    const std::optional<controller::BaseController*> taken = ctrl_graves_maps[i].second.take();
    if (taken.has_value()) {
      controller::BaseController* const ret = *taken;
      // TS 的 `reset(player_id, entity)`：端口把两者放在 env / 公开字段上（见 DESIGN）。
      ret->player_id = player_id;
      ret->reset();
      return ret;
    }
  }
  controller::BaseController* const ret = cls->create(player_id, entity);
  ret->set_creator(cls);
  return ret;
}

Factory& Factory::release_ctrl(controller::BaseController* ctrl) {
  if (ctrl == nullptr) return *this;
  pool_of(ctrl_graves_maps, ctrl->creator()).add(ctrl);
  return *this;
}

Entity* Factory::create_entity_with_bot(const std::u16string& player_id, World* world,
                                        const Value& data, state::States* states) {
  const size_t i = index_of(entity_creators(), field_or(data, u"type"));
  if (i == static_cast<size_t>(-1)) return nullptr;
  Entity* const ret = entity_creators()[i].second(world, data, states);
  if (ret == nullptr) return ret;
  ret->set_ctrl(create_ctrl(field_or(data, u"id"), player_id, ret));
  return ret;
}

Entity* Factory::create_entity_with_player(const std::u16string& player_id, World* world,
                                           const Value& data, state::States* states) {
  const size_t i = index_of(entity_creators(), field_or(data, u"type"));
  if (i == static_cast<size_t>(-1)) return nullptr;
  Entity* const ret = entity_creators()[i].second(world, data, states);
  if (ret == nullptr) return ret;
  ret->set_ctrl(acquire_ctrl(controller::local_controller_creator(), player_id, ret));
  return ret;
}

std::vector<std::unique_ptr<ui::UIComponent>> Factory::create_components(ui::UINode& layout,
                                                                         const Value& components) {
  std::vector<std::unique_ptr<ui::UIComponent>> ret;
  const Array* const arr = as_array(components);
  if (arr == nullptr || arr->size() == 0) return ret;

  for (size_t idx = 0; idx < arr->size(); ++idx) {
    const Value& info = arr->at(idx);
    const Object* const info_o = as_object(info);
    const Value* const cls_p = info_o != nullptr ? info_o->get(u"cls") : nullptr;
    // `${info.cls}`：缺失 ⇒ "undefined"。
    const std::u16string cls = cls_p != nullptr ? to_string(*cls_p) : u"undefined";
    const IComponentCreator* clz = nullptr;
    for (const std::pair<std::u16string, const IComponentCreator*>& entry : Factory::components()) {
      if (entry.first == cls) {
        clz = entry.second;
        break;
      }
    }
    if (clz == nullptr) {
      warn(u"[Factory::create_components] Component not found! cls: " + cls);
      continue;
    }
    const auto field_of_info = [&](const char16_t* key) -> const Value* {
      return info_o != nullptr ? info_o->get(std::u16string(key)) : nullptr;
    };
    // `info.id ?? `${cls}_${idx}``、`info.name ?? id`（`??` 只吃 nullish）。
    std::u16string id;
    {
      const Value* const id_p = field_of_info(u"id");
      id = id_p != nullptr && !std::holds_alternative<std::monostate>(*id_p) &&
                   !std::holds_alternative<NullTag>(*id_p)
               ? to_string(*id_p)
               : cls + u"_" + number_to_string(static_cast<double>(idx));
    }
    std::u16string name;
    {
      const Value* const name_p = field_of_info(u"name");
      name = name_p != nullptr && !std::holds_alternative<std::monostate>(*name_p) &&
                     !std::holds_alternative<NullTag>(*name_p)
                 ? to_string(*name_p)
                 : id;
    }
    Value rinfo(std::make_shared<Object>());
    Object* const ro = as_object(rinfo);
    ro->set(u"id", Value(id));
    ro->set(u"name", Value(name));
    ro->set(u"cls", Value(cls));
    {
      const auto or_default = [&](const char16_t* key, Value fallback) -> Value {
        const Value* const p = field_of_info(key);
        if (p == nullptr || std::holds_alternative<std::monostate>(*p) ||
            std::holds_alternative<NullTag>(*p)) {
          return fallback;
        }
        return *p;
      };
      ro->set(u"args", or_default(u"args", Value(std::make_shared<Array>())));
      ro->set(u"enabled", or_default(u"enabled", Value(true)));
      ro->set(u"properties", or_default(u"properties", Value(std::make_shared<Object>())));
      ro->set(u"props", or_default(u"props", Value(std::make_shared<Object>())));
      ro->set(u"weight", or_default(u"weight", Value(0.0)));
    }
    std::unique_ptr<ui::UIComponent> component(clz->create(layout, name, rinfo));
    if (component) component->init();
    ret.push_back(std::move(component));
  }
  return ret;
}

}
