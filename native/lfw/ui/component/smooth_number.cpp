#include "lfw/ui/component/smooth_number.h"

#include "lfw/utils/math/base.h"
#include "lfw/utils/math/float_equal.h"

namespace lfw {

void SmoothNumber::update() {
  if (done_) return;

  if (float_equal(_t, _v)) {
    done_ = true;
    _c(*this);
    return;
  }

  if (_mode == "linear") {
    const double diff = _t - _v;
    _v += abs(diff) > _speed ? _speed * sign(diff) : diff;
    if (_v == _t) done_ = true;
  } else {
    _v = _v + _factor * (_t - _v);
    if (abs(_v - _t) < _min_diff) {
      done_ = true;
      _v = _t;
    }
  }
  _c(*this);
}

}
