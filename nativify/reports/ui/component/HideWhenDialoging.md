# ui/component/HideWhenDialoging.ts

> 源文件: `src/LFW/ui/component/HideWhenDialoging.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 20 |
| 大小 | 660 bytes |
| import 数 | 3 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- class 定义
- 箭头函数/回调
- static 成员
- 可选链 ?.
- 可空联合类型

## C++ 移植要点

- `src/LFW/ui/component/HideWhenDialoging.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- static 可变状态在 C++ 中需注意初始化顺序与线程安全。
- 可空联合类型建议用 `std::optional` / 指针表达。
