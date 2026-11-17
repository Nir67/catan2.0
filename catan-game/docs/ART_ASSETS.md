# Game artwork

Generated with the built-in image_gen tool. Transparent PNG output is preserved in these project assets:

- src/assets/pieces/knights-walls-atlas.png — 4 × 4 atlas: blue, red, green, yellow columns; basic/strong/mighty knights and city-wall rows. Rank is engraved into each shield as one, two or three stars.
- src/assets/pieces/harbors-atlas.png — 3 × 2 atlas: wood, brick, wool, wheat, stone and generic trading harbors.
- src/assets/pieces/robber-painted.png — painted hooded robber with sack.
- src/assets/pieces/barbarian-ship.png — painted barbarian longship.

Final prompt set:

1. Knights/walls: polished hand-painted medieval tabletop miniatures matching the existing beige-stone/painted-roof city piece. Transparent square 4-column × 4-row atlas, columns blue/red/green/yellow. First three rows basic, strong and mighty full-body knights with one/two/three golden stars engraved into their shields; last row low crenellated city walls with matching colored roofs. Consistent camera, scale, lighting; no text, numbers or overlapping cells.
2. Harbors: transparent 3-column × 2-row atlas of hand-painted medieval docks and merchant boats. Timber/log, brick, wool/sheep, wheat-sack, stone and generic barrel/crate cargo. Consistent isometric camera and separate cells. No text, numerals, discs, sea patches or gridlines.
3. Robber final edit: retain the hooded charcoal robber carrying a tan sack, but change rendering to warm hand-painted medieval board-game illustration. Simplify fabric texture, softly painted edges and compact proportions. No photorealism or dramatic realistic 3D effect. Preserve transparency.
4. Barbarian ship: isolated hand-painted medieval longship token with brown carved hull, burgundy/charcoal striped sail, shields and oars. Elevated three-quarter side view. Compact painted game-art silhouette. Transparent background; no emoji, vector, text or numerals.

The reusable SVG wrappers clip each atlas cell. They do not modify the source PNGs. Sea frame, dice and route geometry remain code-native SVGs.
