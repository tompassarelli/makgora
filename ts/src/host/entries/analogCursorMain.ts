import { PLAYABLE_BUILD } from "../../game/session/currentBuild";
import { install as installGame, startBuild } from "../../platform/main";
import type { MapBuild } from "../../game/session/build";

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-analog-cursor", analogPad: "cursor", analogPadDiagnostic: true, responseProbe: true, devConsole: true };

export function install(this: void): void { installGame(BUILD); }
export function start(this: void): void { startBuild(BUILD); }
