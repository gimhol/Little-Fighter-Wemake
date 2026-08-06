# dat_translator/EditBdy.ts

> 源文件: `src/LFW/dat_translator/EditBdy.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 41 |
| 大小 | 1233 bytes |
| import 数 | 3 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★☆☆☆ 2 / 5 —— 容易** |

## 检测到的语言特征

- class 定义
- static 成员
- Object.* 反射方法

## C++ 移植要点

- `src/LFW/dat_translator/EditBdy.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- static 可变状态在 C++ 中需注意初始化顺序与线程安全。
- Object.* 反射方法需替换为显式代码或序列化框架。
