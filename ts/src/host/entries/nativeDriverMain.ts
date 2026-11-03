import { NATIVE_DRIVER_BUILD } from "../../game/session/currentBuild";
import { install as installGame, startBuild } from "../../platform/main";
import { installMakgoraNativeDriver, startMakgoraNativeDriver } from "../../platform/nativeDriver";

export function install(this: void): void {
  installGame(NATIVE_DRIVER_BUILD);
  installMakgoraNativeDriver();
}

export function start(this: void): void {
  startBuild(NATIVE_DRIVER_BUILD);
  installMakgoraNativeDriver();
  startMakgoraNativeDriver();
}
