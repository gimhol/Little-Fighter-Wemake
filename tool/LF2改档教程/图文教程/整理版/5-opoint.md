# 5. 物件生成框 opoint

> 介绍 `<opoint>` ~ `<opoint_end>` 的结构与说明。

## 目录

- [结构](#结构)
- [字段说明](#字段说明)
- [kind 种类](#kind-种类)
- [facing 方向与数量](#facing-方向与数量)

## 结构

```text
opoint:  (object point)
kind:
x:
y:
dvx:
dvy:
action:
oid:
facing:
opoint_end:
```

## 字段说明

| 字段 | 说明 |
| ---- | ---- |
| kind | 种类 |
| x / y | 位置 |
| dvx / dvy | 初速度 |
| action | 物件动作 |
| oid | （object id）物件 id |
| facing | 方向、数量 |

## kind 种类

| kind | 说明 |
| ---- | ---- |
| 1 | 造出物件 |
| 2 | 造出物件并持在手上 |

## facing 方向与数量

| facing | 说明 |
| ------ | ---- |
| 0 | 正向造出物件 |
| 1 | 反向造出物件 |
| 2 ~ 19 | 固定向右 |
| #0 | 正向造出 # 个物件 |
| #1 | 反向造出 # 个物件 |
