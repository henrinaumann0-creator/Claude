# BlockCraft — a Minecraft-style voxel game in one HTML file

Open `index.html` in a current desktop browser (Chrome, Edge or Firefox). There is no build step and nothing to install; Three.js r128 and JSZip 3.10 load from cdnjs, so you need to be online the first time.

## Quick start
1. Optionally enter a seed (any text or number) and choose **Survival** or **Creative**.
2. Optionally drop a Minecraft Java resource pack `.zip` onto the dashed box, e.g. *New Default+*. Without one, built-in 16×16 pixel textures are used.
3. Click **Create New World**, then click the game to capture the mouse.

## Controls
| Key | Action |
| --- | --- |
| WASD / mouse | move / look |
| Space | jump, swim up; **double-tap** to toggle flying (creative) |
| Shift | sneak (won't fall off edges) / fly down |
| Ctrl or double-tap W | sprint |
| Left mouse (hold) | mine / attack |
| Right mouse | place, use, open, eat (hold), draw bow (hold) |
| Middle mouse | pick block |
| 1–9, mouse wheel | hotbar |
| E | inventory (2×2 crafting; creative item list in creative) |
| Q / Ctrl+Q | drop one / drop stack |
| / or T | commands: `/time set night`, `/give diamond 5`, `/gamemode creative`, `/tp x y z`, `/summon zombie`, `/weather rain`, `/seed`, `/spawnpoint`, `/locate` (nearest stronghold), `/dimension end` |
| F3 · F4 · F1 | debug info · toggle creative/survival · hide HUD |
| Esc | pause menu (save, export, settings, resource pack) |

In inventories: click to pick up or place, right-click to split, shift-click to quick-move, drag onto another slot, and press 1–9 over a slot to swap it with the hotbar.

## What's in it
- **World:** 16×16×128 chunks streamed around the player (render distance adjustable from 2 to 12). Per-face culling plus greedy meshing with smooth lighting and ambient occlusion.
- **Terrain:** inline simplex noise with oceans, rivers, beaches, plains, forest, desert, mountains and snowy taiga. It includes 3D-noise caves and ravines, lava pools, depth-based ores, a bedrock floor, oak/birch/spruce trees, tall grass, flowers, sugar cane and cacti.
- **Structures:** dungeons (spawner and loot chests), village houses with a villager and a wheat farm, and ruined portals.
- **Resource packs:** reads `assets/minecraft/textures/block|item/*.png` with modern or 1.12 names at any resolution (16/32/64…). Grass, leaves, water and redstone are tinted. Animated strips use their first frame, and OptiFine/MCPatcher content, `.properties` and `.mcmeta` files are ignored.
- **Lighting:** flood-filled sky and block light (torches, lava, glowstone, fire, lamps), a day/night cycle with sun, moon, stars, clouds and a sunset glow, plus rain and snow by biome.
- **Survival:** health, hunger and saturation, regeneration, fall damage, drowning, fire, lava and cactus damage, death and respawn, and XP.
- **Armor, enchanting and potions:** leather, gold, iron and diamond armor with vanilla damage reduction and an armor bar. The enchanting table's power depends on nearby bookshelves (Efficiency, Sharpness, Knockback, Fire Aspect, Unbreaking, Protection, Feather Falling, Power). The brewing stand runs on blaze powder: water bottle + Nether wart → awkward potion → Swiftness, Healing, Poison, Regeneration or Fire Resistance.
- **Items:** tools in five tiers with durability and vanilla mining speeds, 3×3 crafting with over 100 recipes, furnaces with fuel and smelting, chests, buckets, flint and steel, bone meal, bow and arrows, and food.
- **Farming and fluids:** tilling with a hoe, crops that grow faster on hydrated farmland, saplings, water and lava that flow and react (obsidian/cobblestone), and fire that spreads.
- **Mobs:** pig, cow, sheep (shearable, coloured wool), chicken, zombie, skeleton (ranged), creeper (explodes), spider, Enderman (angry if you look at it, teleports, drops ender pearls) and villager (trading). In the Nether: zombified piglins (neutral, attack as a group), ghasts (explosive fireballs you can punch back) and blazes (drop blaze rods). Hostile mobs use A* pathfinding, spawn in the dark and burn in daylight. Animals breed when fed (babies grow up after 5 minutes). There are health bars, knockback, critical hits and drops.
- **Redstone:** lever, button, dust with power falloff, redstone torch (inverter), repeater, lamp, piston, door and TNT.
- **Nether:** light a 4×5 obsidian frame with flint and steel. The Nether has netherrack caves, a lava sea, glowstone, quartz and Nether wart, with linked return portals.
- **The End:** craft Eyes of Ender (ender pearl + blaze powder) and throw them; they fly towards the nearest stronghold. Dig down to its portal room, fill the 12 frames and jump in. The End has a central island with ten obsidian pillars topped by healing crystals, and the **Ender Dragon** boss (boss bar, dive attacks). Killing it builds the exit portal home and leaves the dragon egg.
- **Saving:** the world is stored as a seed plus the blocks you changed, in localStorage (autosaves every minute) or as an exported/imported JSON file.

## Not implemented (marked `// STUB:` in the code)
Splash potions and potion upgrades, enchanted books and anvils, Nether fortresses, outer End islands and End cities, dragon perching and breath attacks, mineshafts and full villages, thunder, sticky pistons, comparators and connection-aware redstone dust, per-biome colour tinting, mob textures from packs, and saving mobs/dropped items.

Some recipes are simplified on purpose. Magma cream is made from blaze powder + gunpowder because there are no magma cubes, and pigs breed with wheat because there are no carrots. Search the file for `STUB:` to find each gap.

## Code map
The single `<script>` is split into numbered sections (`§1`–`§17`, listed in the header comment): config, noise, registry, textures and pack loader, world generation, lighting, mesher, renderer, physics, entities, world systems, sound, UI, HUD, input, persistence and the game loop. To add a new block, call `defBlock()` in §3 with vanilla texture names and give it a procedural texture in `BLOCK_GEN` (§4).
