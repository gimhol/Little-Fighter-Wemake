#pragma once

#include <functional>
#include <string_view>

namespace lfw {

// Mirrors `src/LFW/ui/component/SmoothNumber.ts`。
class SmoothNumber {
 public:
  double value() const { return _v; }
  void set_value(double v) {
    if (_t == v) return;
    _v = _t = v;
    done_ = true;
  }

  double target() const { return _t; }
  void set_target(double v) {
    if (_t == v) return;
    _t = v;
    done_ = false;
  }

  SmoothNumber& mode(std::string_view v) {
    _mode = v;
    return *this;
  }
  SmoothNumber& speed(double v) {
    _speed = v;
    return *this;
  }
  SmoothNumber& factor(double v) {
    _factor = v;
    return *this;
  }
  SmoothNumber& min_diff(double v) {
    _min_diff = v;
    return *this;
  }

  SmoothNumber& handler(std::function<void(SmoothNumber&)> v) {
    _c = std::move(v);
    return *this;
  }
  void handle() { _c(*this); }

  void update();
  bool done() const { return done_; }

 private:
  double _v = 0;
  double _t = 0;
  std::function<void(SmoothNumber&)> _c = [](SmoothNumber&) {};
  std::string_view _mode = "linear";
  double _speed = 20;
  double _factor = 0.3;
  double _min_diff = 1;
  bool done_ = false;
};

}
