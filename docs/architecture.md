# Architecture: where code lives

Place a change by its noun (fighter, stage, sound, state field, verb, key, record): find its row below and edit only there.
Paths are repo-relative; `<fighter>` is the camelCase hero name (`cairne`, `mountainKing`), `<verb>` a `bun wisp` verb.
The tables say where things are today; "moves in Sn" names the migration slice that relocates it (see the last section).

## Modules and import direction

A module may import only the modules in its "may use" column. Sim code never reaches up into presentation, render, ui or host.

| module | today | responsibility | may use |
|---|---|---|---|
| core | `ts/src/game/sim/codes.ts`, `sim/mathTables.ts`, `sim/warcraftMath.ts` | Ids (`Character`), state codes, number helpers, trig tables | Wisp num/runtime |
| input | `ts/src/game/input/` | Action vocabulary, key bindings, pad packet decode, wire; owns the controller contract | core |
| sim | `ts/src/game/sim/` (geometry helpers in `sim/geometry/`) | Deterministic per-frame simulation; no natives, no presentation | core |
| fighter-kit | `ts/src/game/fighters/<slug>/` (`kit.ts`, `moves.ts`, `specials.ts`), shared helpers in `ts/src/game/sim/heroes/` | One fighter's gameplay data and special hooks | sim, core |
| snapshot | `ts/src/game/replay/{canonical,fighterState,difference,history,snapshot}.ts` | Canonical text, state hash, copy/compare/diff, rollback ring | sim, core |
| ai | `ts/src/game/match/bot*.ts`, `match/cpu*.ts`, `fighters/<slug>/gameplan.ts` | Bots, perception, gameplans, edge-guard scenarios | sim, snapshot, input, core |
| roster | `ts/src/game/roster/kits.ts`, `menu/stageCatalog.ts` | The only all-fighter and all-stage lists | fighter-kit, ai, core |
| lobby | `ts/src/game/lobby/lobbyState.ts`, `ts/src/game/menu/` | Slots, humans/CPU, character/stage select, teams, stock/timer choice | roster, core |
| match | `ts/src/game/match/` | Match step, stocks/teams/meter rules, training | sim, snapshot, ai, roster, lobby, input, core |
| replay | `ts/src/game/replay/` (tapes, moments, viewer) | Replay files, tapes, moments, viewer driver | match, snapshot, sim, input, core |
| netcode | `ts/src/game/netcode/` | Delay policy, input journals | input, snapshot, match, core |
| fighter-look | `ts/src/game/fighters/<slug>/` (`look.ts`, `clips.ts`), `ts/src/game/presentation/model/` | One fighter's model, clips, cues, sounds, scale, labels | presentation types, fighter-kit (read numbers, never restate), generated art, core |
| presentation | `ts/src/game/presentation/` | Pose/clip choice, cue and sound selection; pure, no natives | fighter-look, roster, match, sim, snapshot, core |
| render | `ts/src/game/render/` | Warcraft-native effects and sound playback | presentation, sim, core, Wisp map |
| ui | `ts/src/game/ui/`, `ts/src/game/menu/` | Frames, menus, selection screens | lobby, roster, render, presentation, core |
| session | `ts/src/game/session/` | Session, playback, dev settings, match record writer | match, replay, lobby, ui, netcode, presentation, render, roster, core |
| classic | `ts/src/game/classic/` | Classic mode routes and lore battles | session, match, lobby, roster, core |
| host | `ts/src/platform/` (`*Main.ts` entries, `shell/` live loop) | Map entry points; view, keys, rollback tick | everything above, Wisp map |

Known breaks still in the tree (removed by slices, never copied): `fighters/*/kit.ts` importing generated clips (S5), sim importing `input/participants.ts` (S12), `sim/testDuel.ts` importing match (S9).

## Where things live

| change | edit today | target |
|---|---|---|
| Frame data, hitbox or hurtbox of a normal | `ts/src/game/fighters/<slug>/moves.ts` (shared rows: `ts/src/game/sim/heroes/groundNormals.ts`) | done in S8 |
| A special move's data | `ts/src/game/fighters/<slug>/specials.ts` | done in S8 |
| Special engine, types, per-fighter branches | `ts/src/game/sim/specials/engine.ts`, `ts/src/game/sim/specials/schema.ts`, `ts/src/game/sim/specials.ts` | `sim/specials/` in S9c; branches become kit hooks in S13 |
| Ultimate | `ts/src/game/sim/ultimates.ts` | `fighters/<slug>/ultimate.ts` in S7b |
| Fighter body, strong hits, identity traits | `ts/src/game/sim/heroes/heroBodies.ts`, `ts/src/game/sim/strongHitTable.ts`, `ts/src/game/sim/identityTraits.ts` | `fighters/<slug>/kit.ts` in S7c |
| Fighter definition (name, kit wiring) | `ts/src/game/fighters/<slug>/kit.ts` | done in S8 |
| New fighter: id and roster line | `ts/src/game/sim/codes.ts`, `ts/src/game/roster/kits.ts` | `core/codes.ts`, `roster/*.ts` in S8 |
| Fighter model, scale, clip binding | `ts/src/game/fighters/<slug>/look.ts` (type `HeroLook` in `ts/src/game/presentation/model/look.ts`, read by character through `heroLook` in `ts/src/game/roster/looks.ts`), `ts/src/game/presentation/modelScale.ts`, `ts/src/game/presentation/fighterClips.ts` | `fighters/<slug>/look.ts` in S7e |
| Selection label, short name | `ts/src/game/ui/selectionUi.ts` | `fighters/<slug>/look.ts` in S7e |
| Animation clip | producer `tools/animations/<fighter>-clips.ts` (writes e.g. `ts/src/game/fighters/cairne/clips.ts`) | output under `ts/src/generated/clips/` in S6a |
| Special/attack/disjoint cue, projectile art | `ts/src/game/presentation/specialCues.ts`, `ts/src/game/presentation/attackCues.ts`, `ts/src/game/presentation/disjointCues.ts`, `ts/src/game/presentation/projectileArt.ts` | `fighters/<slug>/cues.ts` in S7a |
| A move's sound | `ts/src/game/presentation/moveSounds.ts` | `fighters/<slug>/sounds.ts` in S7d |
| Warcry, victory, stage music, hurt voice | `ts/src/game/presentation/matchAudio.ts`, `ts/src/game/presentation/hurtVoice.ts` | `fighters/<slug>/sounds.ts` in S7d |
| Sound tier and cue selection; playback | `ts/src/game/presentation/moveTiers.ts`; `ts/src/game/render/soundBank.ts` | `presentation/sound/`; stays in render |
| Stock sound paths (generated) | producer `tools/presentation/stock-sounds.ts` (writes `ts/src/generated/assets/stockSoundInfo.ts`) | same path (S6b done) |
| Bot gameplan for one fighter | `ts/src/game/fighters/<slug>/gameplan.ts` | done in S8 |
| Bot habit, edge-guard scenario | `ts/src/game/match/botHabits.ts`, `ts/src/game/match/edgeGuardScenarios.ts` | scenarios to `gameplan.ts` in S7f |
| Stage deck geometry, surfaces | `ts/src/game/sim/stage.ts` | `stages/<slug>/deck.ts` (no slice yet) |
| Stage hazard | `ts/src/game/sim/stageHazards.ts` | `stages/<slug>/deck.ts` (no slice yet) |
| New stage: id and catalog line | `ts/src/game/menu/stageCatalog.ts` | `roster/stages.ts` |
| Stage lighting, palette, lights, scenery | `ts/src/game/assets/stageLighting.ts`, `ts/src/game/assets/stagePalette.ts`, `ts/src/game/assets/stagePointLights.ts`, `ts/src/game/presentation/stageScenery.ts` | `stages/<slug>/look.ts` |
| New Fighter state field | `ts/src/game/sim/fighter.ts` (interface, `createFighter`), a row in `ts/src/game/sim/state/fighterSchema.ts` (copy, compare, canonical text and state hash, first-difference name with its place in `FIGHTER_DIFF_ORDER`, blast and respawn reset, then `bun run generate`) | one row in `sim/state/fighterSchema.ts` after S1a-S1d |
| Match step, stocks, training | `ts/src/game/match/step.ts`, `ts/src/game/match/training.ts` | stays |
| Lobby option (stock, timer, teams, stage pool) | `ts/src/game/lobby/lobbyState.ts`, `ts/src/game/menu/stagePool.ts` | `lobby/` in S9b |
| Menu or HUD frame | `ts/src/game/ui/` | stays |
| Controller action or key | `ts/src/game/input/actions.ts`, `ts/src/game/input/keyBindings.ts` | publishes `contracts/controller.json` in K1 |
| Pad packet, stick thresholds | `ts/src/game/input/padCapture.ts`, `ts/src/game/sim/stickZones.ts`; plug-in `controller/src/main.rs` | plug-in reads `contracts/controller.json` in K1 |
| `bun wisp` verb | `ts/scripts/wisp/commands/<verb>.ts` plus its line in `ts/scripts/wisp.ts`; help page `docs/commands/<verb>.md` | one file `ts/commands/<verb>.ts` in S2 |
| Map entry point, live view loop | `ts/src/host/entries/`, `ts/src/host/loop/view.ts` | stays |
| Session, playback, dev settings | `ts/src/game/session/` | stays |
| Lua cost baseline row | `records/lua-cost/<test path>.tsv`, one file per test | stays |
| Advantage-state report | `tools/move-data/advantage-state.jsonl` (autoland regenerates it) | `records/` in S11 |
| Client kit contract | `ts/scripts/clientKit.ts` | kit 2 in C2 |
| A Wisp import | `wisp/src/...` deep paths today | declared `wisp/*` exports in W18s |

Tests sit beside their code as `*.tests.ts`; host tests are `ts/test/*.test.ts`.

## Generated files

A generated file starts with `Generated by <producer>; regenerate instead of editing.` Change the producer and rerun it; never hand-edit the output.
Today they sit beside hand code (`ts/src/game/assets/*Info.ts`, `ts/src/game/presentation/*ClipInfo.ts`, some `fighters/<slug>/clips.ts` and `fighters/<slug>/clipInfo.ts`); S6a-c move them all under `ts/src/generated/<family>/` (host-only output under `ts/generated/`).
Gate baselines merge row by row through `ts/scripts/mergeGenerated.ts` (`.gitattributes`).

## Target layout

- `ts/src/game/fighters/<slug>/`: `kit.ts`, `moves.ts`, `specials.ts`, `ultimate.ts`, `gameplan.ts`, `look.ts`, `cues.ts`, `sounds.ts` and that fighter's tests. A fighter tweak edits one or two files here and nothing shared.
- `ts/src/game/stages/<slug>/{deck,look}.ts`; `roster/` is the only place a new fighter or stage adds a line.
- `core/`, `input/`, `sim/` (with `sim/state/fighterSchema.ts`, `sim/specials/`, `sim/geometry/`), `snapshot/`, `ai/`, `lobby/`, `match/`, `replay/`, `netcode/`, `presentation/`, `render/`, `ui/`, `session/`, `classic/`, `host/`.
- Engine files keep types and logic and hold no `Character.x` key or `character ===` branch; per-fighter behaviour is a named hook on the kit, look or gameplan.
- A number lives where gameplay reads it; looks read it from the kit.
- `ts/commands/<verb>.ts` (one file per verb), `ts/codegen/` (code producers, `bun run generate`), `records/` (measured outputs, one producer each).

## Migration order

Each slice moves files and every importer in one commit, with no re-export shims.

1. Wave 0: S0 (structure.toml gate), S1a (fighter state schema, copy/same), S2 (verbs without a hub), S4 (sharded Lua cost baseline).
2. Wave 1: S1b-S1e (state text/hash, diff/respawn, interfaces, hashed blind spots), S5 (Kit/Look split), S6a-c (generated tree).
3. Wave 2: S8 (fighter folders), S7a-f (shared-table rows into fighter files), S13a-e (per-character branches to hooks).
4. Wave 3: S9a-g, S10a-c, S11, S12, S14 (renames, script directories, records, slots, view split).
5. Cross-repo: K1 (controller contract) then padbridge P1-P3 and client C1-C3; Wisp box 18 then W18s (declared imports).
