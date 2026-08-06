# dat_translator/FrameEditing.ts

> 源文件: `src/LFW/dat_translator/FrameEditing.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 82 |
| 大小 | 3060 bytes |
| import 数 | 6 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★★☆☆ 3 / 5 —— 中等** |

## 检测到的语言特征

- `any` 类型使用 7 处
- class 定义
- type 别名
- 箭头函数/回调
- string 键 Map
- 数组高阶方法
- 回调注册/事件
- 动态属性访问 obj[key]
- 展开运算符 ...

## C++ 移植要点

- `src/LFW/dat_translator/FrameEditing.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 存在 7 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- string 键容器频繁使用，C++ 侧建议用 `std::string_view`/`const char*` 键或对象池优化。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 展开运算符需展开为循环或可变参数模板。
