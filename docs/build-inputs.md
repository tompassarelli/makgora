# Build inputs

The map build reads private inputs that never enter Git: the base map, the
asset container, the summon clips and the folders of `--assets` (fighter
models, clip pools, stage and impact models, imported community models,
selection art, fighter renders, stage-select pictures, hero models, model sounds). Each is a
*family*, stored once under the hash of its contents and never changed.
smashcraft:build-inputs/ names the hash of every family a revision builds
with, one file per family, so a commit fixes its art exactly as it fixes its code.

## How it works

- **Store.** ~/.local/share/smashcraft-build-inputs/store/FAMILY/HASH/ holds
  one family. HASH is the SHA-256 of the folder's sorted file list, each
  line a relative path and that file's SHA-256 (base and container are folders
  holding `base.w3m` and `container.w3x`). `bun wisp inputs add` copies the
  source into a private staging folder, hashes the copy, makes it read-only
  and publishes it by one rename; a second writer of the same contents finds
  it there. Nothing writes into a published folder.
- **Manifest.** smashcraft:build-inputs/FAMILY holds the hash of each family named in
  smashcraft:ts/scripts/wisp/buildInputs.ts (`FAMILIES`), one file per family so
  two lanes that store different families never edit the same file (#401). There is
  no global pointer: a lane's manifest is its own, and main's is main's.
- **Shards.** The families a fighter repack writes (hero-models,
  original-clips-static-lights, impact-assets) are sharded: build-inputs/FAMILY/ holds
  one pin per fighter slug and one for `shared`, and each shard is stored like a
  family under store/FAMILY/HASH/. `bun wisp inputs add` splits the folder by owner
  (smashcraft:ts/scripts/wisp/inputShards.ts): a fighter's source model, every file
  named after the fighter (`KoboldTimelineBody-…`, `original-clips-evidence/Kobold.json`,
  `white-flash-imports/Kobold.txt`) and every texture its white list names; the rest is
  `shared`. The clip pool keeps one evidence record per fighter and impact-assets one
  white import list per fighter, so no file holds two fighters' data. A staged
  folder is a copy of the whole family, so a stale copy of another fighter's file
  would repin that fighter: `inputs add FAMILY DIR --fighter SLUG`... stores and
  repins only the named shards (`shared` names the rest) and leaves every other pin
  file untouched, and `--all` repins every shard; a sharded add with neither is
  refused (#202). Two lanes that
  repack different fighters write different pin files and land in parallel.
- **Resolve and verify.** `bun wisp map build` without `--base`, `--container`,
  `--assets` or `--summon` reads the checkout's manifest, rehashes every family
  (about 0.6 s for 290 MB) and fails before compiling when one is missing or
  differs, naming the command that produces it. `--assets` resolves to
  store/views/HASH/, a folder of links to the asset families, itself keyed by
  the hashes it names; a sharded family's folder there hard-links its shards'
  files into the one folder tools read. An input given on the command line overrides the
  manifest's for experiments.
- **Hosts.** Each host keeps its own store, and `inputs add` and `inputs derive`
  write only the local one, so a pin landed from one host names entries the others
  lack until they copy them. `bun wisp inputs fetch HOST...` (from smashcraft:ts/)
  copies every entry the checkout pins and this store lacks from the first named host
  that holds it, over ssh as a tar stream into a staging folder beside the store,
  rehashes the copy, seals it and publishes it by one rename like `inputs add`
  (smashcraft:ts/scripts/wisp/inputsFetch.ts). A copy that hashes otherwise is
  refused. `map build`, `inputs check` and `inputs derive` name this command when
  a pinned entry is missing. Adding pushes nowhere: the publishing host need not
  reach every builder or know which hosts build, and the host that lacks an entry
  learns it at its next build. The store is licensed art: it moves only between
  your own hosts over ssh, never through Git or a public service.
- **Play.** `bun wisp play` builds main from main's manifest. Builders of a
  revision share the lock ~/.local/share/smashcraft-build-inputs/locks/play-REVISION.lock
  (flock(2), released by the kernel when its holder exits): the first builds
  in the revision's lane worktrees/play-build-REV12 into a staging folder
  beside play-current/REVISION and renames it into place; the others wait,
  then reuse that map. A new revision's number is reserved under
  locks/play-version.lock as play-current/REVISION.version, so two revisions
  built at once never share a number. The lane is removed after the build.
- **Optional helper.** The controller helper is optional (#166). A new play
  build tries it after the map; a failure prints one line and play goes on on
  the keyboard. `bun wisp controller` builds it on demand.
- **Staged writes.** Wisp stages a map as `OUT.PID.next` and renames it over
  `--out`, and extracts from the base and container read-only, so concurrent
  builds of one path never share a partial file and stored inputs stay sealed.
  Game files, installed maps and play's host files are written the same way.

## Public and private packages

`bun wisp map build --profile playable --name NAME --out OUT.w3x` defaults
to `--edition classic`: the public package omits every `_hd.w3mod`
import. Other profiles default to `--edition full`, and
`bun wisp play` explicitly builds a full private playable map. The inputs stay intact for either edition. Rebuilds preserve
the existing archive's edition. A Classic build rejects a base or container
that already carries HD entries; the sealed inputs contain none.

## Change art

New or changed art is a new family hash and a manifest commit, landed like
code:

1. Produce the family into a folder of your lane (generators write
   build/FAMILY; `bun wisp inputs path assets` prints the current `--assets`
   for tools that read it). Fighter clips, bodies and white flashes are derived
   instead: step 2's `bun wisp inputs derive` rebuilds them from the pinned sources.
2. `bun wisp inputs add FAMILY DIR` (from smashcraft:ts/) stores it and writes
   its hash into your checkout's build-inputs/FAMILY.
   `bun wisp inputs derive [--fighter NAME]...` (from smashcraft:ts/) runs each
   fighter's clip export, timeline bodies and white flashes
   (smashcraft:ts/scripts/wisp/fighterArt.ts), fighters in parallel under one
   machine-capacity lease, and pins the fighters' original-clips-static-lights
   and impact-assets shards and generated files. It first regenerates each
   fighter's rules (victory pose, flash clips, Warden's blade timing) into
   ts/src/generated/fighter-art/SLUG.ts, so a lane that changes a fighter's clip
   tables needs no separate `bun run generate`. Each step is stored under
   store/derived/STEP/KEY/, KEY hashing the fighter's source model and rules
   file, the step's source files and lockfiles, the earlier step's key and, after
   the export, the stock build and the hero-models and imported-models pins, so a
   run redoes only the steps whose inputs changed. `--rebuild` ignores stored steps.
   The steps run in a scratch copy of the checkout, and only the derive writes
   their differences back; `--check` writes nothing and fails, listing them, when
   any pin or generated file differs or a fighter's rules drift from the game
   data. Pre-push runs it for each fighter whose pins, rules, generated clips or
   whites, model facts or source family a landing changes,
   and for every fighter when it changes code the derive steps import or the
   hero-models or imported-models pins, which feed every fighter's step keys
   (smashcraft:ts/scripts/wisp/fighterArtChanges.ts). It also measures each
   checked fighter's strike moments from its committed model and fails when
   `heroStrikeMomentInfo.ts` holds different rows for him; regenerate them with
   `bun wisp view strikes --assets "$(bun wisp inputs path assets)"`. Pre-push also
   runs `bun wisp view strikes --check` over every fighter when a landing changes a
   pin, the measurement's imports (move data, clip tables, looks) or the table itself
   (smashcraft:ts/scripts/prePush.ts, `strikeInputs`).
   A derive that fails keeps its step logs in derive/run-*/ beside the store;
   `bun wisp inputs prune [--scratch NAME]...` removes the runs older than the
   derive lease, and each named scratch folder under the build-inputs root,
   skipping any folder a process has open or a git worktree lives in and never
   touching the store (smashcraft:ts/scripts/wisp/inputsPrune.ts).
3. `bun wisp map build --profile playable --edition full --name NAME --out OUT.w3x` from the lane
   checks the change; commit build-inputs/FAMILY with the code that needs it and
   land it. Lanes that changed different families, or different fighters' shards
   of a sharded family, touch different files and merge cleanly; two lanes that
   changed the same family (or fighter) conflict on that one file. Model facts are one file per model (smashcraft:ts/scripts/wisp/model-facts/),
   the move list and the anim-score tables are generated and untracked, and
   smashcraft:.gitattributes merges the map size and Bun test cost baselines per row
   through smashcraft:ts/scripts/mergeGenerated.ts, which `bun install` (from ts/)
   registers in the repository's git config (#401).

`bun wisp map build --profile playable --edition classic --inputs-only` runs
the build's private input, import and cue resolution checks without compiling
or packing a map. The landing hook runs this locally when build inputs, pins,
generated clips or their build tooling change. It rechecks the private store
on every push; source-only cached results cannot hide a missing body. Hosted
runners omit this check because they have no private store.

`bun wisp inputs check` verifies every family of the checkout's manifest.
Never edit a stored folder; a build reports an edit in place with the command
that regenerates the family.

The public authored `tools/selection/art/wc3-pinching-hand.png` is Tom's
AI-created pinch pose, approved for public shipping. The normal
`bun tools/selection/build-art.ts` converts it to `SelectionHandPinch.tga`;
the other poses keep their existing SVG sources. Store the generated
`selection-assets` family and commit its hash with the source change.

## Other shared paths

- The LAN pool's ~/.local/state/wisp/lan/ and each client's CustomMapData
  belong to the agent running those clients; Wisp writes game files through
  per-process temporaries.
- The controller launcher link and the owner's Maps/00-Smashcraft are replaced
  through per-process temporaries (`NAME.PID.next`), renamed in. Installing a
  main build removes every other file in its dev/ folder, so dev/ holds one main
  build and at most one lane build to try, and releases/ keeps every release (smashcraft:docs/play.md).
- Lane, test, integrity and diagnostic builds go to a private folder: a
  per-run temporary removed after the run, a new folder under
  ~/.local/share/smashcraft-build-inputs/, or the lane cache
  ~/.local/state/smashcraft/lane-builds/ (one build per lane). `wisp map build`
  and `wisp map rebuild` refuse a path inside the owner's Maps/00-Smashcraft.
- The LAN pool's pool.json and clients.json have one writer, the running
  `wisp lan pool`.
- ts/build/ and build/ are per checkout: run one build at a time in a lane.
- Dated folders under ~/.local/share/smashcraft-build-inputs/ are lanes'
  scratch and evidence inputs. A build reads only the store.
