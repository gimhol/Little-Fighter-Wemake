// `helper/` 家族 + `Keys` + `JoinQueue` 的 C++ 侧台面，op 与 `subjects/helpers.ts` 一一对应。
//
// 实体是真的 `Entity`（挂 `fx::shared_world()`：`on_add_entities` 钩子出 `attach|<id>|<team>`
// 日志，对应 TS 侧假件 `attach()` 的日志）；`lfw.*` 那几族缝（4CO/4CW 退役，假件派生真 `LFW`）与
// 全是脚本化假件。`mt` 固定种子 12345。
//
// op 一览：
//   mk <id> <type> <e|g>           预置实体进 entities/ghosts
//   fdata <id> / wdata <id> <g1|g2|->   脚本化数据表
//   dumpents / ob.all / ba.all / ch.all / we.all / ob.at <i> / ob.a / ob.b
//   ob.add <n> <team> <type> <id>       team: `-`=undefined / `q`='?' / `empty`='' / 字面
//   ch.add <n> <team> <id> / ch.addr <n> <team> <f|->（按 id 过滤）
//   we.add <n> <team> <id> / we.rand <groups> <d|n> / we.addr <n> <d|n> <groups>
//   ob.delall / ob.tr
//   keys.mount / keys.unmount / keys.time / keys.get <k> / keys.hit <k> <t|-> / keys.end <k>
//   keys.isstart <k> / keys.isend <k> / keys.use <k> / keys.reset <k> / keys.ts <k>
//   ui.add <id...> / ui.clear / ui.all / ui.push <id> <i> / ui.set <id> <i>
//   jq.new <cap> / jq.enq <q> <uid> <name> <oid|-> / jq.deq <q> / jq.rm <q> <uid>
//   jq.has <q> <uid> / jq.size <q> / jq.all <q> / jq.clear <q>
//   pick <order-csv> <counts-csv> <caps-csv> <fallen|->
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "lfw/controller/base_controller.h"
#include "lfw/controller/key_status.h"
#include "lfw/core/js_string.h"
#include "lfw/entity/entity.h"
#include "lfw/helper/balls_helper.h"
#include "lfw/helper/characters_helper.h"
#include "lfw/helper/entities_helper.h"
#include "lfw/helper/join_queue.h"
#include "lfw/helper/ui_helper.h"
#include "lfw/helper/weapons_helper.h"
#include "lfw/utils/eval_number.h"
#include "lfw/keys.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/mersenne_twister.h"

#include "entity_fixture.h"
#include "trace_util.h"
#include "world_fixture.h"

namespace {

using trace::key_of;
using trace::parse_value;
using trace::split_ws;
using trace::strip_comment;
using trace::to_ascii;
using trace::to_u16;

// `to_double` 兼顾两种实参：op 里的裸 token（string）与 `key_of` 出来的 u16。
inline double to_double(const std::string& s) { return trace::to_double(s); }
inline double to_double(const std::u16string& s) {
  return std::strtod(trace::to_ascii(s).c_str(), nullptr);
}

std::vector<std::string> g_log;
// `eval_number` 的具名量上下文（`evctx` op 填，跨行保留）。
lfw::utils::EvalContext g_ev_ctx;

void push(const std::string& line) { g_log.push_back(line); }

lfw::MersenneTwister g_mt(12345);
std::vector<lfw::Entity*> g_ents;
std::vector<lfw::Entity*> g_ghosts;
std::vector<std::unique_ptr<lfw::Entity>> g_owned;
std::vector<lfw::Value> g_fdatas;
std::vector<lfw::Value> g_wdatas;
double g_team_counter = 8;
double g_cfail_left = 0;

std::string fmt_id(const std::u16string& s) { return s.empty() ? "u" : to_ascii(s); }

std::string fmt_id(const lfw::Value& v) {
  const std::u16string* const s = std::get_if<std::u16string>(&v);
  return s != nullptr ? fmt_id(*s) : "u";
}

std::string fmt_team(const std::u16string& s) { return s.empty() ? "u" : to_ascii(s); }

std::string num(double d) { return to_ascii(lfw::number_to_string(d)); }

// `attach` 的观测点：TS 侧在假实体的 `attach()` 里打这行日志；端口这面就是
// `TestWorld::add_entities` 的钩子。`new_id` 走共享假 `lfw`（`e<N>` 计数，与原先同一个口径），
// `world.game_time` 是新世界（`_value = 0`）⇒ 与旧宿主的 `0.0` 一致。
void bind_ent_attach() {
  fx::shared_world().on_add_entities = [](lfw::Entity& e) {
    push("attach|" + fmt_id(e.id) + "|" + fmt_team(e.team()));
    g_ents.push_back(&e);
  };
}

lfw::Value make_data(double type, const std::u16string& id) {
  lfw::Object o;
  o.set(u"type", lfw::Value(type));
  o.set(u"id", lfw::Value(id));
  return lfw::Value(std::make_shared<lfw::Object>(o));
}

// `EntityEnum`：Fighter=8 / Weapon=16 / Ball=32。
double type_num(const std::u16string& t) {
  if (t == u"Fighter") return 8.0;
  if (t == u"Weapon") return 16.0;
  if (t == u"Ball") return 32.0;
  return std::strtod(to_ascii(t).c_str(), nullptr);
}
const lfw::Value* find_in(const std::vector<lfw::Value>& list, const lfw::Value& id) {
  for (const lfw::Value& v : list) {
    if (lfw::equals(lfw::field_or(v, u"id"), id)) return &v;
  }
  return nullptr;
}

class FakeLfw : public lfw::LFW {
 public:
  FakeLfw() : lfw::LFW(fx::shared_stub_host(), false) {}

  lfw::MersenneTwister& mt_ref() override { return g_mt; }
  const std::vector<lfw::Entity*>& world_entities() override { return g_ents; }
  const std::vector<lfw::Entity*>& world_ghosts() override { return g_ghosts; }

  void del_entities(const std::vector<lfw::Entity*>& list) override {
    std::string ids;
    for (size_t i = 0; i < list.size(); ++i) {
      if (i != 0) ids += ",";
      ids += fmt_id(list[i]->id);
    }
    push("del:" + ids);
    for (lfw::Entity* const e : list) {
      for (size_t i = 0; i < g_ents.size();) {
        if (g_ents[i] == e) g_ents.erase(g_ents.begin() + static_cast<std::ptrdiff_t>(i));
        else ++i;
      }
      for (size_t i = 0; i < g_ghosts.size();) {
        if (g_ghosts[i] == e) g_ghosts.erase(g_ghosts.begin() + static_cast<std::ptrdiff_t>(i));
        else ++i;
      }
    }
  }

  lfw::Entity* create_entity(const lfw::Value& data) override {
    if (g_cfail_left > 0) {
      --g_cfail_left;
      push("create|fail");
      return nullptr;
    }
    push("create|" + fmt_id(lfw::field_or(data, u"id")));
    auto e = std::make_unique<lfw::Entity>(fx::shared_world(), data);
    lfw::Entity* const p = e.get();
    g_owned.push_back(std::move(e));
    return p;
  }

  lfw::controller::BaseController* create_ctrl(const lfw::Value& oid, const std::u16string& pid,
                                               lfw::Entity*) override {
    push("ctrl|" + fmt_id(oid) + "|" + to_ascii(pid));
    return nullptr;
  }

  const lfw::Value* find_fighter(const lfw::Value& id) override { return find_in(g_fdatas, id); }
  const lfw::Value* find_weapon(const lfw::Value& id) override { return find_in(g_wdatas, id); }
  const std::vector<lfw::Value>& fighters() override { return g_fdatas; }
  const std::vector<lfw::Value>& weapons() override { return g_wdatas; }

  std::u16string new_team() override {
    ++g_team_counter;
    return u"team_" + lfw::number_to_string(g_team_counter);
  }

  void random_entity_info(lfw::Entity& e) override {
    push("randominfo|" + fmt_id(e.id) + "|" + fmt_team(e.team()));
  }
};

// 切片 4CW（ck9）：`IKeysLfw` 退役 ⇒ 假件改成**派生真 `lfw::LFW`**，覆写面一字不改。
class FakeKeysLfw : public lfw::LFW {
 public:
  FakeKeysLfw() : lfw::LFW(fx::shared_stub_host(), false) {
    // 与其它假件同口径（DESIGN §149.2）：真 `LFW` 的构造会跑 `regist_buffs()` 等表级登记。
    lfw::Factory::buff_groups().clear();
    lfw::Factory::buff_creators().clear();
    lfw::Factory::components().clear();
  }

  double lifetime() override {
    push("lifetime");
    return 33.0;
  }
  void regist_keys(lfw::Keys&) override { push("regist"); }
  void recycle_keys(lfw::Keys&) override { push("recycle"); }
};

class FakeUiLfw : public lfw::LFW {
 public:
  FakeUiLfw() : lfw::LFW(fx::shared_stub_host(), false) {}

  void push_page(const lfw::Value& page, double stack_idx) override {
    push("push|" + fmt_id(lfw::field_or(page, u"id")) + "|" + num(stack_idx));
  }
  void set_page(const lfw::Value& page, double stack_idx) override {
    push("set|" + fmt_id(lfw::field_or(page, u"id")) + "|" + num(stack_idx));
  }
};

FakeLfw g_fake_lfw;
FakeKeysLfw g_fake_keys;
FakeUiLfw g_fake_ui;

std::vector<std::unique_ptr<lfw::helper::ObjectsHelper>> g_helpers_keep;
std::unique_ptr<lfw::helper::ObjectsHelper> g_ob;
std::unique_ptr<lfw::helper::BallsHelper> g_ba;
std::unique_ptr<lfw::helper::CharactersHelper> g_ch;
std::unique_ptr<lfw::helper::WeaponsHelper> g_we;
std::unique_ptr<lfw::helper::UIHelper> g_ui;
std::unique_ptr<lfw::Keys> g_keys;
std::vector<std::unique_ptr<lfw::helper::JoinQueue>> g_jqs;

std::string all_ids(const std::vector<lfw::Entity*>& list) {
  std::string out;
  for (size_t i = 0; i < list.size(); ++i) {
    if (i != 0) out += ",";
    out += fmt_id(list[i]->id);
  }
  return out;
}

std::string dump_created(const std::vector<lfw::Entity*>& list) {
  std::string out;
  for (size_t i = 0; i < list.size(); ++i) {
    if (i != 0) out += ",";
    out += fmt_id(list[i]->id) + ":" + fmt_team(list[i]->team());
  }
  return out;
}

void mk_entity(const std::u16string& id, const std::u16string& type, const std::string& target) {
  auto e = std::make_unique<lfw::Entity>(fx::shared_world(), make_data(type_num(type), id));
  e->id = id;
  lfw::Entity* const p = e.get();
  g_owned.push_back(std::move(e));
  if (target == "g") g_ghosts.push_back(p);
  else g_ents.push_back(p);
}

const std::u16string* team_token(const std::string& t, std::u16string& storage) {
  if (t == "-") return nullptr;
  if (t == "q") storage = u"?";
  else if (t == "empty") storage = u"";
  else storage = key_of(t);
  return &storage;
}

std::vector<std::pair<std::u16string, double>> csv_pairs(const std::string& s) {
  std::vector<std::pair<std::u16string, double>> out;
  std::string cur;
  std::vector<std::string> parts;
  for (const char c : s) {
    if (c == ',') {
      parts.push_back(cur);
      cur.clear();
    } else {
      cur.push_back(c);
    }
  }
  parts.push_back(cur);
  for (const std::string& part : parts) {
    const size_t colon = part.find(':');
    out.emplace_back(key_of(part.substr(0, colon)), to_double(part.substr(colon + 1)));
  }
  return out;
}

std::vector<std::u16string> csv_list(const std::string& s) {
  std::vector<std::u16string> out;
  std::string cur;
  for (const char c : s) {
    if (c == ',') {
      out.push_back(key_of(cur));
      cur.clear();
    } else {
      cur.push_back(c);
    }
  }
  out.push_back(key_of(cur));
  return out;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_helpers <case-file>\n");
    return 2;
  }
  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "cannot open case file: %s\n", argv[1]);
    return 2;
  }

  bind_ent_attach();
  g_ob = std::make_unique<lfw::helper::ObjectsHelper>(g_fake_lfw);
  g_ba = std::make_unique<lfw::helper::BallsHelper>(g_fake_lfw);
  g_ch = std::make_unique<lfw::helper::CharactersHelper>(g_fake_lfw);
  g_we = std::make_unique<lfw::helper::WeaponsHelper>(g_fake_lfw);
  g_ui = std::make_unique<lfw::helper::UIHelper>(g_fake_ui);
  g_keys = std::make_unique<lfw::Keys>(g_fake_keys);

  std::string raw;
  while (std::getline(in, raw)) {
    const std::vector<std::string> t = split_ws(strip_comment(raw));
    if (t.empty()) continue;
    const std::string& op = t[0];
    size_t i = 1;

    if (op == "mk") {
      const std::u16string id = key_of(t[i++]);
      const std::u16string type = key_of(t[i++]);
      mk_entity(id, type, t[i++]);
    } else if (op == "fdata") {
      g_fdatas.push_back(make_data(8.0, key_of(t[i++])));
    } else if (op == "wdata") {
      const std::u16string id = key_of(t[i++]);
      const std::string groups = t[i++];
      lfw::Object base;
      if (groups == "-") {
        base.set(u"group", lfw::Value());
      } else {
        auto arr = std::make_shared<lfw::Array>();
        std::string gcur;
        std::vector<std::string> gparts;
        for (const char c : groups) {
          if (c == '|') {
            gparts.push_back(gcur);
            gcur.clear();
          } else {
            gcur.push_back(c);
          }
        }
        gparts.push_back(gcur);
        for (const std::string& g : gparts) arr->push_back(lfw::Value(key_of(g)));
        base.set(u"group", lfw::Value(std::move(arr)));
      }
      lfw::Object o;
      o.set(u"type", lfw::Value(16.0));
      o.set(u"id", lfw::Value(id));
      o.set(u"base", lfw::Value(std::make_shared<lfw::Object>(base)));
      g_wdatas.push_back(lfw::Value(std::make_shared<lfw::Object>(o)));
    } else if (op == "dumpents") {
      push("ents:" + all_ids(g_ents) + "|ghosts:" + all_ids(g_ghosts));
    } else if (op == "ob.all") {
      push("ob.all:" + all_ids(g_ob->all()));
    } else if (op == "ba.all") {
      push("ba.all:" + all_ids(g_ba->all()));
    } else if (op == "ch.all") {
      push("ch.all:" + all_ids(g_ch->all()));
    } else if (op == "we.all") {
      push("we.all:" + all_ids(g_we->all()));
    } else if (op == "ob.at") {
      lfw::Entity* const e = g_ob->at(to_double(t[i++]));
      push("ob.at:" + (e == nullptr ? "u" : fmt_id(e->id)));
    } else if (op == "ob.a") {
      lfw::Entity* const e = g_ob->a();
      push("ob.a:" + (e == nullptr ? "u" : fmt_id(e->id)));
    } else if (op == "ob.b") {
      lfw::Entity* const e = g_ob->b();
      push("ob.b:" + (e == nullptr ? "u" : fmt_id(e->id)));
    } else if (op == "ob.add") {
      const double n = to_double(key_of(t[i++]));
      std::u16string team_storage;
      const std::u16string* const team = team_token(t[i++], team_storage);
      const std::u16string type = key_of(t[i++]);
      const std::u16string id = key_of(t[i++]);
      push("ob.add:" + dump_created(g_ob->add(make_data(type_num(type), id), n, team)));
    } else if (op == "ch.add") {
      const double n = to_double(key_of(t[i++]));
      std::u16string team_storage;
      const std::u16string* const team = team_token(t[i++], team_storage);
      const std::u16string id = key_of(t[i++]);
      push("ch.add:" + dump_created(g_ch->add(lfw::Value(id), n, team)));
    } else if (op == "ch.addr") {
      const double n = to_double(key_of(t[i++]));
      std::u16string team_storage;
      const std::u16string* const team = team_token(t[i++], team_storage);
      const std::string f = t[i++];
      std::function<bool(const lfw::Value&)> filter;
      const std::function<bool(const lfw::Value&)>* filter_ptr = nullptr;
      if (f != "-") {
        filter = [&f](const lfw::Value& v) { return lfw::equals(lfw::field_or(v, u"id"), lfw::Value(key_of(f))); };
        filter_ptr = &filter;
      }
      push("ch.addr:" + dump_created(g_ch->add_random(n, team, filter_ptr)));
    } else if (op == "we.add") {
      const double n = to_double(key_of(t[i++]));
      std::u16string team_storage;
      const std::u16string* const team = team_token(t[i++], team_storage);
      const std::u16string id = key_of(t[i++]);
      push("we.add:" + dump_created(g_we->add(lfw::Value(id), n, team)));
    } else if (op == "we.rand") {
      const std::u16string groups = key_of(t[i++]);
      const bool dup = t[i++] == "d";
      lfw::RandomingT<lfw::Value>* const r1 = g_we->randoms(groups, dup);
      lfw::RandomingT<lfw::Value>* const r2 = g_we->randoms(groups, dup);
      if (r1 == nullptr) {
        push("we.rand:u");
      } else {
        std::string src;
        for (size_t k = 0; k < r1->src().size(); ++k) {
          if (k != 0) src += ",";
          src += fmt_id(lfw::field_or(r1->src()[k], u"id"));
        }
        push("we.rand|" + to_ascii(r1->name()) + "|" + src + "|" + (r1 == r2 ? "1" : "0"));
      }
    } else if (op == "we.addr") {
      const double n = to_double(key_of(t[i++]));
      const bool dup = t[i++] == "d";
      const std::u16string groups = key_of(t[i++]);
      push("we.addr:" + dump_created(g_we->add_random(n, dup, groups)));
    } else if (op == "ob.delall") {
      g_ob->del_all();
      push("after.del:" + all_ids(g_ents) + "|" + all_ids(g_ghosts));
    } else if (op == "cfail") {
      g_cfail_left = to_double(key_of(t[i++]));
    } else if (op == "ob.tr") {
      lfw::RandomingT<lfw::Value>& r = g_ob->team_randoming();
      std::string src;
      for (size_t k = 0; k < r.src().size(); ++k) {
        if (k != 0) src += ",";
        src += fmt_id(r.src()[k]);
      }
      push("ob.tr|" + to_ascii(r.name()) + "|" + src + "|" + fmt_id(r.get()));
    } else if (op == "keys.mount") {
      g_keys->mount();
    } else if (op == "keys.unmount") {
      g_keys->unmount();
    } else if (op == "keys.time") {
      push("keys.time:" + num(g_keys->time()));
    } else if (op == "keys.get") {
      lfw::controller::KeyStatus* const st = g_keys->get(key_of(t[i++]));
      push("keys.get:" + (st == nullptr ? "u" : fmt_id(st->key())));
    } else if (op == "keys.list") {
      std::string ks;
      for (size_t k = 0; k < g_keys->list().size(); ++k) {
        if (k != 0) ks += ",";
        ks += to_ascii(g_keys->list()[k].first);
      }
      push("keys.list:" + ks);
    } else if (op == "keys.hit") {
      lfw::controller::KeyStatus* const st = g_keys->get(key_of(t[i++]));
      const std::string tv = t[i++];
      if (tv == "-") st->hit(lfw::Value(), g_keys->time());
      else st->hit(lfw::Value(to_double(tv)), 0.0);
    } else if (op == "keys.end") {
      g_keys->get(key_of(t[i++]))->end(g_keys->time());
    } else if (op == "keys.isstart") {
      lfw::controller::KeyStatus* const st = g_keys->get(key_of(t[i++]));
      push("keys.isstart:" + std::string(st->is_start(g_keys->time()) ? "1" : "0"));
    } else if (op == "keys.isend") {
      lfw::controller::KeyStatus* const st = g_keys->get(key_of(t[i++]));
      push("keys.isend:" + std::string(st->is_end() ? "1" : "0"));
    } else if (op == "keys.use") {
      lfw::controller::KeyStatus* const st = g_keys->get(key_of(t[i++]));
      push("keys.use:" + num(st->use()));
    } else if (op == "keys.reset") {
      g_keys->get(key_of(t[i++]))->reset();
    } else if (op == "keys.ts") {
      lfw::controller::KeyStatus* const st = g_keys->get(key_of(t[i++]));
      push("keys.ts:" + num(st->time()) + "|" + num(st->u_time()) + "|" + num(st->used()));
    } else if (op == "ui.add") {
      std::vector<lfw::Value> items;
      while (i < t.size()) {
        lfw::Object o;
        o.set(u"id", lfw::Value(key_of(t[i++])));
        items.push_back(lfw::Value(std::make_shared<lfw::Object>(o)));
      }
      g_ui->add(items);
      std::string ids;
      for (size_t k = 0; k < g_ui->all().size(); ++k) {
        if (k != 0) ids += ",";
        ids += fmt_id(lfw::field_or(g_ui->all()[k], u"id"));
      }
      push("ui.all:" + ids);
    } else if (op == "ui.clear") {
      g_ui->clear();
      push("ui.all:");
    } else if (op == "ui.all") {
      std::string ids;
      for (size_t k = 0; k < g_ui->all().size(); ++k) {
        if (k != 0) ids += ",";
        ids += fmt_id(lfw::field_or(g_ui->all()[k], u"id"));
      }
      push("ui.all:" + ids);
    } else if (op == "ui.push") {
      const std::u16string id = key_of(t[i++]);
      g_ui->push_page(id, to_double(key_of(t[i++])));
    } else if (op == "ui.set") {
      const std::u16string id = key_of(t[i++]);
      g_ui->set_page(id, to_double(key_of(t[i++])));
    } else if (op == "jq.new") {
      g_jqs.push_back(std::make_unique<lfw::helper::JoinQueue>(to_double(key_of(t[i++]))));
      push("jq.new:" + num(static_cast<double>(g_jqs.size() - 1)));
    } else if (op == "jq.enq") {
      lfw::helper::JoinQueue& q = *g_jqs[static_cast<size_t>(to_double(key_of(t[i++])))];
      const std::u16string uid = key_of(t[i++]);
      const std::u16string name = key_of(t[i++]);
      const std::u16string oid = key_of(t[i++]);
      lfw::helper::Entrant e;
      e.uid = uid;
      e.name = name;
      if (oid != u"-") e.oid = lfw::Value(oid);
      push("jq.enq:" + std::string(q.enqueue(e) ? "1" : "0"));
    } else if (op == "jq.deq") {
      lfw::helper::JoinQueue& q = *g_jqs[static_cast<size_t>(to_double(key_of(t[i++])))];
      const std::optional<lfw::helper::Entrant> e = q.dequeue();
      if (!e.has_value()) {
        push("jq.deq:u|u|u");
      } else {
        push("jq.deq:" + fmt_id(e->uid) + "|" + fmt_id(e->name) + "|" + fmt_id(e->oid));
      }
    } else if (op == "jq.rm") {
      lfw::helper::JoinQueue& q = *g_jqs[static_cast<size_t>(to_double(key_of(t[i++])))];
      push("jq.rm:" + std::string(q.remove(key_of(t[i++])) ? "1" : "0"));
    } else if (op == "jq.has") {
      lfw::helper::JoinQueue& q = *g_jqs[static_cast<size_t>(to_double(key_of(t[i++])))];
      push("jq.has:" + std::string(q.has(key_of(t[i++])) ? "1" : "0"));
    } else if (op == "jq.size") {
      lfw::helper::JoinQueue& q = *g_jqs[static_cast<size_t>(to_double(key_of(t[i++])))];
      push("jq.size:" + num(q.size()));
    } else if (op == "jq.all") {
      lfw::helper::JoinQueue& q = *g_jqs[static_cast<size_t>(to_double(key_of(t[i++])))];
      std::string uids;
      for (size_t k = 0; k < q.all().size(); ++k) {
        if (k != 0) uids += ",";
        uids += to_ascii(q.all()[k].uid);
      }
      push("jq.all:" + uids);
    } else if (op == "jq.clear") {
      lfw::helper::JoinQueue& q = *g_jqs[static_cast<size_t>(to_double(key_of(t[i++])))];
      q.clear();
      push("jq.size:" + num(q.size()));
    } else if (op == "pick") {
      const std::vector<std::u16string> order = csv_list(t[i++]);
      const std::vector<std::pair<std::u16string, double>> counts = csv_pairs(t[i++]);
      const std::vector<std::pair<std::u16string, double>> caps = csv_pairs(t[i++]);
      const std::string fallen = t[i++];
      std::u16string fallen_storage;
      const std::u16string* fallen_ptr = nullptr;
      if (fallen != "-") {
        fallen_storage = key_of(fallen);
        fallen_ptr = &fallen_storage;
      }
      const lfw::Value ret = lfw::helper::pick_join_team(counts, caps, fallen_ptr, order);
      push("pick:" + fmt_id(ret));
    } else if (op == "evctx") {
      const std::u16string name = key_of(t[i++]);
      const double v = to_double(t[i++]);
      g_ev_ctx[name] = v;
      push("evctx:" + to_ascii(name) + "=" + num(v));
    } else if (op == "evn") {
      const lfw::Value v = parse_value(t, i);
      const std::optional<double> ret = lfw::utils::eval_number(v, g_ev_ctx);
      push("evn:" + (ret ? num(*ret) : std::string("err")));
    } else {
      std::fprintf(stderr, "unknown op '%s'\n", op.c_str());
      return 2;
    }
  }

  std::printf("%s\n", [&] {
    std::string joined;
    for (size_t k = 0; k < g_log.size(); ++k) {
      if (k != 0) joined += "\n";
      joined += g_log[k];
    }
    return joined;
  }().c_str());
  return 0;
}
