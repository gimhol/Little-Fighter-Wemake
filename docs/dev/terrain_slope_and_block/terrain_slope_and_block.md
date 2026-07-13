# 实体与斜坡“碰撞”

![terrain_slope_and_block](./terrain_slope_and_block.jpg)

实体进入 (x,y,z) 位置时，与斜坡产生“碰撞”，此时会产生“挤出点数组”，如图为[(block_x, z), (x, block_z)]，该“挤出点”与碰撞点越接近，其在“挤出点数组”顺序则越靠前。