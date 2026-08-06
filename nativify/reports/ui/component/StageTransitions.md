# ui/component/StageTransitions.ts

> 源文件: `src/LFW/ui/component/StageTransitions.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 15 |
| 大小 | 433 bytes |
| import 数 | 2 |
| export 数 | 1 |
| 分类 | 类实现 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- class 定义
- static 成员

## C++ 移植要点

- `src/LFW/ui/component/StageTransitions.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- static 可变状态在 C++ 中需注意初始化顺序与线程安全。
