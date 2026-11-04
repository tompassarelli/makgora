import type { StandaloneGame } from "wisp/scripts/wisp/standalone";
import { DIZZY_MODEL } from "../../src/host/loop/fighterBody";
import { preloadFighterModels, preloadFighterTextures } from "../../src/game/render/fighterPreload";
import { preloadMatchModels } from "../../src/game/render/matchPreload";
import { preloadHudTextures } from "../../src/game/ui/hudPreload";
import { preloadMenuTextures } from "../../src/game/ui/menuPreload";
import { SELECTABLE_CHARACTERS } from "../../src/game/roster/kits";
import { cueModels } from "./cueModels";
import { preloadModels, preloadSkies } from "../../src/game/presentation/stagePreload";
import { createNetStandalone, makgoraMapHash } from "./net";
import { createStandaloneSession } from "./standalone";

/** Every model and interface image a match can show on any selectable stage with any selectable fighter, so the native window reads them in, and remasters them, while the player is in the menus. */
export const standalonePreload = () => ({
  preloadModels: [...new Set([DIZZY_MODEL, ...preloadFighterModels(), ...preloadModels(), ...preloadSkies(), ...preloadMatchModels(), ...cueModels(SELECTABLE_CHARACTERS)])],
  preloadTextures: [...new Set([...preloadHudTextures(), ...preloadMenuTextures(), ...preloadFighterTextures()])],
});

export const makgoraStandalone = (render: StandaloneGame["render"]): StandaloneGame => ({
  title: "Mak'gora",
  render: { ...render, ...standalonePreload() },
  create: createStandaloneSession,
  net: { mapHash: makgoraMapHash, create: createNetStandalone },
});
