import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { copyMatchState, costumeFor, createMatchState, cycleCostume, selectCharacter } from "../lobby/lobbyState";
import { Character, DuoRole } from "../sim/codes";
import { bodyCostume, bodyVariants, costumeClipModel, costumesFor, partnerLook } from "./costumes";
import { f32 } from "wisp/src/sim/f32";
import { PARTNER_COSTUME } from "../presentation/model/costume";
import { fighterPortrait, portraitCostumes } from "./looks";
import { costumeSkins as murlocSkins } from "../../generated/fighter-art/murloc";
import { PORTRAIT_KINDS } from "./kits";
import { PARTICIPANT_SLOTS } from "../input/participants";
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
  const green = costumes.findIndex(costume => costume.skin === undefined && costume.tint === undefined);
  assertEquals(costumeClipModel(Character.grom, green, clip), clip.modelPath);
});

test("Grom's default costume is Fel: costume 0 draws the fel body, KO body and fel renders, and the green look is his first alternate [k2 property]", () => {
  const [fel, green] = costumesFor(Character.grom);
  assertEquals(fel?.name, "Fel");
  assertEquals(fel?.skin?.textures["Units\\Orc\\Hellscream\\Hellscream.blp"], "Textures\\HellscreamChaos.blp");
  assertEquals(green?.skin, undefined);
  assertEquals(green?.tint, undefined);
  const clip = originalClip(Character.grom, 0);
  if (clip === undefined) throw new Error("Grom needs a timeline clip");
  assertEquals(costumeClipModel(Character.grom, 0, clip), costumeBody(Character.grom, 0));
  assertEquals(bodyCostume(Character.grom, 0), 0);
  assertEquals(bodyCostume(Character.grom, 1), 1);
  assertEquals(bodyCostume(Character.grom, 2), 1);
  assertEquals(bodyVariants([Character.grom]).map(variant => variant.costume).join(","), "0,1");
  for (const kind of PORTRAIT_KINDS) for (const slot of [...(kind === "Tile" ? [undefined] : []), ...PARTICIPANT_SLOTS]) {
    const suffix = slot === undefined ? "" : `P${slot + 1}`;
    assertEquals(fighterPortrait(Character.grom, kind, slot, 0), `war3mapImported\\Fighter${kind}GromHellscreamFel${suffix}.blp`);
    assertEquals(fighterPortrait(Character.grom, kind, slot, 1), `war3mapImported\\Fighter${kind}GromHellscream${suffix}.blp`);
  }
});

test("Murloc's partner look draws Grgl on his own timeline body at the leader's scale, the leader on the shared one, and the KO pool holds both [k2 property]", () => {
  const clip = originalClip(Character.murloc, 0);
  const partner = partnerLook(Character.murloc, DuoRole.partner);
  if (clip === undefined || partner === undefined) throw new Error("Murloc needs a timeline clip and a partner look");
  const body = costumeBody(Character.murloc, PARTNER_COSTUME);
  if (body === undefined) throw new Error("Murloc's partner look has no generated body");
  assertEquals(costumeClipModel(Character.murloc, PARTNER_COSTUME, clip), body);
  assertEquals(costumeClipModel(Character.murloc, 0, clip), costumeBody(Character.murloc, 0));
  assertTrue(costumeClipModel(Character.murloc, 0, clip) !== body);
  assertEquals(partner.scale, f32(1.0));
  assertEquals(partnerLook(Character.murloc, DuoRole.leader), undefined);
  assertEquals(bodyVariants([Character.murloc]).map(variant => variant.costume).join(","), `0,${PARTNER_COSTUME}`);
});

test("Mrgl wears the green MurlocMutant skin and Grgl the red-brown MurlocWarrior skin, in the look, the generated skins and the bodies [k1 scenario]", () => {
  const stock = "Units\\Creeps\\Murloc\\Murloc.blp";
  const green = "Units\\Creeps\\MurlocMutant\\MurlocMutant.blp";
  const red = "Units\\Creeps\\MurlocWarrior\\MurlocWarrior.blp";
  const partner = partnerLook(Character.murloc, DuoRole.partner);
  assertEquals(partner?.skin.textures[stock], red);
  const leaders = costumesFor(Character.murloc);
  for (const costume of leaders) assertEquals(costume.skin?.textures[stock], green);
  const generated = new Map(murlocSkins.map(skin => [skin.index, skin.textures[stock]]));
  assertEquals(generated.get(0), green);
  assertEquals(generated.get(PARTNER_COSTUME), red);
  const leaderBody = costumeBody(Character.murloc, 0);
  const partnerBody = costumeBody(Character.murloc, PARTNER_COSTUME);
  assertEquals(leaderBody === undefined || partnerBody === undefined || leaderBody === partnerBody, false);
  for (let costume = 1; costume < leaders.length; costume++) assertEquals(costumeBody(Character.murloc, costume), leaderBody);
  assertEquals(portraitCostumes(Character.murloc).join(","), "0");
});
