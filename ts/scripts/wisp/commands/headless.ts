import { Effect } from "effect";
import { type Command } from "wisp/scripts/wisp/command";
import { makeHeadless } from "wisp/scripts/wisp/commands/headless";
import { MAKGORA_PERF } from "./perf";

const run: Command = (args) => makeHeadless(async () => {
  const project = (await import("../journeys")).MAKGORA_JOURNEYS;
  return args.includes("--render") || args.includes("--bounds")
    ? { ...project, render: (await import("../headlessRender")).headlessRender() }
    : project;
}, MAKGORA_PERF)(args);

export const headless: Command = (args) => Effect.promise(async () => (await import("../journeys")).TEXT_JOURNEYS.includes(args[0] ?? "")).pipe(
  Effect.flatMap((text) => text
    ? Effect.promise(() => import("./textMatch")).pipe(Effect.flatMap(({ textMatch }) => textMatch(args.slice(1))))
    : run(args)),
);
