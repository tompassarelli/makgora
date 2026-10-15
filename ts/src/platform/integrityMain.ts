import { INTEGRITY_BUILD } from "../game/session/currentBuild";
import { install as installGame, startBuild } from "./main";
import { installFrameMeter, startMatchFrameMeter } from "./frameMeter";
import { installSceneReport, startMatchSceneReport } from "./sceneReport";
import { installSoakHandles } from "./soakHandles";

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
