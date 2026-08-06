# dat_translator/fighters/make_fighter_data_julian.ts

> 源文件: `src/LFW/dat_translator/fighters/make_fighter_data_julian.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 27 |
| 大小 | 797 bytes |
| import 数 | 2 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- type 别名
- function 声明
- 箭头函数/回调
- 正则/字符串匹配
- 数组高阶方法
- 可选链 ?.
- 动态属性访问 obj[key]

## C++ 移植要点

- `src/LFW/dat_translator/fighters/make_fighter_data_julian.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
