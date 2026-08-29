# 3. 身体框 bdy 与出血点 bpoint

> 介绍 `<bdy>` ~ `<bdy_end>` 与 `<bpoint>` ~ `<bpoint_end>` 的结构与说明。

## 目录

- [bdy 身体框](#bdy-身体框)
- [bpoint 出血点](#bpoint-出血点)

## bdy 身体框

### 结构

```text
bdy:  (body)
kind:
x:
y:
w:
h:
bdy_end:
```

### 字段说明

| 字段 | 说明 |
| ---- | ---- |
| kind | 种类 |
| x / y / w / h | 范围 |

### kind

- 在 id 300 的情况下：
  - `10##`：被攻击时会跳到 ## 动作。

## bpoint 出血点

### 结构

```text
bpoint:  (bleed point)
x:
y:
bpoint_end:
```

### 字段说明

- x / y：嘴角的位置。
