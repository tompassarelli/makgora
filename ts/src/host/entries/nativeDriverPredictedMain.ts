import type { MapBuild } from "../../game/session/build";
import { NATIVE_DRIVER_BUILD } from "../../game/session/currentBuild";
import { install as installGame, startBuild } from "../../platform/main";
import { installSmashcraftNativeDriver, startSmashcraftNativeDriver } from "../../platform/nativeDriver";

const BUILD: MapBuild = { ...NATIVE_DRIVER_BUILD, id: "typescript-native-driver-predicted", presentation: "pool-predicted" };

export function install(this: void): void {
  installGame(BUILD);
  installSmashcraftNativeDriver();
}

export function start(this: void): void {
  startBuild(BUILD);
  installSmashcraftNativeDriver();
  startSmashcraftNativeDriver();
}
