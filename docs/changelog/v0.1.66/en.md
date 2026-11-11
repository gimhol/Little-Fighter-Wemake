# [v0.1.66](https://lf.gim.ink/0.1.66)

by [**Gim**](https://gim.ink)

<!-- git-range: dfc9ca610..HEAD -->

"Terrain and netplay"

### What's New

- Terrain data gains `one_way` / `cliff` / `cliff_frame` / `cliff_respawn_y`: one-way platforms, cliff detection and post-fall respawn points.

### Tweaks

- Defend + Down now drops through one-way platforms where the terrain allows it.
- Stricter running restrictions.
- Fixed a few weapon pickup checks.
- Further netplay UI tweaks (connect dialog, room list, room page): button labels and layout.

### Fixes

- The top-bar drag layer is no longer rendered outside the desktop shell (browser / extension / Bilibili Toy), so buttons at the top of the screen (room list / room page actions) are no longer blocked; Electron / Wails keeps window dragging.
