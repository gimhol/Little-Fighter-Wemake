# ui/component/ReachableGroup.ts

> 源文件: `src/LFW/ui/component/ReachableGroup.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 62 |
| 大小 | 2392 bytes |
| import 数 | 5 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★★☆☆ 3 / 5 —— 中等** |

## 检测到的语言特征

- class 定义
- 箭头函数/回调
- getter/setter
- static 成员
- 正则/字符串匹配
- 数组高阶方法
- 回调注册/事件
- 可选链 ?.
- 动态属性访问 obj[key]
- switch 分支
- 非空断言 !

## C++ 移植要点

- `src/LFW/ui/component/ReachableGroup.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- getter/setter 语义需在 C++ 中通过访问器方法保持。
- static 可变状态在 C++ 中需注意初始化顺序与线程安全。
