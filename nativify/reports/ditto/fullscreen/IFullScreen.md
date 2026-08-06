# ditto/fullscreen/IFullScreen.ts

> 源文件: `src/LFW/ditto/fullscreen/IFullScreen.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 13 |
| 大小 | 414 bytes |
| import 数 | 2 |
| export 数 | 1 |
| 分类 | 纯类型声明 (interface/type) |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- `any` 类型使用 2 处
- interface 定义
- getter/setter
- async/await/Promise
- 泛型默认 any
- 可空联合类型

## C++ 移植要点

- `src/LFW/ditto/fullscreen/IFullScreen.ts` 仅包含 interface/type 声明，编译期即被擦除，无运行时开销。
- C++ 侧可机械映射为 struct / class 定义，字段名与类型一一对应。
- 存在 2 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- async/await 异步逻辑需重构为回调、协程或状态机。
- getter/setter 语义需在 C++ 中通过访问器方法保持。
- 可空联合类型建议用 `std::optional` / 指针表达。
