import { Console, Effect, Exit } from "effect";
import { type Finished, runGroup } from "./processGroups";

const root = `${import.meta.dir}/..`;

const STEPS: readonly (readonly string[])[] = [
  ["bun", "codegen/run.ts", "--check"],
  ["bun", "scripts/oracleTagsCheck.ts"],
  ["bun", "scripts/luaCostRecordsCheck.ts"],
  ["bun", "wisp", "ledger", "--check"],
  ["bun", "scripts/clipBindingsCheck.ts"],
  ["bun", "scripts/meleeTopTiers.ts", "--check"],
  ["bun", "node_modules/typescript-native/bin/tsc", "--build", "tsconfig.json", "tsconfig.game.json"],
  ["bun", "scripts/toolsTypecheck.ts"],
  ["bun", "node_modules/wisp/host/toolchain/numberRules.ts", "tsconfig.game.json", "tsconfig.lua-tests.json"],
  ["bun", "wisp", "shapes", "--check"],
];

const output = ({ stdout, stderr }: Finished) => `${stdout}${stderr}`;

const program = Effect.gen(function*() {
  const finished = yield* Effect.forEach(STEPS, (command) => runGroup(command, { cwd: root }), { concurrency: "unbounded" });
  let failed = 0;
  for (const [index, result] of finished.entries()) {
    process.stdout.write(output(result));
    if (result.exitCode === 0) continue;
    failed = failed === 0 ? result.exitCode : failed;
    yield* Console.error(`check: ${STEPS[index]?.join(" ")} exited ${result.exitCode}`);
  }
  return failed;
});

const exit = await Effect.runPromiseExit(program);
if (Exit.isFailure(exit)) console.error(String(exit.cause));
process.exit(Exit.isSuccess(exit) ? exit.value : 2);
