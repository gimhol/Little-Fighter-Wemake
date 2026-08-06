# state/CharacterState_Base.ts

> 源文件: `src/LFW/state/CharacterState_Base.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 72 |
| 大小 | 2264 bytes |
| import 数 | 3 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★☆☆☆ 2.5 / 5 —— 较易** |

## 检测到的语言特征

- class 定义
- type 别名
- 可选链 ?.
- 动态属性访问 obj[key]
- switch 分支
- 可空联合类型

## C++ 移植要点

- `src/LFW/state/CharacterState_Base.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 可空联合类型建议用 `std::optional` / 指针表达。
