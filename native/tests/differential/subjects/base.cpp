#include <cstdio>
#include <fstream>
#include <limits>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "lfw/base/clock.h"
#include "lfw/base/fps.h"
#include "lfw/base/fsm.h"
#include "lfw/base/get_short_file_size_txt.h"
#include "lfw/base/no_emit_callbacks.h"
#include "lfw/base/team_color.h"
#include "lfw/base/ticker.h"
#include "lfw/base/val_expression.h"
#include "lfw/dat_translator/make_buring_smoke.h"
#include "lfw/defines/all_enums.h"
#include "lfw/entity/gen_field.h"
#include "lfw/loader/preprocess_opoint.h"
#include "lfw/state/spawn_ice_piece.h"
#include "lfw/utils/math/mersenne_twister.h"

#include "trace_util.h"

namespace {

using trace::esc;
using trace::Line;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;
using trace::to_double;
using trace::to_long;
using trace::to_u16;

lfw::Callbacks g_cb;
std::vector<std::unique_ptr<lfw::NoEmitCallbacks::Listener>> g_listeners;
std::map<std::string, lfw::NoEmitCallbacks::Listener*> g_by_id;
std::string g_reemit_key;

void emit_line(const std::string& s) { std::printf("%s\n", s.c_str()); }

lfw::Value key_value(const std::string& tok) {
  bool numeric = !tok.empty();
  for (char c : tok) {
    if ((c < '0' || c > '9') && c != '-') numeric = false;
  }
  if (numeric) return lfw::Value(to_double(tok));
  return lfw::Value(to_u16(tok));
}

std::string g_selfadd_id;
std::string g_selfadd_key;

void fire(const std::string& id, const std::string& key, const lfw::NoEmitCallbacks::Payloads& args) {
  Line out;
  out.add(std::string_view("L")).add(id).add(key);
  for (const lfw::Value& a : args) out.add(to_ascii(render_value(a)));
  out.out();
  if (!g_reemit_key.empty() && g_reemit_key == key) {
    lfw::NoEmitCallbacks::Listener* self = g_by_id[id];
    if (self != nullptr) g_cb.call(to_u16(key), {});
  }
  if (!g_selfadd_key.empty() && g_selfadd_key == key) {
    g_cb.once(to_u16(key), [id](const lfw::NoEmitCallbacks::Payloads&) { emit_line("LX " + id); });
  }
}

class TestState : public lfw::IState {
 public:
  TestState(std::string k, std::string t, bool has_t)
      : _k(std::move(k)), _t(std::move(t)), _has(has_t), _kv(key_value(_k)) {}
  lfw::Value key() const override { return _kv; }
  std::optional<lfw::Value> update(double dt) override {
    (void)dt;
    if (!_has) return std::nullopt;
    return lfw::Value(to_u16(_t));
  }
  void enter() override { emit_line("E " + _k); }
  void leave() override { emit_line("LV " + _k); }
  std::string dump_key() const { return _k; }

 private:
  std::string _k;
  std::string _t;
  bool _has;
  lfw::Value _kv;
};

std::vector<std::unique_ptr<TestState>> g_states;
std::unique_ptr<lfw::FSM> g_fsm;
lfw::FSMStateSnapshot g_snap;
bool g_has_snap = false;

TestState* state_at(const std::string& key) {
  for (std::unique_ptr<TestState>& s : g_states) {
    if (s->dump_key() == key) return s.get();
  }
  return nullptr;
}

std::string key_text(lfw::IState* s) { return s == nullptr ? "-" : esc(lfw::to_string(s->key())); }

void fsm_dump(const char* tag) {
  Line out;
  out.add(std::string_view(tag)).add(g_fsm != nullptr ? esc(g_fsm->name()) : std::string("-"));
  out.add(key_text(g_fsm != nullptr ? g_fsm->state() : nullptr));
  out.add(key_text(g_fsm != nullptr ? g_fsm->prev_state() : nullptr));
  out.add(to_ascii(render_value(lfw::Value(g_fsm != nullptr ? g_fsm->time() : 0.0))));
  out.add(to_ascii(render_value(lfw::Value(g_fsm != nullptr ? g_fsm->state_time() : 0.0))));
  out.out();
}

// --- `base/ValExpression` + `loader/preprocess_opoint` 的假宿主 -----------------
// TS 侧给的是 `{ frame: {width,height,centerx,centery}, lfw: { mt } }`；端口按
// `ValExpression` 的 Ctx 概念收成一个 `frame_var(name)` + `mt()` 的测试宿主。
// 缺字段时 TS 拿到 `undefined`（参与算术变 NaN），端口回 NaN —— 两者的**差异支**
// （`rand(undefined, undefined)` 的提前返回、`pick` 的 `!== undefined` 过滤）
// 不在用例覆盖范围内，见 PROTOCOL §6.9.102。

lfw::MersenneTwister g_mt(0);

struct TestCtx {
  double w = 0;
  double h = 0;
  double cx = 0;
  double cy = 0;
  double frame_var(const std::u16string& name) const {
    if (name == u"width") return w;
    if (name == u"height") return h;
    if (name == u"centerx") return cx;
    if (name == u"centery") return cy;
    return std::numeric_limits<double>::quiet_NaN();
  }
  lfw::MersenneTwister& mt() const { return g_mt; }
};

TestCtx g_ctx;
std::map<std::u16string, lfw::ValGetterFn<TestCtx>> g_vars;
std::vector<lfw::ValExpression<TestCtx>> g_vexprs;
lfw::Object g_opoint;
// `pctx` 的脚本上下文（`preprocess_opoint` 的 `data` / `frame`；默认均为 undefined）。
lfw::Value g_pctx_data;
lfw::Value g_pctx_frame;

// `xw` 的 4 位十六进制码元（用例用它拼出 U+3000 / U+00A0 这类 JS 空白）。
char16_t hex_unit(const std::string& s) {
  unsigned v = 0;
  for (char c : s) {
    v <<= 4;
    if (c >= '0' && c <= '9') v |= static_cast<unsigned>(c - '0');
    else if (c >= 'a' && c <= 'f') v |= static_cast<unsigned>(c - 'a' + 10);
    else if (c >= 'A' && c <= 'F') v |= static_cast<unsigned>(c - 'A' + 10);
  }
  return static_cast<char16_t>(v);
}

void ve_dump(int idx) {
  const lfw::ValExpression<TestCtx>& e = g_vexprs[static_cast<size_t>(idx)];
  Line out;
  out.add(std::string_view("D")).add(idx).add(esc(e.text)).add(esc(e.tag));
  out.add(e.has_err ? esc(e.err) : std::string_view("-"));
  out.out();
}

void ve_get(int idx, long times) {
  const lfw::ValExpression<TestCtx>& e = g_vexprs[static_cast<size_t>(idx)];
  Line out;
  out.add(std::string_view("G")).add(idx).add(times).add(esc(g_mt.mark));
  for (long i = 0; i < times; ++i) out.add_bits(e.get(g_ctx));
  out.out();
}

// --- `base/Ticker` + `base/FPS` 的假时钟 / 假定时器 ----------------------------
// TS 侧换掉 `Ditto.Clock` / `Ditto.Timeout`；端口换掉 `clock()` / `timeout()` 两个槽。
// 两侧都把 `add` / `del` 打进日志：**走 Timeout 还是走 Clock、delay 是多少**正是
// `Ticker::schedule` 的行为。`fire` 取「句柄最大的待发回调」（Ticker 同时只会挂一个）。

struct FakeClock : lfw::IClock {
  double value = 0.0;
  bool hid = false;
  int next_id = 1;
  std::map<int, std::function<void()>> pending;

  double now() const override { return value; }
  int add(std::function<void()> handler) override {
    const int id = next_id++;
    pending[id] = std::move(handler);
    Line out;
    out.add(std::string_view("CLK")).add(std::string_view("add")).add(id);
    out.out();
    return id;
  }
  void del(int handle) override {
    pending.erase(handle);
    Line out;
    out.add(std::string_view("CLK")).add(std::string_view("del")).add(handle);
    out.out();
  }
  bool hidden() const override { return hid; }
};

struct FakeTimeout : lfw::ITimeout {
  int next_id = 1;
  std::map<int, std::function<void()>> pending;

  int add(std::function<void()> handler, double timeout) override {
    const int id = next_id++;
    pending[id] = std::move(handler);
    Line out;
    out.add(std::string_view("TOUT")).add(std::string_view("add")).add(id).add_bits(timeout);
    out.out();
    return id;
  }
  void del(int timer_id) override {
    pending.erase(timer_id);
    Line out;
    out.add(std::string_view("TOUT")).add(std::string_view("del")).add(timer_id);
    out.out();
  }
};

FakeClock g_fake_clock;
FakeTimeout g_fake_timeout;

void fire_pending(std::map<int, std::function<void()>>& pend, const char* kind) {
  if (pend.empty()) {
    Line out;
    out.add(std::string_view("FIRE")).add(std::string_view(kind)).add(std::string_view("-"));
    out.out();
    return;
  }
  const int id = pend.rbegin()->first;
  const std::function<void()> fn = pend[id];
  pend.erase(id);
  Line out;
  out.add(std::string_view("FIRE")).add(std::string_view(kind)).add(id);
  out.out();
  fn();
}

// 宿主「发一次待发的回调」：Ticker 同时只会挂一个（Timeout 或 Clock），所以先看 Timeout。
void fire_any() {
  if (!g_fake_timeout.pending.empty()) {
    fire_pending(g_fake_timeout.pending, "timeout");
    return;
  }
  if (!g_fake_clock.pending.empty()) {
    fire_pending(g_fake_clock.pending, "clock");
    return;
  }
  emit_line("FIRE -");
}

std::unique_ptr<lfw::Ticker> g_ticker;

struct TestTickerOptions : lfw::ITickerOptions {
  double step = 16.0;
  double spent = 0.0;
  int steps = 0;
  // 重入钩子：`on_step` 里回调 Ticker 自己（`resume`/`pause`/`stop`）。这是 `_schedule`
  // 三个守卫因子唯一的可观察入口（宿主在一步的中间改状态），所以值得做成 op。
  std::string inside;

  double step_ms() override { return step; }
  void on_step(double dt) override {
    Line out;
    out.add(std::string_view("STEP")).add(steps++).add_bits(dt);
    out.out();
    // `on_step` 里的「干活耗时」：让假时钟前进，`Ticker::cost` 的 EMA 才动得起来。
    g_fake_clock.value += spent;
    if (!inside.empty() && g_ticker != nullptr) {
      const std::string sub = inside;
      inside.clear();
      if (sub == "resume") {
        g_ticker->resume();
      } else if (sub == "pause") {
        g_ticker->pause();
      } else if (sub == "stop") {
        g_ticker->stop();
      } else if (sub == "resync") {
        g_ticker->resync(true);
      }
    }
  }
};

TestTickerOptions g_tk_opt;
lfw::FPS g_fps;

std::string flag_text(bool b) { return b ? "true" : "false"; }

void ticker_dump() {
  Line out;
  out.add(std::string_view("TK"));
  out.add("run=" + flag_text(g_ticker != nullptr && g_ticker->running()));
  out.add("pend=" + flag_text(g_ticker != nullptr && g_ticker->pending()));
  out.add("pause=" + flag_text(g_ticker != nullptr && g_ticker->paused()));
  out.add("base=" + trace::bits_hex(g_ticker != nullptr ? g_ticker->base() : 0.0));
  out.add("span=" + trace::bits_hex(g_ticker != nullptr ? g_ticker->span() : 0.0));
  out.add("step=" + trace::bits_hex(g_ticker != nullptr ? g_ticker->step() : 0.0));
  out.add("rate=" + trace::bits_hex(g_ticker != nullptr ? g_ticker->rate() : 0.0));
  out.add("cost=" + trace::bits_hex(g_ticker != nullptr ? g_ticker->cost : 0.0));
  out.add("dl=" + trace::bits_hex(g_ticker != nullptr ? g_ticker->deadline() : 0.0));
  out.add("last=" + trace::bits_hex(g_ticker != nullptr ? g_ticker->last_step() : 0.0));
  out.add("tid=" + std::to_string(g_ticker != nullptr ? g_ticker->timer_id() : 0));
  out.add("wid=" + std::to_string(g_ticker != nullptr ? g_ticker->wake_id() : 0));
  out.out();
}

void fps_dump() {
  Line out;
  out.add(std::string_view("FPS"));
  out.add("value=" + trace::bits_hex(g_fps.value()));
  out.add("dur=" + trace::bits_hex(g_fps.duration()));
  out.add("ret=" + trace::bits_hex(g_fps.retention()));
  out.out();
}

void opoint_compile() {
  const std::map<std::u16string, lfw::ValExpression<TestCtx>> gens =
      lfw::preprocess_opoint<TestCtx>(g_opoint, g_pctx_data, g_pctx_frame,
                                      [](const std::u16string& msg) {
        emit_line("WARN " + esc(msg));
      });
  Line head;
  head.add(std::string_view("PC")).add(gens.size());
  head.out();
  for (const std::pair<std::u16string, std::u16string>& field : lfw::opoint_gen_fields()) {
    const auto it = gens.find(field.second);
    const lfw::Value* kept = g_opoint.get(field.second);
    const std::u16string kept_render = kept == nullptr ? u"u" : render_value(*kept);
    Line out;
    out.add(std::string_view("PG")).add(esc(field.second));
    if (it == gens.end()) {
      out.add(0).add(std::string_view("-")).add(std::string_view("-"));
      out.add(esc(kept_render));
    } else {
      out.add(1);
      out.add(it->second.has_err ? esc(it->second.err) : std::string_view("-"));
      out.add_bits(it->second.get(g_ctx));
      out.add(std::string_view("-"));
    }
    out.out();
    // §4.40 的对齐约定：TS 把函数对象挂在记录上，端口不挂 ⇒ 两侧都把 `__gen_*` 删掉。
    g_opoint.remove(field.second);
  }
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_base <case-file>\n");
    return 2;
  }

  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "cannot open case file: %s\n", argv[1]);
    return 2;
  }

  lfw::callbacks_warn() = [](const std::u16string& msg) {
    emit_line("WARN " + esc(msg));
  };

  lfw::set_clock(&g_fake_clock);
  lfw::set_timeout(&g_fake_timeout);

  std::string raw;
  int lineno = 0;
  while (std::getline(in, raw)) {
    ++lineno;
    raw = trace::strip_comment(raw);
    const std::vector<std::string> t = split_ws(raw);
    if (t.empty()) continue;

    const std::string& op = t[0];
    size_t i = 1;

    if (op == "add") {
      const std::string id = t[i++];
      auto l = std::make_unique<lfw::NoEmitCallbacks::Listener>();
      while (i < t.size()) {
        const std::string key = t[i++];
        l->handlers.push_back({to_u16(key), [id, key](const lfw::NoEmitCallbacks::Payloads& args) {
                                 fire(id, key, args);
                               }});
      }
      lfw::NoEmitCallbacks::Listener* raw_ptr = l.get();
      g_by_id[id] = raw_ptr;
      g_listeners.push_back(std::move(l));
      g_cb.add(raw_ptr);

    } else if (op == "once") {
      const std::string id = t[i++];
      const std::string key = t[i++];
      auto l = std::make_unique<lfw::NoEmitCallbacks::Listener>();
      l->handlers.push_back({to_u16(key), [id, key](const lfw::NoEmitCallbacks::Payloads& args) {
                               fire(id, key, args);
                             }});
      l->once = true;
      lfw::NoEmitCallbacks::Listener* raw_ptr = l.get();
      g_by_id[id] = raw_ptr;
      g_listeners.push_back(std::move(l));
      g_cb.add(raw_ptr);

    } else if (op == "on") {
      const std::string id = t[i++];
      const std::string key = t[i++];
      g_cb.on(to_u16(key), [id, key](const lfw::NoEmitCallbacks::Payloads& args) {
        fire(id, key, args);
      });

    } else if (op == "del") {
      auto it = g_by_id.find(t[i++]);
      if (it != g_by_id.end() && it->second != nullptr) g_cb.del(it->second);

    } else if (op == "clear") {
      g_cb.clear();

    } else if (op == "call") {
      const std::string key = t[i++];
      lfw::NoEmitCallbacks::Payloads args;
      while (i < t.size()) args.push_back(parse_value(t, i));
      g_cb.call(to_u16(key), args);

    } else if (op == "keys") {
      Line out;
      out.add(std::string_view("KS"));
      for (const std::u16string& k : g_cb.keys()) out.add(esc(k));
      out.out();

    } else if (op == "count") {
      const std::string key = t[i++];
      emit_line("CNT " + key + " " + std::to_string(g_cb.listener_count(to_u16(key))));

    } else if (op == "pend") {
      const std::string key = t[i++];
      emit_line("PEND " + key + " " + std::to_string(g_cb.pending_count(to_u16(key))));

    } else if (op == "loop") {
      g_reemit_key = t[i++];

    } else if (op == "selfadd") {
      g_selfadd_id = t[i++];
      g_selfadd_key = t[i++];

    } else if (op == "stoploop") {
      g_reemit_key.clear();

    } else if (op == "fsm") {
      const std::string sub = t[i++];
      if (sub == "init") {
        g_fsm = std::make_unique<lfw::FSM>(to_u16(t[i++]));
        g_fsm->log = [](const std::u16string& msg) { emit_line("LOG " + esc(msg)); };
      } else if (sub == "state") {
        const std::string key = t[i++];
        std::string name = t[i++];
        const std::string target = t[i++];
        const bool has_target = target != "~";
        auto s = std::make_unique<TestState>(key, target, has_target);
        if (name != "~") s->name = to_u16(name);
        TestState* raw_ptr = s.get();
        g_states.push_back(std::move(s));
        g_fsm->add(raw_ptr);
      } else if (sub == "use") {
        g_fsm->use(key_value(t[i++]));
      } else if (sub == "reset") {
        g_fsm->reset(key_value(t[i++]));
      } else if (sub == "update") {
        const double dt = to_double(t[i++]);
        const long times = to_long(t[i++]);
        for (long k = 0; k < times; ++k) g_fsm->update(dt);
      } else if (sub == "listen") {
        const std::string id = t[i++];
        g_fsm->callbacks().on(u"on_state_changed", [id](const std::vector<lfw::FSM*>& args) {
          lfw::FSM* f = args[0];
          Line out;
          out.add(std::string_view("S")).add(id).add(esc(f->name()));
          out.add(key_text(f->state()));
          out.out();
        });
      } else if (sub == "dump") {
        fsm_dump("F");
      } else if (sub == "snap") {
        g_snap = g_fsm->to_snapshot();
        g_has_snap = true;
        fsm_dump("SN");
      } else if (sub == "restore") {
        if (g_has_snap) g_fsm->from_snapshot(g_snap);
        fsm_dump("F");
      } else {
        std::fprintf(stderr, "line %d: unknown fsm sub '%s'\n", lineno, sub.c_str());
        return 2;
      }

    } else if (op == "mtseed") {
      g_mt.reset(to_double(t[i++]));

    } else if (op == "mdraw") {
      const double lo = to_double(t[i++]);
      const double hi = to_double(t[i++]);
      Line out;
      out.add(std::string_view("MD")).add_bits(g_mt.range(lo, hi));
      out.out();

    } else if (op == "mmark") {
      emit_line("MM " + esc(g_mt.mark));

    } else if (op == "frame") {
      g_ctx.w = to_double(t[i++]);
      g_ctx.h = to_double(t[i++]);
      g_ctx.cx = to_double(t[i++]);
      g_ctx.cy = to_double(t[i++]);

    } else if (op == "gf") {
      // `World::gen_field`（`lfw/entity/gen_field.cpp`）：TS 是挂在对象上的函数对象，端口是
      // 「闭包侧表 + `gen_*` 现编译」两条。`e` = 当前 `g_opoint`、`ice`/`smoke` = 引擎自己
      // 造的那两个对象（闭包型）。
      const std::string which = t[i++];
      const std::u16string field = to_u16(t[i++]);
      lfw::Value holder;
      if (which == "e") {
        holder = lfw::Value(std::make_shared<lfw::Object>(g_opoint));
      } else if (which == "ice") {
        holder = lfw::state::spawn_ice_piece(u"130");
      } else if (which == "smoke") {
        holder = lfw::field_or(lfw::dat_translator::make_buring_smoke(1), u"action");
      } else {
        std::fprintf(stderr, "line %d: unknown gf holder '%s'\n", lineno, which.c_str());
        return 2;
      }
      lfw::Object frame_obj;
      frame_obj.set(u"width", lfw::Value(g_ctx.w));
      frame_obj.set(u"height", lfw::Value(g_ctx.h));
      frame_obj.set(u"centerx", lfw::Value(g_ctx.cx));
      frame_obj.set(u"centery", lfw::Value(g_ctx.cy));
      // 闭包开头那个 `is_object(emitter)` 守卫看的是 `emitter.data.type` ⇒ 给一份「普通实体」。
      lfw::Object data_obj;
      data_obj.set(u"type", lfw::Value(static_cast<double>(lfw::EntityEnum::Entity)));
      const std::optional<lfw::Value> got = lfw::gen_field_eval(
          holder, field, lfw::Value(std::make_shared<lfw::Object>(std::move(frame_obj))),
          lfw::Value(std::make_shared<lfw::Object>(std::move(data_obj))), g_mt);
      Line out;
      out.add(std::string_view("GF")).add(which).add(to_ascii(field));
      out.add(got.has_value() ? trace::bits_hex(lfw::to_number(*got)) : std::string("u"));
      out.out();

    } else if (op == "var") {
      const std::u16string name = to_u16(t[i++]);
      const double v = to_double(t[i++]);
      g_vars[name] = [v](const TestCtx&) { return v; };

    } else if (op == "varclr") {
      g_vars.clear();

    } else if (op == "x" || op == "xt") {
      std::u16string tag;
      if (op == "xt") tag = to_u16(t[i++]);
      std::string src;
      for (size_t k = i; k < t.size(); ++k) {
        if (!src.empty()) src += ' ';
        src += t[k];
      }
      lfw::ValExpressionOptions<TestCtx> options;
      options.tag = tag;
      options.vars = g_vars;
      g_vexprs.emplace_back(to_u16(src), options);
      ve_dump(static_cast<int>(g_vexprs.size()) - 1);

    } else if (op == "xw") {
      std::u16string src;
      while (i < t.size()) src.push_back(hex_unit(t[i++]));
      lfw::ValExpressionOptions<TestCtx> options;
      options.vars = g_vars;
      g_vexprs.emplace_back(src, options);
      ve_dump(static_cast<int>(g_vexprs.size()) - 1);

    } else if (op == "get") {
      const long times = i < t.size() ? to_long(t[i++]) : 1;
      ve_get(static_cast<int>(g_vexprs.size()) - 1, times);

    } else if (op == "dump") {
      ve_dump(static_cast<int>(to_long(t[i++])));

    } else if (op == "po") {
      g_opoint = lfw::Object();
      emit_line("PO");

    } else if (op == "ps") {
      const std::u16string key = to_u16(t[i++]);
      const lfw::Value v = parse_value(t, i);
      g_opoint.set(key, v);
      emit_line("PS " + esc(key) + " " + to_ascii(render_value(v)));

    } else if (op == "pc") {
      opoint_compile();

    } else if (op == "pctx") {
      const std::string which = t[i++];
      const lfw::Value v = parse_value(t, i);
      if (which == "data") g_pctx_data = v;
      else g_pctx_frame = v;
      emit_line("PX " + which + " " + to_ascii(render_value(v)));

    } else if (op == "pget") {
      const std::u16string key = to_u16(t[i++]);
      const lfw::Value* const v = g_opoint.get(key);
      emit_line("PE " + esc(key) + " " + (v != nullptr ? to_ascii(render_value(*v)) : "u"));

    } else if (op == "pkeys") {
      Line out;
      out.add(std::string_view("PK"));
      for (const std::u16string& k : g_opoint.keys()) out.add(esc(k));
      out.out();

    } else if (op == "fire") {
      fire_any();

    } else if (op == "clk") {
      const std::string sub = t[i++];
      if (sub == "set") {
        g_fake_clock.value = to_double(t[i++]);
      } else if (sub == "adv") {
        g_fake_clock.value += to_double(t[i++]);
      } else if (sub == "hidden") {
        g_fake_clock.hid = trace::to_flag(t[i++]);
      } else if (sub == "pend") {
        Line out;
        out.add(std::string_view("PEND"));
        out.add("clock=" + std::to_string(g_fake_clock.pending.size()));
        out.add("tout=" + std::to_string(g_fake_timeout.pending.size()));
        out.out();
      } else {
        std::fprintf(stderr, "line %d: unknown clk sub '%s'\n", lineno, sub.c_str());
        return 2;
      }

    } else if (op == "tk") {
      const std::string sub = t[i++];
      if (sub == "new") {
        g_tk_opt = TestTickerOptions();
        g_tk_opt.step = to_double(t[i++]);
        // 开一段新的：宿主把两个待发队列丢掉（用例因此可以逐段独立读）。
        g_fake_clock.pending.clear();
        g_fake_timeout.pending.clear();
        g_ticker = std::make_unique<lfw::Ticker>(&g_tk_opt);
      } else if (sub == "stepms") {
        g_tk_opt.step = to_double(t[i++]);
      } else if (sub == "spent") {
        g_tk_opt.spent = to_double(t[i++]);
      } else if (sub == "inside") {
        g_tk_opt.inside = t[i++];
      } else if (sub == "maxspan") {
        g_ticker->max_span = to_double(t[i++]);
      } else if (sub == "maxlag") {
        g_ticker->max_lag_steps = to_double(t[i++]);
      } else if (sub == "ratewin") {
        g_ticker->rate_window = to_double(t[i++]);
      } else if (sub == "start") {
        g_ticker->start();
      } else if (sub == "stop") {
        g_ticker->stop();
      } else if (sub == "pause") {
        g_ticker->pause();
      } else if (sub == "resume") {
        g_ticker->resume();
      } else if (sub == "resync") {
        g_ticker->resync(i < t.size() && trace::to_flag(t[i++]));
      } else if (sub == "dump") {
        ticker_dump();
      } else {
        std::fprintf(stderr, "line %d: unknown tk sub '%s'\n", lineno, sub.c_str());
        return 2;
      }

    } else if (op == "fps") {
      const std::string sub = t[i++];
      if (sub == "new") {
        g_fps = i < t.size() ? lfw::FPS(to_double(t[i++])) : lfw::FPS();
      } else if (sub == "update") {
        g_fps.update(to_double(t[i++]));
      } else if (sub == "reset") {
        g_fps.reset();
      } else if (sub == "dump") {
        fps_dump();
      } else {
        std::fprintf(stderr, "line %d: unknown fps sub '%s'\n", lineno, sub.c_str());
        return 2;
      }

    } else if (op == "gtt") {
      // `gtt <team> [<fallback>]`：team 是 JS 字符串字面量（`""` = Independent 的键）；
      // fallback 不写 = TS 的「没传」（走默认值），写了就是显式值（`""` 也算显式）。
      const std::u16string team = trace::parse_js_string_literal(t[i++]);
      const bool has_fallback = i < t.size();
      const std::u16string fallback =
          has_fallback ? trace::parse_js_string_literal(t[i++]) : std::u16string();
      Line out;
      out.add(std::string_view("GTT")).add(esc(team));
      out.add(has_fallback ? esc(fallback) : std::string("-"));
      out.add(esc(lfw::get_team_text_color(team, has_fallback ? &fallback : nullptr)));
      out.out();

    } else if (op == "gto") {
      const std::u16string team = trace::parse_js_string_literal(t[i++]);
      Line out;
      out.add(std::string_view("GTO")).add(esc(team)).add(esc(lfw::get_team_outline_color(team)));
      out.out();

    } else if (op == "gsf") {
      // 输入是 16 位十六进制的位模式（负数 / NaN / 超大值都要能喂）
      const std::string hex = t[i++];
      Line out;
      out.add(std::string_view("GSF"))
          .add(hex)
          .add(esc(lfw::get_short_file_size_txt(trace::bits_from_hex(hex))));
      out.out();

    } else {
      std::fprintf(stderr, "line %d: unknown op '%s'\n", lineno, op.c_str());
      return 2;
    }
  }

  return 0;
}
