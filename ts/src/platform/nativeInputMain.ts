

import type { MapBuild } from "../game/session/build";
import { PLAYABLE_BUILD } from "../game/session/currentBuild";
import { install as installGame, startBuild } from "./main";

const NATIVE_INPUT_BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-native-input", responseProbe: true, epochProbe: true, devConsole: true };

export function install(this: void): void {
  installGame(NATIVE_INPUT_BUILD);
}

export function start(this: void): void {
  startBuild(NATIVE_INPUT_BUILD);
}
