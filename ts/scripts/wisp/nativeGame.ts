import { Effect } from "effect";
import { headlessRender, playerRender } from "./headlessRender";
import { smashcraftStandalone } from "./standalone";

const playerMap = new URL(import.meta.url).searchParams.get("map");

export const SMASHCRAFT_NATIVE_GAME = smashcraftStandalone(playerMap === null ? headlessRender() : await Effect.runPromise(playerRender(playerMap)));
