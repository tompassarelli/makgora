

import { CURRENT_BUILD } from "../../game/session/currentBuild";
import { install as installGame, startBuild } from "../../platform/main";
import { installFrameMeter, startMatchFrameMeter } from "../../platform/frameMeter";
import { installSceneReport, startMatchSceneReport } from "../../platform/sceneReport";

export function install(this: void): void {
  installGame();
  installSceneReport();
  installFrameMeter();
}

export function start(this: void): void {
  startBuild(CURRENT_BUILD, startMatchSceneReport);
  startMatchFrameMeter();
}
