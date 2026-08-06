# base/FSM.ts

> 源文件: `src/LFW/base/FSM.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 104 |
| 大小 | 3305 bytes |
| import 数 | 2 |
| export 数 | 4 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★★☆☆ 3 / 5 —— 中等** |

## 检测到的语言特征

- class 定义
- interface 定义
- 箭头函数/回调
- getter/setter
- static 成员
- Map/Set 容器
- 回调注册/事件
- 可选链 ?.
- 空值合并 ??
- 模板字符串
- 展开运算符 ...
- 可空联合类型

## C++ 移植要点

- `src/LFW/base/FSM.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- Map/Set 需替换为 `std::unordered_map` / `std::unordered_set`，注意字符串键的性能与哈希。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
- getter/setter 语义需在 C++ 中通过访问器方法保持。
- static 可变状态在 C++ 中需注意初始化顺序与线程安全。
- 展开运算符需展开为循环或可变参数模板。
- 可空联合类型建议用 `std::optional` / 指针表达。
