import { INTEGRITY_BUILD } from "../../game/session/currentBuild";
import { startBuild } from "../../platform/main";
import { startMatchFrameMeter } from "../../platform/frameMeter";
import { startMatchSceneReport } from "../../platform/sceneReport";

export { install } from "./integrityMain";

export function start(this: void): void {
  startBuild({ ...INTEGRITY_BUILD, pausePositionProbe: true }, startMatchSceneReport);
  startMatchFrameMeter();
}
