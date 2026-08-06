#pragma once
#include <cmath>

namespace lfw {

// 对应 TS: src/LFW/utils/Times.ts
// 次数/计时器。注意与 TS 保持完全一致的回绕语义：
//   add() 返回值 = 是否达到 max；达到时 remains 递减；v > max 才回绕到 min。
class Times {
public:
    static constexpr float kMin    = 0.f;
    static constexpr float kMax    = 1e15f;   // 近似 Number.MAX_SAFE_INTEGER
    static constexpr float kLifes  = 1e15f;

    Times() = default;
    Times(float min_, float max_) { set_range(min_, max_); }

    float value()   const { return _value; }
    float min()     const { return _min; }
    float max()     const { return _max; }
    float lifes()   const { return _lifes; }
    float remains() const { return _remains; }
    bool  is_max()  const { return _value >= _max; }
    bool  is_min()  const { return _value <= _min; }

    void set_value(float v) { _value = std::floor(v); }
    void set_min(float v)   { _min = std::floor(v); }
    void set_max(float v)   { _max = std::floor(v); }

    Times& set_range(float min_, float max_) {
        const float a = std::floor(min_);
        const float b = std::floor(max_);
        _min = a < b ? a : b;
        _max = a < b ? b : a;
        _value = a;
        return *this;
    }
    Times& set_lifes(float v = -1.f) { _lifes = std::floor(v); _remains = _lifes; return *this; }
    Times& reset() { _value = _min; _remains = _lifes; return *this; }

    // 返回是否“加满”。TS 实现：达到 max 时 remains--；超过 max 才回绕。
    bool add(float d = 1.f) {
        if (_remains == 0) return false;
        _value = round_float(_value + d);
        const bool ret = _value >= _max;
        if (ret && _remains > 0) --_remains;
        if (_value > _max) _value = _min;
        if (_value < _min) _value = _max;
        return ret;
    }

private:
    // TS round_float 是“保留 3 位小数”的舍入（LF2 精度约定），此处近似；
    // 移植时以 src/LFW/utils/math/round_float.ts 的精确实现为准。
    static float round_float(float v) { return std::round(v * 1000.f) / 1000.f; }

    float _value   = kMin;
    float _min     = kMin;
    float _max     = kMax;
    float _lifes   = kLifes;
    float _remains = kLifes;
};

} // namespace lfw
