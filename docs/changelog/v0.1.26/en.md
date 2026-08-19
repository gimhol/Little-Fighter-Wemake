# v0.1.26

by [**Gim**](https://gim.ink)  2026-05-31 22:38:43

#### News
- **Recapture the laggy feel of childhood**
- Rudolf D<>A can now directly use his **Super Punch**.
  - Designed to show the differences between LFW and classic LF2.
  - LFW supports longer combo input sequences.
    ![jkhgfd.gif](https://lfwm.gim.ink/user/2/687/3b726f48c299348391dccdb112ecb217 "jkhgfd.gif")

#### Values & Game Logic
- Armor Mechanics
  - Fixed an issue where armor remained effective even when a target’s current frame armor value ≤ 0.
    - This bug made Julian and Knight overly tanky.
  - Fixed arrows bouncing instead of disappearing when striking through armor.

- Fixed bugs related to `opint.spreading = OpointSpreading.FloatRange`
  - Caused Julian D>A’s ball projectile to only spawn with downward initial velocity.

- Fixed an issue where objects spawned by opoint would skip the 0th frame instantly
  - Weakened certain projectiles (e.g. Henry / Monk / Louis / LouisEx D>A).
  - Caused inconsistent behavior for multiple ball-type skills.

- Fixed a glitch allowing teleportation near 0 HP targets (Woody D^J / DvJ).
- Immediately reset `arest` if a frame contains no itr data
  - Matches original LF2 behavior.

#### Controls & Gameplay
- Revised input priority order, new sequence: **D , < , > , ^ , v , J , A**
  - Old order: `< , > , ^ , v , A , J , D`
  - Previously, pressing J+A while standing would trigger a normal attack instead of a jump attack (same for running jump attacks).

- Reworked double-tap sprint logic
  - Removed the awkward behavior of instantly resuming sprinting after stopping.

- Adjusted `itr.dvy` calculation to enable more consistent combos.
- Keeps input buffer states during most hit reactions (excluding knockdown and knockback).

#### Misc

- Added colors for Team5 ~ Team8
- Adjusted Demo Mode
  - Demo now randomly uses bots to play stage mode
  - The demo will automatically restart after ending
- Added zoom support for background layers.
- Fully rewritten AI evasion logic for Bots.
- Fixed inability to access settings from the main menu.
- Added support for running the game at **30 UPS / 90 UPS / 120 UPS**.
  ***Certain in-game calculations will function differently across UPS values.***
- Online matches are locked to 30 UPS.
- Mobile devices default to 30 UPS.
- ~~Attempted render interpolation (improves smooth FPS at low UPS)~~

