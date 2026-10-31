import { NATIVE_DRIVER_BUILD } from "../../game/session/currentBuild";
import { install as installGame, startBuild } from "../../platform/main";
import { installSmashcraftNativeDriver, startSmashcraftNativeDriver } from "../../platform/nativeDriver";
import { on, trampoline } from "wisp/src/platform/dispatch";
import { f32 } from "wisp/src/sim/f32";
import { type CaptureFixture, showcaseFixtures } from "../../platform/captureFixtures";
import { captureTick, restartCapture } from "../loop/captureRunner";
import { shellState } from "../loop/state";
import { createTimer, startTimer } from "wisp/game/clock";

const TICK = "showcase.demo";

declare global { var __smashcraftShowcaseDemo: readonly CaptureFixture[] | undefined; }

function tick(): void {
  const s = shellState();
  if (s === undefined) return;
  if (s.showcaseDemo !== undefined) {
    globalThis.__smashcraftShowcaseDemo = showcaseFixtures(s.showcaseDemo);
    s.showcaseDemo = undefined;
    restartCapture();
  }
  const demo = globalThis.__smashcraftShowcaseDemo;
  if (demo !== undefined) captureTick(demo);
}

export function install(this: void): void {
  installGame(NATIVE_DRIVER_BUILD);
  installSmashcraftNativeDriver();
  on(TICK, tick);
}

export function start(this: void): void {
  startBuild(NATIVE_DRIVER_BUILD);
  installSmashcraftNativeDriver();
  startSmashcraftNativeDriver([0]);
  on(TICK, tick);
  startTimer(createTimer(), f32(0.01666666753590107), true, trampoline(TICK));
}
