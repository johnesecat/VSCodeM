# IDENTIFIER MAPPING (§8)

**Policy: 1:1 preservation.** Primary namespace `psychedelicraft` kept unchanged. All 59 block ids,
97 item ids, 27 fluid ids, 18 drug ids, 46 recipe ids, 45 loot-table paths and 12 worldgen feature
ids are byte-identical to their Java identifiers. No renames were required.

| Java ID | Bedrock ID | Note |
|---|---|---|
| `psychedelicraft:*` (all content) | `psychedelicraft:*` | identical |
| `psychedelicraft:coccaine` | `psychedelicraft:coccaine` | upstream typo preserved deliberately (drug registry id) |
| Java lang `block.psychedelicraft.<n>` | `tile.psychedelicraft:<n>.name` | Bedrock lang key format |
| Java lang `item.psychedelicraft.<n>` | `item.psychedelicraft:<n>.name` | Bedrock lang key format |
| Java lang `psychedelicraft.alcohol.<drink>` | same key inside `scripts/data/lang.js` | drink naming preserved |
| Java sound events `psychedelicraft:entity.player.heartbeat` etc. | `psbed:entity.player.heartbeat` (sound_definitions) | prefix avoids atlas-name collisions; subtitle keys preserved |
| Java recipe types `psychedelicraft:mashing` etc. | `RECIPES.<type>` script tables | ids preserved inside tables |
| Java loot `psychedelicraft:blocks/<x>` | `LOOT_TABLES["blocks/<x>"]` + empty engine table | verbatim tables |
