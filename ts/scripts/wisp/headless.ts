



import type { HeadlessMap } from "wisp/scripts/wisp/headless";
import { PREDICTED_LOCAL_NATIVES, MAKGORA_LOCAL_NATIVES } from "./localNatives";
import { UI_FRAMES } from "./uiFrames";
import { MAKGORA_NOOPS, makgoraNativeBehavior } from "./headlessNatives";


const MAKGORA_DAMAGE_TEMPLATE = {
  name: "SmashcraftDamage", type: "TEXT", width: 0, height: 0, text: "0.0%", children: [],
  font: { file: "MasterFont", size: 0.036, flags: 1 }, justify: { horizontal: "LEFT", vertical: "MIDDLE" },
} as const;

const MAKGORA_DAMAGE_OUTLINE_TEMPLATE = {
  ...MAKGORA_DAMAGE_TEMPLATE, name: "SmashcraftDamageOutline", text: "0", font: { file: "MasterFont", size: 0.036, flags: 0 },
} as const;

export const MAKGORA_HEADLESS: HeadlessMap = {
  filePrefix: "smashcraft",
  globalPrefixes: ["__smashcraft"],
  localNatives: MAKGORA_LOCAL_NATIVES,
  intentionalNoops: MAKGORA_NOOPS,
  natives: makgoraNativeBehavior,
  frames: [...UI_FRAMES.map(({ definition }) => definition), MAKGORA_DAMAGE_TEMPLATE, MAKGORA_DAMAGE_OUTLINE_TEMPLATE],
};


export const PREDICTED_HEADLESS: HeadlessMap = { ...MAKGORA_HEADLESS, localNatives: PREDICTED_LOCAL_NATIVES };
