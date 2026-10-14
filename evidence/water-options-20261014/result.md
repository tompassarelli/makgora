# Warcraft III 3.0 water options and Smashcraft's below-stage water (#277, #563 row 7)

Tom asked (0.0.192 playtest) whether Smashcraft uses the game's own water and
3.0's HD water options, and whether anyone compared them. Nobody had. This is
what is known on 14 Oct 2026, from desk sources and the repository; no native
capture was taken (no capture host today).

## What 3.0 added

Patch 3.0.0 notes (https://liquipedia.net/warcraft/Patch_3.0.0):
"Improved water for HD"; options "Added new options for Point Light Shadows,
Water and Supersampling"; World Editor "New HD water", "Added water doodad in
HD", "Live editing of fog and HD water settings". Nothing in the notes changes
Classic water.

| Lever | Who sets it | Modes | Notes |
| --- | --- | --- | --- |
| Options > Water (`waterquality` in the client preferences) | the player only | HD (Reforged, Definitive) | A map cannot turn it on. Wisp's capture profiles set `waterquality=2` (smashcraft:docs/design/visual-quality.md, "Player options are the player's"). |
| `SetHDWaterParams` / `SetHDWaterParamsEx` (colour, override, vertex displacement, min/max opacity, reflectivity, emissivity, edge softness, wave strength, env-map strength) | map script; the editor's live HD water settings write it into `main` | HD | Declared in Wisp's natives (warcraft.d.ts 3176-3177); unused by Smashcraft. |
| `BlzSetHDWaterColor`, `...ColorOverride`, `...VertexDisplacement`, `...MinOpacity`, `...MaxOpacity`, `...Reflectivity`, `...Emissivity`, `...EdgeSoftness`, `...WaveStrength`, `...EnvMapStrength` | map script | HD | Per-field forms of the above; unused. |
| `SetWaterBaseColor(r, g, b, a)` (1.07) | map script | all; in HD the alpha affects only the surface | The only lever Classic has. |
| `SetWaterDeforms` | map script | all | Ripples from units; irrelevant for a sea far below the arena. |
| HD water doodad | World Editor object data | HD | A placed doodad, not terrain; unmeasured. |

All of these act on terrain water: water draws only where the map's
`war3map.w3e` has water (smashcraft:docs/design/warcraft-features.md, "HD
water"). Classic graphics use none of the HD controls; only the base colour.

## What Smashcraft draws today

- No stage uses terrain water. The shell hides terrain on every stage
  (`BlzShowTerrain(false)`, smashcraft:ts/src/platform/shell/stageScenery.ts),
  so none of the levers above can show.
- Every sea is an imported model: since 713f4f89bb the eight sea floors draw
  Tomb of Sargeras's sea model (StageTombSea), which replaced the stretched
  StageSea plane Tom saw as "squiggly lines"; Tomb keeps its own tide water.
- The one native attempt, f1c2a515e9 (whole map deep water at level 500 over
  ground 0, terrain shown on water stages, tinted with SetWaterBaseColor), was
  reverted in c61bd1bd56: natively it lost the fighters and the deck. One
  named cause, worldOrigin() reading GetLocationZ at the map centre, is fixed
  in this landing (the arena origin is FLOOR_HEIGHT outright,
  smashcraft:ts/test/world-origin.test.ts). Whether flying units' fly height
  is measured from the water surface over deep water is still unmeasured; the
  native capture of the native-water candidate decides it.

## Not yet measured (needs the batched native capture)

- Native terrain water vs StageTombSea per water stage, at gameplay zoom, in
  Classic and Definitive (HD water parameters at the tileset's defaults).
- Whether `BlzShowTerrain(false)` also hides terrain water.
- Wisp's headless renderer does not draw terrain water (visual-quality.md,
  "Water and height-fog falloff still require native captures"), so no Wisp
  render can stand in for these.
