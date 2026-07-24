# Entity Variants

[中文](Variant.md) | [English](Variant.en.md)

## Entity Variants in the Original LF2

LF2 adopts an implicit mechanism to render different sprite variants for entities.

In Story Mode, when a "criminal" has `frame.state == 80XX`, it will turn into the entity with ID `XX`.

Take Bandit as an example. If the entity sprite assets are declared as below, the blue version of Bandit becomes available:

```plaintext
file(0-69): sprite\sys\bandit_0.bmp  w: 79  h: 79  row: 10  col: 7
file(70-139): sprite\sys\bandit_1.bmp  w: 79  h: 79  row: 10  col: 7
file(140-209): sprite\sys\bandit_0b.bmp  w: 79  h: 79  row: 10  col: 7
file(210-279): sprite\sys\bandit_1b.bmp  w: 79  h: 79  row: 10  col: 7
```

Mapping Table:

| Original Asset | Description               | Variant Asset | Description               |
|----------------|---------------------------|---------------|---------------------------|
| file(0-69)     | Red Bandit Sprite Set 1   | file(140-209) | Blue Bandit Sprite Set 1  |
| file(70-139)   | Red Bandit Sprite Set 2   | file(210-279) | Blue Bandit Sprite Set 2  |

Entitys that do not follow this  rule will render sprites incorrectly.

## Entity Variants in LFW

Sample entity data (Bandit again):

```json
{
  "base": {
    "name": "Bandit",
    "files": {
      "0": {
        "id": "0",
        "path": "sprite/sys/bandit_0.png",
        "variants": [ "2" ] // Team 1 variant of files[0] points to files[2]
      },
      "1": {
        "id": "1",
        "path": "sprite/sys/bandit_1.png",
        "variants": [ "3" ] // Team 1 variant of files[1] points to files[3]
      },
      "2": {
        "id": "2",
        "path": "sprite/sys/bandit_0b.png"
      },
      "3": {
        "id": "3",
        "path": "sprite/sys/bandit_1b.png"
      }
    }
  }
}
```

The `variants` array defines alternative sprites for entities on different teams.

Since `files[0].variants = ["2"]`, Bandit on Team 1 will automatically load `files[2]` instead of `files[0]` when rendering that sprite entry.

By the same logic, you can add variant sprites for multiple teams with the syntax:
`files[0].variants = ["2", "4", "6", ...]`
(Note: Entries `files[4]`, `files[6]`, etc. must be defined in the `files` object.)
