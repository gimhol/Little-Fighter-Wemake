// `Factory`（`src/LFW/Factory.ts`）的 C++ 侧台面，op 与 `subjects/factory.ts` 一一对应。
//
// 切片 4CJ：`IEntityHost` 退役 ⇒ 实体的宿主就是真 `lfw::World`（共享的 `fx::shared_world()`，
// 没人脚本化它的面）。实体 / buff / 控制器都用端口的真类（TS 侧是 duck-typed 的假对象），
// 两边只比较**日志**：谁被造出来、复用了几次、`reset` / `init` 调了几次。
#include <cstdio>
#include <fstream>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/controller/base_controller.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/factory.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using trace::key_of;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;
using trace::to_u16;

std::vector<std::string> g_log;

void push(const std::string& line) { g_log.push_back(line); }

// 假 buff：`kind` 由 creator 给；`init` 是虚函数（`reset` 不是 ⇒ 端口这边看不到 reset 次数，
// 台面只统计 init，TS 侧同样只统计 init）。
class FakeBuff : public lfw::buff::Buff {
 public:
  FakeBuff(lfw::LFW& lfw, const std::u16string& id, const lfw::Value& kind)
      : lfw::buff::Buff(lfw, id, kind) {}
  int inits = 0;
  void init() override { ++inits; }
};

// 假控制器：只关心「建了几次 / reset 了几次 / player_id 是谁」。
class FakeCtrl : public lfw::controller::BaseController {
 public:
  explicit FakeCtrl(std::string tag) : _tag(std::move(tag)) {}
  int resets = 0;
  void reset() override {
    lfw::controller::BaseController::reset();
    ++resets;
  }
  const std::string& tag() const { return _tag; }

 private:
  std::string _tag;
};

// `release_ctrl` 用 `ctrl->creator()` 当归池键，台面要知道每个实例的 reset 次数 ⇒ 自己存一份。
std::map<const lfw::controller::BaseController*, FakeCtrl*> g_ctrl_fakes;
// label -> 造出来的控制器 / buff（`rel-ctrl` / `rec-buff` 从这里按序取）。
std::map<std::string, std::vector<FakeCtrl*>> g_ctrls;
std::map<std::string, std::vector<FakeBuff*>> g_buffs;

struct EntityCreator {
  std::string label;
  lfw::IEntityCreators fn;
};

struct CtrlCreator : lfw::ICtrlCreator {
  std::string label;
  lfw::controller::BaseController* create(const std::u16string& player_id,
                                         lfw::Entity* entity) const override {
    (void)entity;
    auto c = std::make_unique<FakeCtrl>(label);
    c->player_id = player_id;
    push("newctrl:" + label + "|" + to_ascii(player_id));
    FakeCtrl* const raw = c.get();
    const_cast<CtrlCreator*>(this)->owned.push_back(std::move(c));
    g_ctrl_fakes[raw] = raw;
    g_ctrls[label].push_back(raw);
    return raw;
  }
  // `create` 是 const（TS 的构造函数没有 const 概念）⇒ 存放用 mutable。
  mutable std::vector<std::unique_ptr<FakeCtrl>> owned;
};

struct BuffCreator : lfw::IBuffCreator {
  lfw::Value kind_v;
  std::vector<lfw::Value> groups_v;
  std::string label;
  const lfw::Value& kind() const override { return kind_v; }
  const std::vector<lfw::Value>& groups() const override { return groups_v; }
  lfw::buff::Buff* create(lfw::LFW* lfw, const std::u16string& id,
                          const lfw::Value& kind) const override {
    auto b = std::make_unique<FakeBuff>(*lfw, id, kind);
    push("newbuff:" + label + "|" + to_ascii(render_value(kind_v)));
    FakeBuff* const raw = b.get();
    const_cast<BuffCreator*>(this)->owned.push_back(std::move(b));
    g_buffs[label].push_back(raw);
    return raw;
  }
  mutable std::vector<std::unique_ptr<FakeBuff>> owned;
};

std::map<std::string, std::vector<lfw::Entity*>> g_entities;         // label -> 造出来的实体
std::vector<std::unique_ptr<lfw::Entity>> g_entity_storage;
std::vector<std::unique_ptr<EntityCreator>> g_ent_creators;
std::vector<std::unique_ptr<CtrlCreator>> g_ctrl_creators;
std::vector<std::unique_ptr<BuffCreator>> g_buff_creators;
lfw::Factory g_factory;

lfw::Entity* make_entity(const std::string& label, const lfw::Value& data) {
  g_entity_storage.push_back(std::make_unique<lfw::Entity>(fx::shared_world(), data));
  lfw::Entity* const e = g_entity_storage.back().get();
  g_entities[label].push_back(e);
  push("e:" + label);
  return e;
}

// 池键的显示：`Value`（实体 / buff 池）直接渲染，控制器池的键是 creator 指针 ⇒ 显示它的 label。
std::string pool_key_text(const lfw::Value& key) { return to_ascii(render_value(key)); }

std::string pool_key_text(const lfw::ICtrlCreator* const& key) {
  for (const auto& c : g_ctrl_creators) {
    if (c.get() == key) return c->label;
  }
  return "?";
}

// 某个 buff kind 对应的 creator label：工厂的表是**覆盖**语义 ⇒ 取最后注册的那个
// （同名 label 重注册后，旧实例仍在 `g_buff_creators` 里）。
std::string label_of_buff_creator(const lfw::Value& kind) {
  std::string found = "?";
  for (const auto& c : g_buff_creators) {
    if (lfw::strict_equals(c->kind_v, kind)) found = c->label;
  }
  return found;
}

void dump() {
  auto render_keys = [](const std::vector<lfw::FactoryKey>& keys) {
    std::string out = "[";
    for (size_t i = 0; i < keys.size(); ++i) {
      if (i != 0) out += ",";
      out += to_ascii(render_value(keys[i]));
    }
    return out + "]";
  };
  std::vector<lfw::FactoryKey> ent_keys;
  for (const auto& kv : lfw::Factory::entity_creators()) ent_keys.push_back(kv.first);
  std::vector<lfw::FactoryKey> ctrl_keys;
  for (const auto& kv : lfw::Factory::ctrl_creators()) ctrl_keys.push_back(kv.first);
  std::vector<lfw::FactoryKey> buff_keys;
  for (const auto& kv : lfw::Factory::buff_creators()) buff_keys.push_back(kv.first);

  std::string groups = "[";
  for (size_t i = 0; i < lfw::Factory::buff_groups().size(); ++i) {
    if (i != 0) groups += ",";
    const auto& g = lfw::Factory::buff_groups()[i];
    groups += to_ascii(render_value(g.first)) + "=" + render_keys(g.second);
  }
  groups += "]";

  auto render_sizes = [](auto& pools) {
    std::string out = "[";
    for (size_t i = 0; i < pools.size(); ++i) {
      if (i != 0) out += ",";
      size_t live = 0;
      for (const auto& slot : pools[i].second.l()) {
        if (slot.has_value()) ++live;
      }
      out += pool_key_text(pools[i].first) + "=" + std::to_string(live);
    }
    return out + "]";
  };

  push("dump|entities=" + render_keys(ent_keys) + "|ctrls=" + render_keys(ctrl_keys) +
       "|buffs=" + render_keys(buff_keys) + "|groups=" + groups +
       "|graves=" + render_sizes(g_factory.graves_maps) +
       "|bgraves=" + render_sizes(g_factory.buff_graves_maps) +
       "|cgraves=" + render_sizes(g_factory.ctrl_graves_maps));
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_factory <case-file>\n");
    return 2;
  }

  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "cannot open case file: %s\n", argv[1]);
    return 2;
  }

  lfw::Factory::set_warn([](const std::u16string& text) { push("warn:" + to_ascii(text)); });

  // TS 侧的这份台面只 import `Factory.ts`（没引 `Entity.ts`）⇒ 它的创建器表是空的；
  // C++ 这边 `entity.cpp` 的模块级注册（`regist_entities`）一定会被链进来 ⇒ 台面自己清一遍对齐。
  lfw::Factory::entity_creators().clear();

  std::string raw;
  int lineno = 0;
  while (std::getline(in, raw)) {
    ++lineno;
    const std::vector<std::string> t = split_ws(trace::strip_comment(raw));
    if (t.empty()) continue;
    const std::string& op = t[0];
    size_t i = 1;

    if (op == "regent") {
      const lfw::Value key = parse_value(t, i);
      const std::string label = to_ascii(key_of(t[i++]));
      auto holder = std::make_unique<EntityCreator>();
      holder->label = label;
      holder->fn = [label](lfw::World*, const lfw::Value& data, lfw::state::States*) {
        push("create:" + label + "|" + to_ascii(render_value(data)));
        if (label == "miss") return static_cast<lfw::Entity*>(nullptr);
        return make_entity(label, data);
      };
      g_ent_creators.push_back(std::move(holder));
      lfw::Factory::register_entity(key, g_ent_creators.back()->fn);
    } else if (op == "regctrl") {
      const lfw::Value key = parse_value(t, i);
      auto holder = std::make_unique<CtrlCreator>();
      holder->label = to_ascii(key_of(t[i++]));
      CtrlCreator* const raw_creator = holder.get();
      g_ctrl_creators.push_back(std::move(holder));
      g_ctrls[raw_creator->label];   // 建好空列表，`rel-ctrl` 能找见
      lfw::Factory::register_ctrl(key, raw_creator);
    } else if (op == "regbuff") {
      const lfw::Value kind = parse_value(t, i);
      auto holder = std::make_unique<BuffCreator>();
      holder->kind_v = kind;
      holder->label = to_ascii(key_of(t[i++]));
      while (i < t.size()) holder->groups_v.push_back(lfw::Value(key_of(t[i++])));
      BuffCreator* const raw_creator = holder.get();
      g_buff_creators.push_back(std::move(holder));
      g_buffs[raw_creator->label];
      lfw::Factory::register_buff(raw_creator);
    } else if (op == "ce") {
      const lfw::Value key = parse_value(t, i);
      const lfw::Value data = parse_value(t, i);
      lfw::Entity* const ret = g_factory.create_entity(nullptr, data, nullptr);
      push("ce:" + to_ascii(render_value(key)) + "|" + (ret == nullptr ? "u" : "hit"));
    } else if (op == "cebot") {
      const std::u16string pid = key_of(t[i++]);
      const lfw::Value key = parse_value(t, i);
      const lfw::Value data = parse_value(t, i);
      lfw::Entity* const ret = g_factory.create_entity_with_bot(pid, nullptr, data, nullptr);
      push("cebot:" + to_ascii(render_value(key)) + "|" + (ret == nullptr ? "u" : "hit") +
           "|ctrl=" + (ret != nullptr && ret->ctrl() != nullptr ? "hit" : "u"));
    } else if (op == "acq-e") {
      const lfw::Value key = parse_value(t, i);
      lfw::Entity* const ret = g_factory.acquire_entity(key);
      push("acq-e:" + to_ascii(render_value(key)) + "|" +
           (ret == nullptr ? "u" : "hit:" + to_ascii(render_value(ret->data()))));
    } else if (op == "rec-e") {
      const std::string label = to_ascii(key_of(t[i++]));
      auto it = g_entities.find(label);
      if (it == g_entities.end() || it->second.empty()) {
        std::fprintf(stderr, "no entity for label '%s' at line %d\n", label.c_str(), lineno);
        return 2;
      }
      lfw::Entity* const e = it->second.front();
      it->second.erase(it->second.begin());
      g_factory.recycle_entity(e);
      push("rec-e:" + label);
    } else if (op == "newctrl") {
      const lfw::Value oid = parse_value(t, i);
      const std::u16string pid = key_of(t[i++]);
      lfw::controller::BaseController* const ret =
          g_factory.create_ctrl(oid, pid, nullptr);
      push("newctrl-call:" + to_ascii(render_value(oid)) + "|" +
           (ret == nullptr ? "u" : "hit"));
    } else if (op == "acq-ctrl") {
      const std::string label = to_ascii(key_of(t[i++]));
      const std::u16string pid = key_of(t[i++]);
      const lfw::ICtrlCreator* cls = nullptr;
      for (const auto& c : g_ctrl_creators) {
        if (c->label == label) cls = c.get();
      }
      if (cls == nullptr) {
        std::fprintf(stderr, "unknown ctrl label '%s' at line %d\n", label.c_str(), lineno);
        return 2;
      }
      lfw::controller::BaseController* const ret = g_factory.acquire_ctrl(cls, pid, nullptr);
      const auto fit = g_ctrl_fakes.find(ret);
      push("acq-ctrl:" + label + "|" +
           (ret == nullptr ? "u"
                           : "hit:r" + std::to_string(fit == g_ctrl_fakes.end()
                                                          ? -1
                                                          : fit->second->resets) +
                                 "|p" + to_ascii(ret->player_id)));
    } else if (op == "rel-ctrl") {
      const std::string label = to_ascii(key_of(t[i++]));
      auto it = g_ctrls.find(label);
      if (it == g_ctrls.end() || it->second.empty()) {
        std::fprintf(stderr, "no ctrl for label '%s' at line %d\n", label.c_str(), lineno);
        return 2;
      }
      lfw::controller::BaseController* const c = it->second.front();
      it->second.erase(it->second.begin());
      g_factory.release_ctrl(c);
      push("rel-ctrl:" + label);
    } else if (op == "cbuff") {
      const lfw::Value kind = parse_value(t, i);
      const std::u16string id = key_of(t[i++]);
      lfw::buff::Buff* const ret = g_factory.create_buff(kind, &fx::shared_lfw(), id);
      if (ret != nullptr) {
        FakeBuff* const fake = static_cast<FakeBuff*>(ret);
        std::vector<FakeBuff*>& list = g_buffs[label_of_buff_creator(kind)];
        bool known = false;
        for (const FakeBuff* const b : list) {
          if (b == fake) known = true;
        }
        if (!known) list.push_back(fake);
      }
      push("cbuff:" + to_ascii(render_value(kind)) + "|" +
           (ret == nullptr ? "u"
                           : "hit:" + to_ascii(ret->id()) + "|i" +
                                 std::to_string(static_cast<FakeBuff*>(ret)->inits)));
    } else if (op == "rec-buff") {
      const std::string label = to_ascii(key_of(t[i++]));
      auto it = g_buffs.find(label);
      if (it == g_buffs.end() || it->second.empty()) {
        std::fprintf(stderr, "no buff for label '%s' at line %d\n", label.c_str(), lineno);
        return 2;
      }
      FakeBuff* const b = it->second.front();
      it->second.erase(it->second.begin());
      g_factory.recycle_buff(b);
      push("rec-buff:" + label);
    } else if (op == "dump") {
      dump();
    } else {
      std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
      return 2;
    }

    if (i != t.size()) {
      std::fprintf(stderr, "trailing token(s) at line %d: %s\n", lineno, raw.c_str());
      return 2;
    }
    for (const std::string& l : g_log) std::printf("%s\n", l.c_str());
    g_log.clear();
  }
  return 0;
}
