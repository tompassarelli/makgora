import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { LEDGER_ROWS, PAGE_PATH, evaluate, familyNotes, ledgerPage, ledgerProblems, openRows, statusText } from "../../ledger/ledger";
import { runOracle } from "../../meleeOracle";

const root = join(import.meta.dir, "../../../..");
const pageFile = join(root, PAGE_PATH);

class LedgerFailure extends Schema.TaggedError<LedgerFailure, { readonly brand: unique symbol }>()("LedgerFailure", { problems: Schema.Array(Schema.String) }) {
  override get message(): string {
    return this.problems.join("\n");
  }
}

const readSource = (file: string): string | undefined => {
  const path = join(root, file);
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
};

const evaluated = Effect.try({ try: () => ({ rows: evaluate(LEDGER_ROWS, readSource), notes: familyNotes(readSource), checks: runOracle() }), catch: (cause) => new LedgerFailure({ problems: [describeCause(cause)] }) });

const failOn = (problems: readonly string[]) => (problems.length === 0 ? Effect.void : Effect.fail(new LedgerFailure({ problems })));

export const ledger: Command = (args) => {
  const [mode] = args;
  if (args.length > 1 || (mode !== undefined && mode !== "--check" && mode !== "--open")) return Effect.fail(new UsageFailure({ problem: "ledger takes --check or --open" }));
  return Effect.gen(function* () {
    const { rows, notes, checks } = yield* evaluated;
    if (mode === "--open") {
      const open = openRows(rows);
      return yield* Console.log(open.length === 0 ? "No row awaits Tom" : open.map(({ row }) => `${row.id}: ${statusText(row.status)}`).join("\n"));
    }
    const page = ledgerPage(rows, notes, checks);
    const problems = ledgerProblems(rows, notes, checks);
    if (mode === "--check") {
      const written = existsSync(pageFile) ? readFileSync(pageFile, "utf8") : undefined;
      yield* failOn([...problems, ...(written === page ? [] : [`${PAGE_PATH} is stale: run bun wisp ledger`])]);
      return yield* Console.log(`${rows.length} ledger rows hold and ${PAGE_PATH} is current`);
    }
    yield* Effect.tryPromise({ try: () => Bun.write(pageFile, page), catch: (cause) => new LedgerFailure({ problems: [describeCause(cause)] }) });
    yield* Console.log(`Wrote ${PAGE_PATH}: ${rows.length} rows`);
    yield* failOn(problems);
  });
};
