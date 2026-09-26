# [v0.1.57](https://lf.gim.ink/0.1.57)

by [**Gim**](https://gim.ink)

<!-- git-range: d94a6368..1a5cbf164 -->

### What's New

- Move List (main menu entry): live move demos for every fighter
  - Each move plays automatically with real inputs and loops; the move name, inputs, description and MP cost are shown
  - Demos deal real damage / healing, and the pressed keys are displayed overhead
  - The list scrolls with the wheel or by dragging; hover or click a row to switch to that move, and the list auto-scrolls to the current one
  - New Template tutorial demos: walk, defend (guard break), dodge (landing roll), punch combo, run attack, jump attack, catch & throw, breakfall, etc.
  - Hidden fighters (Mark / Jack / Sorcerer / Monk / Jan / Knight / Bat / Justin / LouisEX / Firzen / Julian) appear after enabling the cheat
- New background "Octagon": a cage-fighting arena (chain-link cage, ceiling lights, crowd, logo fight mat)
- New background "Football Field": a full-size stadium pitch
  - Textured grass with mowing stripes; complete soccer markings: halfway line, center circle, penalty & goal areas, penalty spots, penalty arc, corner arcs, goal nets
  - Stands, crowd, ad boards and sky around the pitch
  - Both Octagon and Football Field join the normal random background rotation
- Desktop: automatic mod loading — data packs in the `mods/` folder (next to the program, and in the user data folder) are loaded at startup (later ones override earlier ones); `mods.json5` adjusts the order or disables packs, `--mods <dir>` adds one on the fly, `--no-mods` turns loading off

### Tweaks

- Data conversion: grid separator lines are now removed from source images with a mask (some sprites could keep a trace of them)
- Desktop: the installer now defaults to the product-name folder ("Little Fighter Wemake")
- Desktop: pushing a version tag now builds and publishes the installer / portable build via GitHub Actions
- Fixed: with background zoom other than 1 (Football Field 0.5, Octagon 2), the auto camera and character follow were offset horizontally / vertically (fighters could drift off-screen)
- Maps from the extra data pack now come after the built-in maps (background list and rotation order)
- Dev panel: the previewer was rebuilt with three tabs (background / entity / image); the canvas can be dragged to pan and scrolled to zoom
- Survival rank: the solo board is now grouped by fighter, the 2P board by the pair of fighters, each keeping its own best score
- Update checks now read `latest.json`, which carries the commit hash and avoids a cache making it report a stale version

### Thanks

- Thanks to "Sauce" (酱油), "布利.白" and the QQ group members I can't name, for their feedback, support and encouragement
- Thanks to the many more who have tried LFW
