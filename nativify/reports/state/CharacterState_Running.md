# state/CharacterState_Running.ts

> 源文件: `src/LFW/state/CharacterState_Running.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 25 |
| 大小 | 674 bytes |
| import 数 | 4 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- class 定义
- 正则/字符串匹配

## C++ 移植要点

- `src/LFW/state/CharacterState_Running.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
