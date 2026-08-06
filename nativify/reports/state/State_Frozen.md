# state/State_Frozen.ts

> 源文件: `src/LFW/state/State_Frozen.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 38 |
| 大小 | 1300 bytes |
| import 数 | 4 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- class 定义
- type 别名
- 可选链 ?.

## C++ 移植要点

- `src/LFW/state/State_Frozen.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
