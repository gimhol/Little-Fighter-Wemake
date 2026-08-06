# dat_translator/get_the_next.ts

> 源文件: `src/LFW/dat_translator/get_the_next.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 52 |
| 大小 | 1564 bytes |
| import 数 | 2 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- type 别名
- 箭头函数/回调
- string 键 Map

## C++ 移植要点

- `src/LFW/dat_translator/get_the_next.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- string 键容器频繁使用，C++ 侧建议用 `std::string_view`/`const char*` 键或对象池优化。
