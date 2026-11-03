import { Console, Effect } from "effect";

export interface Release { readonly tag_name: string; readonly assets: readonly { readonly name: string }[] }

const SHIPPED_ONLY_ON_HIVE = /\.(w3x|w3m|mpq|mdx|mdl|blp|dds|tga)$/i;

export function mapAssets(releases: readonly Release[]): string[] {
  return releases.flatMap(({ tag_name, assets }) => assets
    .filter(({ name }) => SHIPPED_ONLY_ON_HIVE.test(name))
    .map(({ name }) => `${tag_name}: ${name}`));
}

const releases = Effect.promise(async () => {
  const listed = Bun.spawnSync(["gh", "api", "--paginate", "--slurp", "repos/tompassarelli/makgora/releases"]);
  if (listed.exitCode !== 0) return { error: listed.stderr.toString().trim() } as const;
  return { releases: (JSON.parse(listed.stdout.toString()) as Release[][]).flat() } as const;
});

const check = Effect.gen(function*() {
  const listed = yield* releases;
  if ("error" in listed) {
    yield* Console.error(`release assets: gh api failed: ${listed.error}`);
    return process.exit(2);
  }
  const found = mapAssets(listed.releases);
  if (found.length === 0) return yield* Console.log("release assets: no GitHub release carries a map or model file");
  yield* Effect.forEach(found, (line) => Console.error(`release assets: ${line}`), { discard: true });
  yield* Console.error("The map holds ported Blizzard models, so it ships on Hive Workshop and Battle.net only (README \"Respect copyright\"). Delete each file above with gh release delete-asset TAG NAME -R tompassarelli/makgora and link the Hive Workshop page from the release notes instead.");
  process.exit(1);
});

if (import.meta.main) await Effect.runPromise(check);
