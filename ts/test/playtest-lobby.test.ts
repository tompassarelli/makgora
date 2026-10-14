import { expect, test } from "bun:test";
import { Effect, Exit } from "effect";
import { ChildProcess } from "effect/process";
import { readyPlaytest } from "../scripts/wisp/playtestReady";

test("the build publishes RC readiness only after its requested lobby is confirmed [k5 integration]", async () => {
  const map = "/private/Smashcraft 0.0.194.w3x";
  const lines: string[] = [];
  const attempt = (output: string, code = 0) => readyPlaytest(map, ChildProcess.make(process.execPath, ["-e", `console.log(${JSON.stringify(output)}); process.exit(${code});`]), (line) => lines.push(line));
  for (const output of ["RC-READY attempted before lobby", "LOBBY-READY Smashcraft 0.0.193.w3x screenshot=/private/lobby.png", "LOBBY-READY Smashcraft 0.0.194.w3x screenshot="]) {
    const exit = await Effect.runPromiseExit(attempt(output));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(lines).toEqual([]);
  }
  const confirmation = "LOBBY-READY Smashcraft 0.0.194.w3x screenshot=/private/lobby.png";
  expect(Exit.isFailure(await Effect.runPromiseExit(attempt(confirmation, 1)))).toBe(true);
  expect(lines).toEqual([]);
  await Effect.runPromise(attempt(`RC-READY premature\n${confirmation}`));
  expect(lines).toEqual([confirmation, "RC-READY Smashcraft 0.0.194.w3x screenshot=/private/lobby.png"]);
});
