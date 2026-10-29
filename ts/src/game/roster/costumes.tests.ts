import { assertEquals, test } from "wisp/src/runtime/testing";
import { copyMatchState, costumeFor, createMatchState, cycleCostume, selectCharacter } from "../lobby/lobbyState";
import { Character } from "../sim/codes";
import { costumeClipModel, costumesFor } from "./costumes";
import { costumeBody } from "../../generated/costumes/costumeBodies";
import { originalClip } from "../../generated/clips/fighterOriginalClipInfo";

test("cycling costumes wraps, stays with its own card, and resets with a new fighter [k2 property]", () => {
  const game = createMatchState();
  game.humanMask = 3;
  game.humanFighterMask = 3;
  game.computerMask = 0;
  selectCharacter(game, 0, Character.grom);
  selectCharacter(game, 1, Character.grom);
  cycleCostume(game, 0, 0, 1);
  cycleCostume(game, 0, 0, 1);
  assertEquals(costumeFor(game, 0), 2);
  assertEquals(costumeFor(game, 1), 0);
  cycleCostume(game, 1, 0, 1);
  assertEquals(costumeFor(game, 0), 2);
  for (let step = 0; step < 3; step++) cycleCostume(game, 0, 0, -1);
  assertEquals(costumeFor(game, 0), costumesFor(Character.grom).length - 1);
  const copy = createMatchState();
  copyMatchState(copy, game);
  assertEquals(copy.costumeChoices[0], game.costumeChoices[0]);
  selectCharacter(game, 0, Character.rifleman);
  assertEquals(costumeFor(game, 0), 0);
});

test("a skinned costume draws its fighter's timeline clips on its own body at the clips' times, and an unskinned one on the shared body [k2 property]", () => {
  const costumes = costumesFor(Character.grom);
  const fel = costumes.findIndex(costume => costume.skin !== undefined);
  const tinted = costumes.findIndex(costume => costume.tint !== undefined);
  const clip = originalClip(Character.grom, 0);
  if (clip === undefined || fel < 0 || tinted < 0) throw new Error("Grom needs a timeline clip, a skinned costume and a tinted one");
  const body = costumeBody(Character.grom, fel);
  if (body === undefined) throw new Error("Grom's skinned costume has no generated body");
  assertEquals(costumeClipModel(Character.grom, fel, clip), body);
  assertEquals(costumeClipModel(Character.grom, tinted, clip), clip.modelPath);
  assertEquals(costumeClipModel(Character.grom, 0, clip), clip.modelPath);
});
