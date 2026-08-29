# 0. BMP 基本信息（bmp_begin）

> 介绍 dat 档开头的 `<bmp_begin>` ~ `<bmp_end>` 区块结构。

## 目录

- [结构](#结构)
- [字段说明](#字段说明)
- [附图](#附图)

## 结构

```text
<bmp_begin>
name:
head:
small:
file  w:  h:  row:  col:
walking_frame_rate
walking_speed
walking_speedz
running_frame_rate
running_speed
running_speedz
heavy_walking_speed
heavy_walking_speedz
heavy_running_speed
heavy_running_speedz
jump_height
jump_distance
jump_distancez
dash_height
dash_distance
dash_distancez
rowing_height
rowing_distance
weapon_hp:
weapon_drop_hurt:
weapon_hit_sound:
weapon_drop_sound:
weapon_broken_sound:
<bmp_end>
```

## 字段说明

| 字段 | 说明 |
| ---- | ---- |
| name | 名字 |
| head | 大头照 |
| small | 小图示 |
| file | 图片路径 |
| w / h / row / col | 定格图的设定（宽 / 高 / 行 / 列） |
| walking_frame_rate | 走路动作图的时间 |
| walking_speed | 走路速度 |
| walking_speedz | 走路 z 向速度 |
| running_frame_rate | 跑步动作图的时间 |
| running_speed | 跑步速度 |
| running_speedz | 跑步 z 向速度 |
| heavy_walking_speed | 拿重物走路速度 |
| heavy_walking_speedz | 拿重物走路 z 向速度 |
| heavy_running_speed | 拿重物跑步速度 |
| heavy_running_speedz | 拿重物跑步 z 向速度 |
| jump_height | 跳跃高度（负值） |
| jump_distance | 跳跃距离 |
| jump_distancez | 跳跃 z 向距离 |
| dash_height | 冲刺高度（负值） |
| dash_distance | 冲刺距离 |
| dash_distancez | 冲刺 z 向距离 |
| rowing_height | 受身高度（负值） |
| rowing_distance | 受身距离 |
| weapon_hp | 武器血量 |
| weapon_drop_hurt | 武器落地损血量 |
| weapon_hit_sound | 武器被打的声音 |
| weapon_drop_sound | 武器落地的声音 |
| weapon_broken_sound | 武器毁坏的声音 |

> 对应关系：名字、大头照、小图示、跑步、走路、拿重物、跳跃、冲刺、受身。

## 附图

![image1](0-bmp-begin_images/image1.gif)

![image2](0-bmp-begin_images/image2.gif)

![image3](0-bmp-begin_images/image3.gif)

![image4](0-bmp-begin_images/image4.gif)

![image5](0-bmp-begin_images/image5.gif)

![image6](0-bmp-begin_images/image6.gif)

![image7](0-bmp-begin_images/image7.gif)

![image8](0-bmp-begin_images/image8.gif)

![image9](0-bmp-begin_images/image9.gif)
