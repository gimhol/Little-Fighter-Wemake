# dat_translator/make_fighter_data.ts

> 源文件: `src/LFW/dat_translator/make_fighter_data.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 594 |
| 大小 | 20186 bytes |
| import 数 | 23 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★★★★☆ 4 / 5 —— 困难** |

## 检测到的语言特征

- `any` 类型使用 3 处
- type 别名
- function 声明
- 箭头函数/回调
- Map/Set 容器
- string 键 Map
- 数组高阶方法
- 回调注册/事件
- 可选链 ?.
- 动态属性访问 obj[key]
- 模板字符串
- 展开运算符 ...
- 异常处理
- switch 分支
- 可空联合类型
- 非空断言 !
- 数字/字符串转换

## C++ 移植要点

- `src/LFW/dat_translator/make_fighter_data.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 存在 3 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- Map/Set 需替换为 `std::unordered_map` / `std::unordered_set`，注意字符串键的性能与哈希。
- string 键容器频繁使用，C++ 侧建议用 `std::string_view`/`const char*` 键或对象池优化。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 展开运算符需展开为循环或可变参数模板。
- 可空联合类型建议用 `std::optional` / 指针表达。


## 📌 人工深度分析

本文件为核心文件，已人工复核。详见：[deep-dive/dat_translator-make_fighter_data.md](../deep-dive/dat_translator-make_fighter_data.md)
