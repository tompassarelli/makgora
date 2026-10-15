import { INTEGRITY_BUILD } from "../../game/session/currentBuild";
import { install as installGame, startBuild } from "../../platform/main";
import { installFrameMeter, startMatchFrameMeter } from "../../platform/frameMeter";
import { installSceneReport, startMatchSceneReport } from "../../platform/sceneReport";
import { installSoakHandles } from "../../platform/soakHandles";

export function install(this: void): void {
  installSoakHandles();
  installGame();
  installSceneReport();
  installFrameMeter();
}


export function start(this: void): void {
  globalThis.__smashcraftNativeSoak = undefined;
  installSoakHandles();
  startBuild(INTEGRITY_BUILD);
  startMatchSceneReport();
  startMatchFrameMeter();
}
