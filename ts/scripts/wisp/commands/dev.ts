



import { join } from "node:path";
import { type DevProject, makeDev } from "wisp/scripts/wisp/commands/dev";
import { ISOLATED_TEST_GROUPS, TEST_TIMEOUT_MS, TEST_WORKER_ENV, testWorkerEnvironment } from "../../testWorkers";
import { buildProject, sourceMapDirectory, tsDirectory } from "../project";

export const SMASHCRAFT_DEV: DevProject = {
  root: tsDirectory,
  sources: ["src", "scripts", "test"],
  typeCheck: { projects: ["tsconfig.json", "tsconfig.game.json"], command: [process.execPath, "run", "check"] },
  tests: {

    files: ["{src,scripts,test}/**/*{.test,_test,.spec,_spec}.{js,jsx,ts,tsx}"],
    registry: "src/**/*.tests.ts",
    registryRunners: ["test/game.test.ts"],
    preload: ["test/host-natives.ts"],
    reads: {
      "scripts/greenBuilds.test.ts": [],
      "test/advantage-state.test.ts": ["../tools/move-data/advantage-state.jsonl"],
      "test/autoland-sweep.test.ts": ["test/fixtures/autoland-backlog.json", "scripts/autoland.ts", "scripts/autolandCore.ts", "scripts/autoland-superseded.sh", "../.github/workflows/autoland.yml", "../.github/workflows/autoland-sweep.yml"],
      "test/classic-effect-screen.test.ts": ["src/**", "../build-inputs/**", "../typescript-toolchain.lock"],
      "test/drawn-size.test.ts": ["../build-inputs/**"],
      "test/driver-move-normal.test.ts": ["src/**", "scripts/wisp/botMatch.ts", "test/rematch/journalHelper.ts", "../build-inputs/**"],
      "test/element-looks.test.ts": ["test/fixtures/stock-sound-labels.txt", "scripts/wisp/model-facts/**"],
      "test/fighter-hide.test.ts": ["src/**", "test/native/captures/wisp125-warden-nair.pad"],
      "test/native-capture.test.ts": [],
      "test/sheriff.test.ts": ["scripts/sheriff.ts"],
      "test/standalone.test.ts": ["src/**", "scripts/wisp/botMatch.ts", "test/native/pads/cpu-expert.pad", "test/native/pads/203/**", "../build-inputs/**"],
      "test/text-match.test.ts": ["test/playtest407/dsmash-loop.in", "scripts/balanceBaseline.json", "scripts/wisp/model-facts/**"],
      "test/wisp.test.ts": ["test/fixtures/wisp/**"],
      "test/playable.test.ts": ["test/fixtures/playable-0045/**"],
      "test/melee-oracle.test.ts": ["../docs/gameplay-design.md"],
    },

    journeys: [
      "test/menu-journey.test.ts",
      "test/desync-guard.test.ts", "test/visual-lifecycle.test.ts", "test/player-text.test.ts", "test/standalone.test.ts", "test/match-settings.test.ts", "test/lag-recovery.test.ts", "test/local-start.test.ts",
    ],
    isolated: ISOLATED_TEST_GROUPS,
    timeoutMs: TEST_TIMEOUT_MS,
    env: TEST_WORKER_ENV,
    envForFiles: testWorkerEnvironment,
  },
  journey: { module: "scripts/wisp/journeys.ts", export: "SMASHCRAFT_JOURNEYS", name: "quick-match" },
  hot: { project: buildProject("main"), sourceDirectory: join(tsDirectory, "src"), sourceMapDirectory, filePrefix: "smashcraft" },
};

export const dev = makeDev(SMASHCRAFT_DEV);
