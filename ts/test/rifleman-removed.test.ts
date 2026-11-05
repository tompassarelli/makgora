import { expect, test } from "bun:test";
import { ARCADE_CHARACTERS, ARCADE_TABLES } from "../src/game/arcade/tables";
import { HOME_STAGES } from "../src/game/menu/homeStages";
import { FIGHTER_OBJECT_ORDER } from "../src/game/objectData";
import { RIFLEMAN_MODEL_FILE } from "../src/game/presentation/fighterAssetInfo";
import { HARNESS_ONLY_FIGHTERS, PLAYABLE_CHARACTERS, RENDERED_FIGHTERS, SELECTABLE_CHARACTERS, fighterName, fighterRenderName, shipsInMap } from "../src/game/roster/kits";
import { Character } from "../src/game/sim/codes";
import { GRID_FIGHTERS } from "../src/game/ui/selectionFrames";
import { SELECT_GRID_ORDER } from "../src/game/ui/selectionLayout";
import { MAP_PORTRAITS, ORIGINAL_CLIP_MODELS, SCRIPT_MODELS } from "../scripts/wisp/mapInputs";

const RIFLEMAN = Character.rifleman;

test("The base Rifleman is on no selectable, computer, Random, Arcade or home-stage list and the map carries none of his tiles, cards, portraits, stock icons, model, clips or object data [k3 measure docs/design/roster.md]", () => {
  expect(HARNESS_ONLY_FIGHTERS).toEqual([RIFLEMAN]);
  expect(shipsInMap(RIFLEMAN)).toBe(false);
  for (const list of [SELECTABLE_CHARACTERS, PLAYABLE_CHARACTERS, RENDERED_FIGHTERS, GRID_FIGHTERS, SELECT_GRID_ORDER, ARCADE_CHARACTERS, FIGHTER_OBJECT_ORDER]) expect(list).not.toContain(RIFLEMAN);
  for (const table of ARCADE_TABLES) expect([table.ally, table.rival, ...table.elites.flatMap((duo) => duo.members)]).not.toContain(RIFLEMAN);
  expect(HOME_STAGES.map((home) => home.character)).not.toContain(RIFLEMAN);
  expect([...SCRIPT_MODELS, ...ORIGINAL_CLIP_MODELS, ...MAP_PORTRAITS].filter((path) => path.toLowerCase().includes(fighterRenderName(RIFLEMAN).toLowerCase()))).toEqual([]);
  expect(SCRIPT_MODELS).not.toContain(RIFLEMAN_MODEL_FILE);
  expect(fighterName(RIFLEMAN)).toBe("Rifleman");
});
