# [v0.1.56](https://lf.gim.ink/0.1.56)

by [**Gim**](https://gim.ink)

<!-- git-range: d94a6368..e16f8500 -->

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

### Tweaks

- Data conversion: grid separator lines are now removed from source images with a mask (some sprites could keep a trace of them)
- Desktop: the installer now defaults to the product-name folder ("Little Fighter Wemake")
- Desktop: pushing a version tag now builds and publishes the installer / portable build via GitHub Actions
- Fixed: with background zoom other than 1 (Football Field 0.5, Octagon 2), fighters could drift off-screen when the camera moved
- Maps from the extra data pack now come after the built-in maps (background list and rotation order)
- Dev panel: new "Background Preview" page (browse all backgrounds, tweak camera and layers)

### Thanks

- Thanks to "Sauce" (酱油), "布利.白" and the QQ group members I can't name, for their feedback, support and encouragement
- Thanks to the many more who have tried LFW
