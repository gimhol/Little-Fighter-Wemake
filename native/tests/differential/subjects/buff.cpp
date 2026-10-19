#include <cstdio>
#include <fstream>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;

std::vector<std::string> g_log;
std::map<std::u16string, int> g_entity_ok;

std::string render(const lfw::Value& v) { return to_ascii(render_value(v)); }
std::string flag(bool b) { return b ? "b1" : "b0"; }
std::string num(double d) { return render(lfw::Value(d)); }
std::u16string u16(const std::string& s) { return std::u16string(s.begin(), s.end()); }
std::string u8(const std::u16string& s) { return to_ascii(s); }

// 切片 4BY：`buff` 以 `lfw::Entity` 为准入（窄接口退役）⇒ 台面假实体就是真 `Entity`，
// 观测点直接落在实体面上（`set_position` / 帧几何 / `set_frame` / `buffs_*` / 描边 /
// `enter_frame_by_id` / `attach`），日志逐字照抄 TS 侧假件。
class FakeEntity : public lfw::Entity {
 public:
  explicit FakeEntity(const std::u16string& id) : Entity(fx::shared_world(), lfw::Value()) {
    this->id = id;
  }

  double centery = 0;
  double height = 0;
  double pic_h = 0;
  bool exists = true;

  void set_position(const lfw::Value& x, const lfw::Value& y, const lfw::Value& z) override {
    position.set(lfw::to_number(x), lfw::to_number(y), lfw::to_number(z));
    g_log.push_back("set_position:" + u8(id) + ":" + render(x) + "," + render(y) + "," +
                    render(z));
  }
  double frame_centery() const override { return centery; }
  double frame_height() const override { return height; }
  double frame_pic_h() const override { return pic_h; }
  void set_frame(const lfw::Value& info) override {
    g_log.push_back("set_frame:" + u8(id) + ":" + render(info));
  }
  void buffs_set(const std::u16string& k, lfw::buff::Buff* b) override {
    g_log.push_back("buffs_set:" + u8(id) + ":" + u8(k));
    Entity::buffs_set(k, b);
  }
  void buffs_delete(const std::u16string& k) override {
    g_log.push_back("buffs_delete:" + u8(id) + ":" + u8(k));
    Entity::buffs_delete(k);
  }
  void set_outline_alpha(double v) override { g_log.push_back("outline_alpha:" + num(v)); }
  void set_outline_width(double v) override { g_log.push_back("outline_width:" + num(v)); }
  void set_outline_color(std::u16string v) override {
    g_log.push_back("outline_color:" + render(lfw::Value(v)));
  }
  lfw::EnterFrameResult enter_frame_by_id(const lfw::Value& i, bool fallback = false) override {
    (void)fallback;
    g_log.push_back("enter_frame:" + u8(lfw::to_string(i)));
    return lfw::EnterFrameResult::Entered;
  }
  Entity& attach(const lfw::Value& ghost = lfw::Value(false)) override {
    g_log.push_back("attach:" + flag(lfw::truthy(ghost)));
    return *this;
  }
};

std::map<std::u16string, std::unique_ptr<FakeEntity>> g_entities;
lfw::Value g_data;
lfw::Value g_create_entity_ok = lfw::Value(true);
lfw::Value g_create_buff_ok = lfw::Value(true);
int g_entity_seq = 0;

class TestBuff : public lfw::buff::Buff {
 public:
  using Buff::Buff;
  std::string hooks = "none";
  std::string oid;
  std::string fid = "0";
  bool has_on_update() const override { return hooks == "update"; }
  bool has_on_tick() const override { return hooks == "tick"; }
  bool has_on_end() const override { return hooks == "end"; }
  void on_update(lfw::Entity* a, lfw::Entity* v) override {
    g_log.push_back("on_update:" + (a ? u8(a->id) : std::string("-")) + ":" +
                    (v ? u8(v->id) : std::string("-")));
  }
  void on_tick(lfw::Entity* a, lfw::Entity* v) override {
    g_log.push_back("on_tick:" + (a ? u8(a->id) : std::string("-")) + ":" +
                    (v ? u8(v->id) : std::string("-")));
  }
  void on_end(lfw::Entity* a, lfw::Entity* v) override {
    g_log.push_back("on_end:" + (a ? u8(a->id) : std::string("-")) + ":" +
                    (v ? u8(v->id) : std::string("-")));
  }
  std::u16string effect_oid() const override { return u16(oid); }
  std::u16string effect_frame_id() const override { return u16(fid); }
  void call_place_center(lfw::Entity* e, lfw::Entity* v) { place_effect_center(e, v); }
  void call_show(lfw::Entity* v) { show_effect(v); }
  void call_clear() { clear_effects(); }
  void call_update_effects() { update_effects(); }
  void call_del_effect(const std::u16string& id) { del_effect(id); }
  bool call_del_id(const std::u16string& id) { return del_id(id); }
};

TestBuff g_buff(fx::shared_lfw(), std::u16string(), lfw::Value(std::u16string(u"k")));
std::map<std::u16string, std::unique_ptr<TestBuff>> g_made;
TestBuff* g_sync = nullptr;

FakeEntity* ensure(const std::u16string& id) {
  auto it = g_entities.find(id);
  if (it != g_entities.end()) return it->second.get();
  auto e = std::make_unique<FakeEntity>(id);
  FakeEntity* p = e.get();
  g_entities.emplace(id, std::move(e));
  return p;
}

lfw::Entity* find_entity(const std::u16string& id) {
  auto ok = g_entity_ok.find(id);
  if (ok != g_entity_ok.end() && ok->second == 0) return nullptr;
  auto it = g_entities.find(id);
  if (it == g_entities.end()) return nullptr;
  if (!it->second->exists) return nullptr;
  return it->second.get();
}

void bind() {
  fx::shared_lfw().world_override = &fx::shared_world();
  fx::shared_world().on_find_entity = [](const std::u16string& id) { return find_entity(id); };
  fx::shared_lfw().on_create_entity = [](const lfw::Value&) -> lfw::Entity* {
    if (!lfw::truthy(g_create_entity_ok)) return nullptr;
    const std::u16string nid = u"E" + u16(std::to_string(++g_entity_seq));
    g_log.push_back("create_entity:" + u8(nid));
    return ensure(nid);
  };
  fx::shared_lfw().on_datas_find = [](const std::u16string& oid) {
    g_log.push_back("find_data:" + u8(oid));
    return g_data;
  };
  fx::shared_world().on_buffs_set = [](const std::u16string& id, lfw::buff::Buff*) {
    g_log.push_back("world_buffs_set:" + u8(id));
  };
  fx::shared_world().on_buffs_get = [](const std::u16string& id) -> lfw::buff::Buff* {
    auto it = g_made.find(id);
    g_log.push_back("world_buffs_get:" + u8(id) + ":" + flag(it != g_made.end()));
    return it == g_made.end() ? nullptr : it->second.get();
  };
  fx::shared_lfw().on_create_buff = [](const std::u16string& kind, const std::u16string& id) -> lfw::buff::Buff* {
    const bool ok = lfw::truthy(g_create_buff_ok);
    g_log.push_back("create_buff:" + u8(kind) + ":" + u8(id) + ":" + flag(ok));
    if (!ok) return nullptr;
    auto b = std::make_unique<TestBuff>(fx::shared_lfw(), id, lfw::Value(kind));
    TestBuff* p = b.get();
    g_made.emplace(id, std::move(b));
    return p;
  };
}

std::string log_text() {
  std::string s;
  for (const std::string& e : g_log) s += " " + e;
  return s;
}

std::string buff_text(lfw::buff::Buff& b) {
  std::string s = " id=" + u8(b.id());
  s += " lvl=" + num(b.level());
  s += " mounted=" + flag(b.mounted());
  s += " lifetime=" + num(b.lifetime());
  s += " duration=" + num(b.duration());
  s += " ticks=" + num(b.ticks());
  s += " dead=" + flag(b.dead());
  s += " aid=" + render(lfw::Value(b.attacker_id()));
  s += " atk=" + render(lfw::Value(b.attacter() != nullptr
                                       ? lfw::Value(b.attacter()->id)
                                       : lfw::Value()));
  s += " nfx=" + num(static_cast<double>(b.effects_size()));
  s += " victims=[";
  for (size_t i = 0; i < b.victims().size(); ++i) {
    s += (i ? "," : "") + u8(b.victims()[i]);
  }
  s += "]";
  return s;
}

std::string buff_text() { return buff_text(g_buff); }
std::string buff_text_of(lfw::buff::Buff& b) { return buff_text(b); }

void emit(const std::string& line) { std::printf("%s\n", line.c_str()); }

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_buff <case-file>\n");
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
    if (t.size() < 2) {
      std::fprintf(stderr, "too few operands at line %d\n", lineno);
      return 2;
    }
    size_t i = 1;
    if (op == "env") {
      const std::string& sub = t[i++];
      if (sub == "entity") {
        const std::string raw_id = to_ascii(trace::parse_js_string_literal(t[i++]));
        const std::u16string id = raw_id == "@" ? u"E" + u16(std::to_string(g_entity_seq)) : u16(raw_id);
        const bool ok = t[i++] == "1";
        ensure(id)->exists = ok;
        emit("env entity " + u8(id) + " " + flag(ok));
      } else if (sub == "pos") {
        FakeEntity* e = ensure(trace::parse_js_string_literal(t[i++]));
        const double px = trace::to_double(t[i++]);
        const double py = trace::to_double(t[i++]);
        const double pz = trace::to_double(t[i++]);
        e->position.set(px, py, pz);
        emit("env pos");
      } else if (sub == "frame") {
        FakeEntity* e = ensure(trace::parse_js_string_literal(t[i++]));
        e->centery = trace::to_double(t[i++]);
        e->height = trace::to_double(t[i++]);
        e->pic_h = trace::to_double(t[i++]);
        emit("env frame");
      } else if (sub == "data") {
        g_data = parse_value(t, i);
        emit("env data");
      } else if (sub == "create_entity_ok") {
        g_create_entity_ok = lfw::Value(t[i++] == "1");
        emit("env create_entity_ok");
      } else if (sub == "create_buff_ok") {
        g_create_buff_ok = lfw::Value(t[i++] == "1");
        emit("env create_buff_ok");
      } else {
        std::fprintf(stderr, "unknown env '%s' at line %d\n", sub.c_str(), lineno);
        return 2;
      }
      continue;
    }
    if (op == "buff") {
      const std::string& sub = t[i++];
      if (sub == "new") {
        const std::u16string id = trace::parse_js_string_literal(t[i++]);
        const lfw::Value kind = parse_value(t, i);
        g_buff = TestBuff(fx::shared_lfw(), id, kind);
        g_sync = nullptr;
        emit("buff new" + buff_text());
        continue;
      } else if (sub == "use") {
        const std::u16string id = trace::parse_js_string_literal(t[i++]);
        auto it = g_made.find(id);
        if (it != g_made.end()) {
          g_buff = *it->second;
          g_sync = it->second.get();
        }
        emit("buff use " + u8(id));
        continue;
      } else if (sub == "hook") {
        g_buff.hooks = t[i++];
        emit("buff hook " + g_buff.hooks);
        continue;
      } else if (sub == "oid") {
        g_buff.oid = to_ascii(trace::parse_js_string_literal(t[i++]));
        emit("buff oid " + g_buff.oid);
        continue;
      } else if (sub == "fid") {
        g_buff.fid = to_ascii(trace::parse_js_string_literal(t[i++]));
        emit("buff fid " + g_buff.fid);
        continue;
      } else if (sub == "level") {
        g_buff.set_level(trace::to_double(t[i++]));
      } else if (sub == "lifetime") {
        g_buff.set_lifetime(trace::to_double(t[i++]));
      } else if (sub == "duration") {
        g_buff.set_duration(trace::to_double(t[i++]));
      } else if (sub == "ticks") {
        g_buff.set_ticks(trace::to_double(t[i++]));
      } else if (sub == "attacker_id") {
        const std::u16string id = trace::parse_js_string_literal(t[i++]);
        g_buff.set_attacker_by_id(id);
      } else if (sub == "attacker_entity") {
        const std::u16string id = trace::parse_js_string_literal(t[i++]);
        g_buff.set_attacker_entity(find_entity(id));
      } else if (sub == "victim") {
        g_buff.set_victim(find_entity(trace::parse_js_string_literal(t[i++])));
      } else if (sub == "add_victim") {
        g_buff.add_victim(find_entity(trace::parse_js_string_literal(t[i++])));
      } else if (sub == "del_victim") {
        g_buff.del_victim(find_entity(trace::parse_js_string_literal(t[i++])));
      } else if (sub == "del_id") {
        const bool r = g_buff.call_del_id(trace::parse_js_string_literal(t[i++]));
        emit("buff del_id " + flag(r));
        continue;
      } else if (sub == "reset") {
        g_buff.reset(trace::parse_js_string_literal(t[i++]));
      } else if (sub == "mount") {
        g_buff.mount();
      } else if (sub == "unmount") {
        g_buff.unmount();
      } else if (sub == "update") {
        g_buff.update(trace::to_double(t[i++]));
      } else if (sub == "place_center") {
        const std::u16string vid = trace::parse_js_string_literal(t[i++]);
        g_buff.call_place_center(find_entity(vid), find_entity(vid));
      } else if (sub == "show") {
        g_buff.call_show(find_entity(trace::parse_js_string_literal(t[i++])));
      } else if (sub == "clear") {
        g_buff.call_clear();
      } else if (sub == "upd_fx") {
        g_buff.call_update_effects();
      } else if (sub == "del_fx") {
        g_buff.call_del_effect(trace::parse_js_string_literal(t[i++]));

      } else if (sub == "snap") {
        emit("buff snap " + render(g_buff.to_snapshot()));
        continue;
      } else if (sub == "read") {
        g_buff.read_snapshot(parse_value(t, i));
      } else if (sub == "log") {
        emit("buff log" + log_text());
        g_log.clear();
        continue;
      } else {
        std::fprintf(stderr, "unknown buff sub '%s' at line %d\n", sub.c_str(), lineno);
        return 2;
      }
      if (i != t.size()) {
        std::fprintf(stderr, "unexpected trailing token at line %d\n", lineno);
        return 2;
      }
      if (g_sync != nullptr) *g_sync = g_buff;
      emit("buff " + sub + buff_text() + " |" + log_text());
      g_log.clear();
      continue;
    }
    if (op == "grant") {
      const std::u16string kind = trace::parse_js_string_literal(t[i++]);
      const std::u16string aid = trace::parse_js_string_literal(t[i++]);
      const std::u16string vid = trace::parse_js_string_literal(t[i++]);
      const double dur = trace::to_double(t[i++]);
      lfw::buff::Buff* b = lfw::buff::grant_buff(kind, find_entity(aid), find_entity(vid), dur);
      std::string s = b == nullptr ? std::string("-") : u8(b->id());
      std::string st = b == nullptr ? std::string() : buff_text_of(*b);
      emit("grant " + u8(kind) + " " + s + st + " |" + log_text());
      g_log.clear();
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  return 0;
}
