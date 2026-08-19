# v0.1.14

by [**Gim**](https://gim.ink)  2026-04-01 02:12:42

- fix(game): When there are no enemies for Firzen's d^a, it will no longer split.
- fix(tool): Support negative MP consumption.
- fix(game): Fix the problem of abnormal stat display.
- fix(game): Fix the issues that after an enemy surrenders, the attack target is not removed and the team stroke color does not change.
- fix(game): Fix the bug that the weapon follows with a one-frame delay.
- fix(game): Fix the problem that when throwing someone, the position of the thrown person is incorrect.
- fix(game): When taking damage, the armor value returns to 0.
- fix(game): Refactored the implementation of tracking and adjusted its effect.
- fix(game): Fix the problem of the ball having a 2-times Z-axis speed.
- fix(game/tool): The ball no longer collides with the ground by default.
- fix(game/tool): Itr supports on_hit_ground (For Firzen/Jan's ball, it originally only judged whether it landed based on centery).
- fix(dev): Support exporting world-tuning data.
- fix(game): Fix the problem of too high defense value (it takes 4 hits to break the defense).

- Thanks to "Sauce" and "Memento" for their feedback.

