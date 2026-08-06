# utils/container_help/list_fn.ts

> 源文件: `src/LFW/utils/container_help/list_fn.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 38 |
| 大小 | 999 bytes |
| import 数 | 0 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★★☆☆☆ 2 / 5 —— 容易** |

## 检测到的语言特征

- `any` 类型使用 1 处
- `unknown` 使用 1 处
- function 声明
- Map/Set 容器
- string 键 Map
- 展开运算符 ...

## C++ 移植要点

- `src/LFW/utils/container_help/list_fn.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 存在 1 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- Map/Set 需替换为 `std::unordered_map` / `std::unordered_set`，注意字符串键的性能与哈希。
- string 键容器频繁使用，C++ 侧建议用 `std::string_view`/`const char*` 键或对象池优化。
- 展开运算符需展开为循环或可变参数模板。
