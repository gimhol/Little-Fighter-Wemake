# dat_translator/bots/bot_explosion_dua.ts

> 源文件: `src/LFW/dat_translator/bots/bot_explosion_dua.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 47 |
| 大小 | 1501 bytes |
| import 数 | 5 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1 / 5 —— 微不足道** |

## 检测到的语言特征

- type 别名
- function 声明
- 箭头函数/回调
- 正则/字符串匹配

## C++ 移植要点

- `src/LFW/dat_translator/bots/bot_explosion_dua.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
