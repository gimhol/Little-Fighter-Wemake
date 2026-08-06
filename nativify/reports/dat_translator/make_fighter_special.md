# dat_translator/make_fighter_special.ts

> 源文件: `src/LFW/dat_translator/make_fighter_special.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 110 |
| 大小 | 4830 bytes |
| import 数 | 25 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- function 声明
- 正则/字符串匹配
- 空值合并 ??
- switch 分支
- 数字/字符串转换

## C++ 移植要点

- `src/LFW/dat_translator/make_fighter_special.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
