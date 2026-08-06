# state/CharacterState_Burning.ts

> 源文件: `src/LFW/state/CharacterState_Burning.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 50 |
| 大小 | 1443 bytes |
| import 数 | 4 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★☆☆☆ 2 / 5 —— 容易** |

## 检测到的语言特征

- class 定义
- type 别名
- Map/Set 容器
- 正则/字符串匹配
- 可选链 ?.

## C++ 移植要点

- `src/LFW/state/CharacterState_Burning.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- Map/Set 需替换为 `std::unordered_map` / `std::unordered_set`，注意字符串键的性能与哈希。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
