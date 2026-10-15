import { SOAK_INTEGRITY_BUILD } from "../../game/session/currentBuild";
import { install as installGame, startBuild } from "../../platform/main";
import { installSoakHandles } from "../../platform/soakHandles";

export function install(this: void): void {
  installSoakHandles();
  installGame(SOAK_INTEGRITY_BUILD);
}

export function start(this: void): void {
  globalThis.__smashcraftNativeSoak = undefined;
  globalThis.__smashcraftNativeSoakStart = true;
  installSoakHandles();
  startBuild(SOAK_INTEGRITY_BUILD);
}
