# PlayerInfo.ts

> 源文件: `src/LFW/PlayerInfo.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 137 |
| 大小 | 5029 bytes |
| import 数 | 13 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★★★☆ 4 / 5 —— 困难** |

## 检测到的语言特征

- class 定义
- type 别名
- getter/setter
- static 成员
- JSON 序列化
- 正则/字符串匹配
- 回调注册/事件
- 动态属性访问 obj[key]
- async/await/Promise
- 二进制/字节数组
- 异常处理
- 可空联合类型

## C++ 移植要点

- `src/LFW/PlayerInfo.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- JSON 处理需引入第三方库（nlohmann/json 等）或自定义解析。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- async/await 异步逻辑需重构为回调、协程或状态机。
- 二进制/字节处理需映射到 `std::vector<uint8_t>` 等原生类型。
- getter/setter 语义需在 C++ 中通过访问器方法保持。
- static 可变状态在 C++ 中需注意初始化顺序与线程安全。
- 可空联合类型建议用 `std::optional` / 指针表达。
