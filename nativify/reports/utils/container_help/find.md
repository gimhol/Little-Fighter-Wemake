# utils/container_help/find.ts

> 源文件: `src/LFW/utils/container_help/find.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 27 |
| 大小 | 1085 bytes |
| import 数 | 1 |
| export 数 | 7 |
| 分类 | 纯函数工具 |
| **移植难度** | **★★☆☆☆ 2.5 / 5 —— 较易** |

## 检测到的语言特征

- `any` 类型使用 3 处
- `unknown` 使用 6 处
- function 声明
- 箭头函数/回调
- 数组高阶方法
- 回调注册/事件
- 动态属性访问 obj[key]
- 展开运算符 ...
- Reflect/Proxy/Symbol
- 可空联合类型

## C++ 移植要点

- `src/LFW/utils/container_help/find.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 存在 3 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 反射/代理特性在 C++ 中没有直接对应物，需要重新设计。
- 展开运算符需展开为循环或可变参数模板。
- 可空联合类型建议用 `std::optional` / 指针表达。
