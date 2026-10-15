import { NATIVE_DRIVER_BUILD } from "../../game/session/currentBuild";
import { install as installGame, startBuild } from "../../platform/main";
import { installSmashcraftNativeDriver, startSmashcraftNativeDriver } from "../../platform/nativeDriver";

export function install(this: void): void {
  installGame(NATIVE_DRIVER_BUILD);
  installSmashcraftNativeDriver();
}

export function start(this: void): void {
  startBuild(NATIVE_DRIVER_BUILD);
  installSmashcraftNativeDriver();
  startSmashcraftNativeDriver();
}
