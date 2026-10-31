import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { headlessRender, playerRender } from "./headlessRender";
import { livePortraits } from "../../src/game/ui/liveCard";
import type { MapBuild } from "../../src/game/session/build";
import { type StandaloneStart, createStandaloneSession, smashcraftStandalone } from "./standalone";

livePortraits.enabled = true;

// a compiled player cannot import a module path with a query, so its options travel in the environment
const query = import.meta.url.includes("?") ? new URL(import.meta.url).searchParams : new URLSearchParams(process.env.SMASHCRAFT_NATIVE_QUERY ?? "");
const playerMap = query.get("map");
const start = (query.get("start") ?? "match") as StandaloneStart;
const chosen = query.get("chosen") ?? undefined;
const presentation = (query.get("presentation") ?? undefined) as MapBuild["presentation"];
const digestFile = query.get("digests") ?? undefined;
const savedFiles = query.get("save") === null ? undefined : join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "smashcraft/native-files");

export const SMASHCRAFT_NATIVE_GAME = {
  ...smashcraftStandalone(playerMap === null ? headlessRender() : await Effect.runPromise(playerRender(playerMap))),
  create: async (session: Parameters<typeof createStandaloneSession>[0]) => {
    const created = await createStandaloneSession({ ...session, start, ...(presentation === undefined ? {} : { presentation }), ...(savedFiles === undefined ? {} : { savedFiles }), ...(chosen === undefined ? {} : { chosen }) });
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
