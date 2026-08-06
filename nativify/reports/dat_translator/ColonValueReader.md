# dat_translator/ColonValueReader.ts

> 源文件: `src/LFW/dat_translator/ColonValueReader.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 62 |
| 大小 | 1910 bytes |
| import 数 | 0 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★★☆☆ 3 / 5 —— 中等** |

## 检测到的语言特征

- `any` 类型使用 4 处
- class 定义
- enum 定义
- 正则/字符串匹配
- 数组高阶方法
- 动态属性访问 obj[key]
- 模板字符串
- 泛型默认 any
- switch 分支
- 可空联合类型
- 数字/字符串转换

## C++ 移植要点

- `src/LFW/dat_translator/ColonValueReader.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 存在 4 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- 可空联合类型建议用 `std::optional` / 指针表达。
