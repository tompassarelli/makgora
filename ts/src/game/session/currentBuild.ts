






import type { MapBuild } from "./build";

export const INTEGRITY_BUILD: MapBuild = {
  id: "typescript-integrity",
  inputProfile: "shadow-d2-r7",
  input: { kind: "journal", ingress: "editbox", delay: 2, rollback: 7 },
  presentation: "pool-predicted",
  scenario: "normal",
  responseProbe: true,
  devConsole: true,
  errorsOnScreen: true,
  receiptsOnScreen: true,
  disjointCues: true,
  hotReload: true,
};

export const PLAYABLE_BUILD: MapBuild = {
  id: "playable-0047",
  inputProfile: "keyboard-d2-r7",
  input: { kind: "keyboard", pairedSends: true, delay: 2, rollback: 7 },
  presentation: "pool-predicted",
  scenario: "normal",
  responseProbe: false,
  devConsole: false,
  errorsOnScreen: false,
  receiptsOnScreen: true,
  disjointCues: true,
  hotReload: false,
};

export const CURRENT_BUILD: MapBuild = {
  id: "typescript-dev",
  inputProfile: "callback",
  input: { kind: "callback" },
  presentation: "pool-confirmed",
  scenario: "normal",
  responseProbe: false,
  devConsole: true,
  errorsOnScreen: true,
  receiptsOnScreen: true,
  disjointCues: true,
  hotReload: true,
};


export const NATIVE_DRIVER_BUILD: MapBuild = { ...CURRENT_BUILD, id: "typescript-native-driver", inputProfile: "native-driver", presentation: "native", hotReload: false };

export const PLAYABLE_SINGLE_SENDS_BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "playable-single-sends", input: { kind: "keyboard", pairedSends: false, delay: 2, rollback: 7 } };

export const SOAK_PLAYABLE_BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "soak-playable", inputProfile: INTEGRITY_BUILD.inputProfile, input: INTEGRITY_BUILD.input };
export const SOAK_INTEGRITY_BUILD: MapBuild = { ...INTEGRITY_BUILD, id: "soak-integrity" };
