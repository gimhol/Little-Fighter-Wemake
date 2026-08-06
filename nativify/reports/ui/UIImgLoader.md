# ui/UIImgLoader.ts

> 源文件: `src/LFW/ui/UIImgLoader.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 51 |
| 大小 | 1616 bytes |
| import 数 | 5 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★★☆☆ 3 / 5 —— 中等** |

## 检测到的语言特征

- class 定义
- type 别名
- 箭头函数/回调
- 正则/字符串匹配
- Object.* 反射方法
- async/await/Promise
- 模板字符串
- 异常处理
- 可空联合类型

## C++ 移植要点

- `src/LFW/ui/UIImgLoader.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- async/await 异步逻辑需重构为回调、协程或状态机。
- 可空联合类型建议用 `std::optional` / 指针表达。
- Object.* 反射方法需替换为显式代码或序列化框架。
