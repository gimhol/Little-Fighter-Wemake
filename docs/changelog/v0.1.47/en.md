# [v0.1.47](https://lf.gim.ink/0.1.47)

by [**Gim**](https://gim.ink)

"UNZIP !"

### What's New

- You can now switch the language (unproofread)
  ![switch_lang_w400.gif](../../image/switch_lang_w400.gif)
- New weapon: Book Bundle + Book x3 (the first 3D-model weapon; heavy weapon / light thrown 3D-model weapons)
- ![unzip_w400.gif](../../image/unzip_w400.gif)

### Weapons / Feel

- Light weapons flung by a whirlwind now count as the whirlwind's side, so they won't hit your own team
- Thrown weapons no longer land super-fast consecutive hits when flung by a whirlwind
- When a heavy weapon hits someone, the victim's velocity direction is now decided by their relative positions
- Weapons can only be picked up while on the ground

### Fixes

- Fixed wrong team-alive checks in campaign mode
- Campaign shutter animation is now pure black
- Fixed occlusion between 3D models and 2D characters/items so they no longer appear to interpenetrate: front/back is now decided by Z, so a front (larger-Z) 2D entity fully covers a 3D one behind it, and a 2D one behind is fully covered by a 3D one in front (unproofread)
