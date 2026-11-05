



import { join } from "node:path";
import { type DevProject, makeDev } from "wisp/scripts/wisp/commands/dev";
import { TEST_TIMEOUT_MS, TEST_WORKER_ENV, testWorkerEnvironment } from "../../testWorkers";
import { buildProject, sourceMapDirectory, tsDirectory } from "../project";

export const MAKGORA_DEV: DevProject = {
  root: tsDirectory,
  sources: ["src", "scripts", "test"],
  typeCheck: { projects: ["tsconfig.json", "tsconfig.game.json"], command: [process.execPath, "run", "check"] },
  tests: {

    files: ["{src,scripts,test}/**/*{.test,_test,.spec,_spec}.{js,jsx,ts,tsx}"],
    registry: "src/**/*.tests.ts",
    preload: ["test/host-natives.ts"],
    reads: {
      "test/clean-room.test.ts": ["../docs/hive-post.md", "src/game/ui/credits.ts", "src/game/ui/community.ts"],
      "test/sheriff.test.ts": ["scripts/sheriff.ts"],
    },

    timeoutMs: TEST_TIMEOUT_MS,
    env: TEST_WORKER_ENV,
    envForFiles: testWorkerEnvironment,
  },
  journey: { module: "scripts/wisp/journeys.ts", export: "MAKGORA_JOURNEYS", name: "quick-match" },
  hot: { project: buildProject("main"), sourceDirectory: join(tsDirectory, "src"), sourceMapDirectory, filePrefix: "makgora" },
};

export const dev = makeDev(MAKGORA_DEV);
