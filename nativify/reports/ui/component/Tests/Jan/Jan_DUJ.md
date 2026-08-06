# ui/component/Tests/Jan/Jan_DUJ.ts

> 源文件: `src/LFW/ui/component/Tests/Jan/Jan_DUJ.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 23 |
| 大小 | 606 bytes |
| import 数 | 2 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★☆☆☆ 2 / 5 —— 容易** |

## 检测到的语言特征

- class 定义
- 箭头函数/回调
- 数组高阶方法
- 回调注册/事件

## C++ 移植要点

- `src/LFW/ui/component/Tests/Jan/Jan_DUJ.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
