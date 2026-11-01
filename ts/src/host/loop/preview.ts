

import { DEFAULT_FIGHTER } from "../../game/roster/kits";
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { characterFor, fighterMask } from "../../game/lobby/lobbyState";
import { matchSpawnX } from "../../game/match/step";
import { Character } from "../../game/sim/codes";
import { createFighter } from "../../game/sim/fighter";
import { clearDamageContacts } from "../../game/sim/contacts";
import { copyControls, isActive, neutralControls, setRosterMask } from "../../game/sim/roster";
import { createFighterBody, removeFighterBody } from "./fighterBody";
import { clearAllInputs } from "./inputs";
import type { ShellState } from "./state";
import { localPreview } from "./keyboardPreview";
import { endFighter, layoutHuds, views } from "./ui";
import { player } from "wisp/game/players";
import { setBodyAnimation } from "wisp/game/bodies";

const NEUTRAL = neutralControls();


function removeFighters(s: ShellState): void {
  clearDamageContacts();
  for (const slot of PARTICIPANT_SLOTS) {
    const participant = s.participants[slot];
    endFighter(s, slot);
    participant.pooled = false;
    if (participant.body === undefined) continue;
    removeFighterBody(participant.body);
    participant.body = undefined;
    s.world.fighters[slot] = undefined;
  }
  const ui = views(s);
  ui.frost.clear();
  ui.stance.clear();
  ui.placed.clear();
  ui.special.clear();
  ui.elements.clear();
  ui.combat.clear();
}


export function makePreview(s: ShellState): void {
  clearAllInputs(s);
  removeFighters(s);
  for (const slot of PARTICIPANT_SLOTS) copyControls(s.produced.inputs[slot], NEUTRAL);
  setRosterMask(s.world, fighterMask(s.game));
  layoutHuds(s, localPreview(s));
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(s.world, slot)) continue;
    const x = matchSpawnX(slot, s.world.mask);
    const fighter = createFighter(characterFor(s.game, slot) ?? DEFAULT_FIGHTER, x, x < 0 ? 1 : -1);
    s.world.fighters[slot] = fighter;
    const body = createFighterBody(player(slot), fighter, s.origin);
    s.participants[slot].body = body;
    setBodyAnimation(body.unit, "stand");
  }
}
