import { Effect } from "effect";
import { headlessRender, playerRender } from "./headlessRender";
import { livePortraits } from "../../src/game/ui/liveCard";
import { type StandaloneStart, createStandaloneSession, smashcraftStandalone } from "./standalone";

livePortraits.enabled = true;

const query = new URL(import.meta.url).searchParams;
const playerMap = query.get("map");
const start = (query.get("start") ?? "match") as StandaloneStart;
const chosen = query.get("chosen") ?? undefined;

export const SMASHCRAFT_NATIVE_GAME = {
  ...smashcraftStandalone(playerMap === null ? headlessRender() : await Effect.runPromise(playerRender(playerMap))),
  create: (session: Parameters<typeof createStandaloneSession>[0]) => createStandaloneSession({ ...session, start, ...(chosen === undefined ? {} : { chosen }) }),
};
