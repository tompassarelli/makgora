# Workflow

`bun wisp release tree` compares the release milestone with root #1 and all
recursive sub-issues, including closed issues. `--fix` adds missing milestones
and attaches outside issues when an epic label or issue link identifies one
parent. Ambiguous parents are listed for the proxy and keep the check failing.
The daily Release tree workflow checks this invariant; Autoland planning
doesn't run it, since its walk spends one API call per tree issue (#350).

Smashcraft is a platform fighter for Warcraft III, written in TypeScript and
compiled to Lua with TypeScriptToLua. Wisp and Bun are the supported build,
test and development tools. `smashcraft:typescript-toolchain.lock` pins Bun,
TypeScript, TypeScriptToLua and Effect; the map build checks it. Wisp is
maintained in its own repository. smashcraft:ts/wisp.lock records the exact
source revision; Bun installs its generated archive from smashcraft:ts/vendor/.
Change framework code in an owned Wisp lane, publish it, and update the
consumer pin with `bun run update:wisp` from smashcraft:ts/ (fetches the
current published `main` and records its resolved commit).

Roadmap [#16](https://github.com/tompassarelli/smashcraft/issues/16) lists the
open work in order. Each issue's **Done when** and **Not required** lists are its
complete scope, and its "Rules for whoever picks this up" govern the work.

- A problem that doesn't block a box goes in a new `priority:later` issue, not
  into the current one.
- After about a day without progress, stop
  and tell Tom what fails, one recommended fix and its cost.
- Keep each issue's Status section to 5 lines, edited in place, with at most
  one line of residual risk. Comment only to close or to ask Tom for a decision.

Answer "what can we claim about input timing?" from #26's integrity table, or
its Status until the table exists. A status question never starts a new
investigation.

- smashcraft:ts/src/ owns gameplay, deterministic state/replay, selection and UI.
- smashcraft:controller/ owns Smashcraft's controller plug-in and journal helper (`wc3-journal`); the service itself is github.com/tompassarelli/padbridge, pinned by rev in controller/Cargo.toml.
- The player's desktop app is github.com/tompassarelli/smashcraft-client; it reads Smashcraft only through smashcraft:docs/client-interface.md, which this repository owns.
- smashcraft:tools/ owns build, native probes and automation.
- smashcraft:docs/ holds durable knowledge only: how systems work, design
  decisions, reference data and procedures. Status, progress, plans, claim
  tables and trial results live in the owning issue: the table, the run link
  and the commit. When a trial teaches something durable, add that fact to the
  relevant doc, with its build.
- Use the declared project development shell rather than repeated ad hoc setup.

Every push runs the pre-push gate (smashcraft:.githooks/pre-push, enabled for
the repository with `git config core.hooksPath .githooks`; safe-push runs it):
the local private-store map input check for build-input, pin, generated clip
and build tooling changes (`bun scripts/wisp.ts map build --profile playable
--edition classic --inputs-only` from ts/). It runs the build's input, import
and cue checks before Autoland hand-off, with no source-only cache; hosted
runners omit it because they have no private store. The other checks are
the clean-room check (smashcraft:ts/scripts/cleanRoom.ts: no game files or
copied game scripts outside smashcraft:clean-room-allowlist.tsv; wisp:docs/clean-room.md),
`bun run check` (the kind-tag refusal of test titles, smashcraft:ts/scripts/oracleTagsCheck.ts,
then the type check, then Wisp's Lua number rules over the game and Lua-test configs, wisp#129) and the type-escape audit (smashcraft:ts/test/source-shapes.test.ts)
when the pushed commits change ts/, the model facts check
(smashcraft:ts/test/model-facts.test.ts; it refuses with the `bun wisp view models`
refresh command) when they change clips or model build inputs, and the cue models check (smashcraft:ts/scripts/cueModels.ts) when they change a file that defines a cue, accent or projectile model (the import closure of that script) or its record: every such model must appear in smashcraft:ts/scripts/wisp/cue-models.tsv. The record needs the private render-asset cache, so it is written locally by `bun scripts/cueModels.ts --record` (from ts/, on a machine with the Warcraft III 3.0.0.24268 install; the first run extracts what no render has cached) and committed; Autoland's hosted runners check the lane against it. The same record carries Classic model facts from one exact 3.0.0.24268 cache: per model path (plus the imported-models pin for a non-content-addressed imported model) and the digest of its cache bytes, exactly what the judge reads (sequences, emitters, ribbons, geosets, their tracks and whether their textures resolve), extracted by `classicModelFacts` at `FACTS_VERSION` (smashcraft:ts/scripts/wisp/effectVisibility.ts). Verdicts are never committed: every check computes each use's verdict from its descriptor (fighter, move, model, sequence, seek, time scale, scale, alpha, lifetime, matrix width and height, anchor and playback) and its model's facts, so a landing that edits a render file, a lockfile or a use's presentation needs no record change, and the record changes only when a model path is first used or `FACTS_VERSION` is bumped. Each facts row carries its own checksum and rows merge per model (`.gitattributes` routes the record through smashcraft:ts/scripts/mergeGenerated.ts), so two lanes' records merge without re-recording, while a hand-edited row refuses. `bun scripts/cueModels.ts --verdicts` prints every computed verdict. Missing and invisible uses refuse the report gate; every Unknown use is listed with its reason and awaits calibration. The check also refuses unless its calibration holds: it must flag the 0.0.145 Breath of Fire and Shockwave uses for their causes (#365, #484) and pass the native-captured known-visible set (`EFFECT_CALIBRATION`). A passing report keeps Unknown resolution and native acceptance open; visible means supported model-data visibility. All of this takes a few seconds (smashcraft:ts/scripts/prePush.ts).
It checks the working tree, so push from a clean checkout of the commit.
The repository's .safe-push sets `landing.queue = autoland`, so `safe-push --to main` runs the local checks (only those needing private or local inputs; Autoland's build runs the rest in this hook on the candidate, smashcraft:docs/ci.md, "Autoland"), then hands the lane to Autoland's one queue, which farms each batch of waiting lanes once and lands the exact commit it tested (smashcraft:docs/ci.md, "Autoland"); the gate runs no farm suite of its own for such a push, so each landing runs the suite once. A lane that changes `.github/workflows/` (Autoland can't push it), or any main push in a clone whose .safe-push names no `autoland` queue, lands directly and needs a green farm suite (`bun wisp farm test`) on the exact commit it pushes: the gate reuses a farm run already green on that commit, else runs one and waits (about 4 minutes), and refuses on any failure, main's known ones included (#394). Skipping the gate's farm run is safe only while Autoland's suite runs every farm-test job with the same inputs: smashcraft:ts/scripts/suiteParity.ts checks that, from the pre-push gate whenever a push changes farm-test.yml, autoland.yml or the check itself, and in ts/test/suite-parity.test.ts.

Main stays green. Each CI run on main opens, updates or closes the one
"main is red" issue (smashcraft:.github/workflows/main-red.yml), which lists the
failing tests and the first failing commit; the pre-push gate prints that list
on every push. Its runs post no issue comments; each run's summary and
annotation say red, still red or green again (`gh run view RUN_ID`). A red main is not "already failing": before landing, check
whether your change touches a listed test, and if your commit broke main, fix
it first.
A push to a `claude/**` branch (a cloud worker's) lands on main by itself
when its full suite adds no failure to main's, and otherwise its run fails
with the reason in its job summary and annotation (smashcraft:docs/ci.md, "Autoland").

Keep proprietary game assets and base maps privately outside repository trees.
Always identify the current playable artifact separately from an experimental
candidate; a diagnostic pass does not replace that release.

`bun wisp map build --profile playable --predict-cost` writes `MAP.w3x.lua-cost.json` and
`MAP.w3x.lua-cost.perf` beside the map. The JSON records predicted Lua p50/p95
for player 0's 1,800 `playable-bot-four` callbacks, within #19's solo/four-bot
calibration scope. Worst is diagnostic. Its note is "Lua cost predicted;
whole frame not measured". A build whose predictor inputs (both Lua entries
and their local modules, configs, Wisp pin, Lua binary) hash the same reuses
`ts/build/playtest-cost/HASH.perf`. Play builds skip the prediction (about
280 s, two more compiles of the game) unless `bun run playtest:build --predict-cost`
asks for it; an installed playtest built that way keeps both files beside its map. Compare the samples from `ts/` with
`bun wisp perf compare MAIN.perf MAP.w3x.lua-cost.perf`, MAIN.perf from `bun wisp perf playable-bot-four --samples --out MAIN.perf` on main.
