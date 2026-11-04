import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { headlessRender, playerRender } from "./headlessRender";
import { livePortraits } from "../../src/game/ui/liveCard";
import type { MapBuild } from "../../src/game/session/build";
import type { StageTile } from "../../src/game/menu/stageCatalog";
import { type StandaloneStart, createStandaloneSession, makgoraStandalone } from "./standalone";
import { MEASURED_FROM } from "../perfWindowTable";

livePortraits.enabled = true;

// a compiled player cannot import a module path with a query, so its options travel in the environment
const query = import.meta.url.includes("?") ? new URL(import.meta.url).searchParams : new URLSearchParams(process.env.MAKGORA_NATIVE_QUERY ?? "");
const playerMap = query.get("map");
const start = (query.get("start") ?? "match") as StandaloneStart;
const chosen = query.get("chosen") ?? undefined;
const tutorialOffer = query.get("noTutorialOffer") === null;
const presentation = (query.get("presentation") ?? undefined) as MapBuild["presentation"];
const digestFile = query.get("digests") ?? undefined;
const stage = query.get("stage"), rollback = query.get("rollback");
const match = { ...(query.get("fourFighters") === null ? {} : { fourFighters: true }), ...(stage === null ? {} : { stage: Number(stage) as StageTile }), ...(rollback === null ? {} : { rollback: Number(rollback) }) };
const savedFiles = query.get("save") === null ? undefined : join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "makgora/native-files");

export const MAKGORA_NATIVE_GAME = {
  ...makgoraStandalone(playerMap === null ? headlessRender() : await Effect.runPromise(playerRender(playerMap))),
  create: async (session: Parameters<typeof createStandaloneSession>[0]) => {
    const created = await createStandaloneSession({ ...session, ...match, start, ...(presentation === undefined ? {} : { presentation }), ...(savedFiles === undefined ? {} : { savedFiles }), ...(chosen === undefined ? {} : { chosen }), ...(tutorialOffer ? {} : { tutorialOffer }) });
    const warmup = Number(process.env.WISP_WINDOW_WARMUP_FRAMES ?? 0);
    if (warmup > 0) {
      const step = created.step;
      let steps = 0;
      created.step = (input) => { if (++steps === warmup + 1) console.error(MEASURED_FROM); step(input); };
    }
    if (digestFile === undefined) return created;
    const rows: string[] = [];
    return {
      ...created,
      step(input: Parameters<typeof created.step>[0]) {
        created.step(input);
        const { frame, digest } = created.digest();
        rows.push(`${frame} ${digest}`);
      },
      close() {
        created.close();
        writeFileSync(digestFile, rows.join("\n") + "\n");
      },
    };
  },
};
