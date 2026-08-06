# bot/state/BotState_StageEnd.ts

> 源文件: `src/LFW/bot/state/BotState_StageEnd.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 47 |
| 大小 | 1098 bytes |
| import 数 | 3 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- class 定义
- 展开运算符 ...
- 可空联合类型

## C++ 移植要点

- `src/LFW/bot/state/BotState_StageEnd.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 展开运算符需展开为循环或可变参数模板。
- 可空联合类型建议用 `std::optional` / 指针表达。
