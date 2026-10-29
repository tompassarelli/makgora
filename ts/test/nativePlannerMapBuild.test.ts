import { expect, test } from "bun:test";
import { Effect } from "effect";
import { plannerMapBuild } from "../scripts/wisp/commands/native";
import { decodeBuildOptions } from "../scripts/wisp/mapInputs";

test("a native plan's missing pad map builds with arguments map build accepts, named and in the batch's edition [k2 property]", async () => {
  const [, , ...args] = plannerMapBuild({ id: "batch-0", map: "/tmp/batch-0.w3x", look: "classic" });
  const options = await Effect.runPromise(decodeBuildOptions(args));
  expect(options).toMatchObject({ name: "Smashcraft native batch-0", out: "/tmp/batch-0.w3x", edition: "classic" });
});
