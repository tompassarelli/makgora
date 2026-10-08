# Smashcraft development

Smashcraft is a platform fighter for Warcraft III, written in TypeScript and
compiled to Lua with TypeScriptToLua. Wisp and Bun are the supported build,
test and development tools. `smashcraft:typescript-toolchain.lock` pins Bun,
TypeScript, TypeScriptToLua and Effect; the map build checks it. Wisp is
maintained in its own repository. smashcraft:ts/wisp.lock records the exact
source revision; Bun installs its generated archive from smashcraft:ts/vendor/.
Change framework code in an owned Wisp lane, publish it, and update the
consumer pin with `bun run update:wisp` from smashcraft:ts/ (fetches the
current published `main` and records its resolved commit). Never edit the
installed dependency or add a local framework copy.

Before adding tooling or diagnostics, consult Wisp's feature index at
smashcraft:ts/node_modules/wisp/docs/index.md (source: wisp:docs/index.md).
It includes opt-in features such as TypeScript call stacks and their costs.
A new `bun wisp` command isn't done until the list below names it;
smashcraft:ts/test/command-list.test.ts enforces that.

## Issues define the scope — finish them

Roadmap [#16](https://github.com/tompassarelli/smashcraft/issues/16) lists the
open work in order. Each issue's **Done when** and **Not required** lists are its
complete scope, and its "Rules for whoever picks this up" govern the work.

- Close an issue when its boxes pass, with one short comment (build, result,
  link). Don't add boxes or keep it open for guarantees it doesn't list.
- A problem that doesn't block a box goes in a new `priority:later` issue, not
  into the current one.
- Every check gets one run on a commit: it passes, ship; a failure gets fixed
  and run once more. Load-bearing rules get one run of the broader check (the
  farm sweep), not repeats: determinism, rollback, netcode and input. Only
  frame-cost and latency checks may confirm once on a quiet machine.
- Agents run every check, playtests included, by script or capture; Tom plays
  only when he wants to, and anything he notices becomes an issue. Don't write
  boxes that wait on Tom.
- After two failed fixes on the same box, or about a day without progress, stop
  and tell Tom what fails, one recommended fix and its cost.
- Keep each issue's Status section to 5 lines, edited in place, with at most
  one line of residual risk. Comment only to close or to ask Tom for a decision.

Answer "what can we claim about input timing?" from #26's integrity table, or
its Status until the table exists. A status question never starts a new
investigation.

## Source and workflow

- smashcraft:ts/src/ owns gameplay, deterministic state/replay, selection and UI.
- smashcraft:companion/ owns the Rust controller/helper boundary.
- smashcraft:client/ owns the player's desktop app (Tauri: Rust backend, Bun-built TypeScript pages); it uses controller support only through the service's local interface (smashcraft:client/README.md).
- smashcraft:tools/ owns build, native probes and automation.
- smashcraft:docs/ holds durable knowledge only: how systems work, design
  decisions, reference data and procedures. Status, progress, plans, claim
  tables and trial results live in the owning issue: the table, the run link
  and the commit. When a trial teaches something durable, add that fact to the
  relevant doc, with its build.
- Use the declared project development shell when available. Preserve pinned
  dependencies; do not repeat ad hoc environment setup as the normal loop.

## TypeScript and Wisp

For fighter animation quality and action coverage, use the source-owned
`smashcraft-animation` skill (`agents path smashcraft-animation`): its
reference library supplies Sakurai's impact/attack principles and the Fox
drill example; its procedure routes the existing motion audit, paired throws,
recovery clips and nine-way pain reactions. The project index of sources,
with URLs, verified timestamps and rights, is
smashcraft:docs/design/animation-reference.md. Reference pixels remain private.

Host tools that Bun runs (commands, runners, builds, captures, farm jobs) are
written as Effect programs when they start processes, wait, retry, hold a
resource or parse outside data. Load the effect-development skill before
designing one, and follow the four rules and examples in
smashcraft:docs/typescript.md, "Host tools". Map code compiled to Lua
stays plain TypeScript; pure calculations stay plain functions.
smashcraft:ts/test/effect-host-tools.test.ts enforces this.

Effect is the preferred foundation for Wisp's TypeScript tooling.
Read smashcraft:.agents/skills/effect/SKILL.md for Effect work and for the
weekly dependency/source update. The upstream repository is vendored at
smashcraft:repos/effect/ as read-only reference material: read its LLMS.md,
implementation and tests before choosing APIs. Import installed packages,
never the subtree. Upstream development instructions apply to upstream work,
not to Smashcraft's package manager, language or build commands.

## Verify the changed behavior

Portrait outfits: `bun tools/selection/render-fighters.ts --extract EXTRACTOR --assets PRIVATE_ASSETS --slots --reuse`
renders and checks the four slot outfits; omit `--slots` for the neutral grid.
The renderer extracts only the standing sequence with the existing clip tool
(Rifleman: 427,224 animation keys to 881), avoiding full-pool Blender imports.
See smashcraft:docs/design/fighter-portraits.md.

Every push runs the pre-push gate (smashcraft:.githooks/pre-push, enabled for
the repository with `git config core.hooksPath .githooks`; safe-push runs it):
`bun run check` and the type-escape audit (smashcraft:ts/test/source-shapes.test.ts)
when the pushed commits change ts/, the model facts check
(smashcraft:ts/test/model-facts.test.ts; it refuses with the `bun wisp view models`
refresh command) when they change clips or model build inputs, and client/ui's
type-check when they change it, in a few seconds (smashcraft:ts/scripts/prePush.ts).
It checks the working tree, so push from a clean checkout of the commit.

Main stays green. Each CI run on main opens, updates or closes the one
"main is red" issue (smashcraft:.github/workflows/main-red.yml), which lists the
failing tests and the first failing commit; the pre-push gate prints that list
on every push. A red main is not "already failing": before landing, check
whether your change touches a listed test, and if your commit broke main, fix
it first.
A push to a `claude/**` branch (a cloud worker's) lands on main by itself
when its full suite adds no failure to main's, and otherwise comments on the
referenced issue (smashcraft:docs/ci.md, "Autoland").

From smashcraft:ts/, use `bun test test/game.test.ts` for focused game tests,
`bun run check` for host and map type-checking, and
`LUA=<32-bit lua> bun scripts/lua-tests.ts` for emitted-Lua tests. Use
`bun wisp map build ...` to build a map. See smashcraft:docs/development-loop.md
for the local toolchain and base-map setup.

Pure simulation tests establish logical rules, not Warcraft callback timing,
physical-controller latency, UI focus or online fairness. For those claims,
use the native map and retain exact candidate, input path and measured evidence.
Consume the physics agent's published changes without silently overwriting its
work. Include all mutable gameplay state in deterministic snapshots/replay.

CPU observation histories retain shared samples through `copyBotMemory` and
release them through `clearBotMemory`; never assign one owner's history to
another. Observation checks stream canonical bytes, while replay text is
materialized on request. In Lua32, 100 warmed four-fighter observations plus
history copies used 0.011 KB/frame versus the previous 97.14 KB/frame observation
path. Keep this route allocation-free and use the unchanged
`playable-bot-four` performance fixture for whole-frame acceptance.

## Native testing and UI

Automated native match/rematch tests use one stock by default. A named workload
may use more stocks or a longer timer only when its required sample needs it;
record that reason beside the test (for example, #26's all-binding edge sample).
Keep ordinary combat completion intact; do not force a win to shorten a test.

Pick the clients by what the test needs (Tom, 7 Oct). The offline LAN pool
is the default for native testing: pad parity runs, captures, `accept`
checks and desync hunts.

Native lanes: four solo-profile lanes, one per client (a, b, c, d), share
the visual queue; pairs are only for sync and EX checks. A TypeScript-only
change (presentation values, effects, menus, CPU tuning) hot-reloads into one
running match with `bun wisp hot --data ... --watch` between captures; rebuild
the map only for imports, object data or art. Batch captures by build: one map
build serves every capture that needs it. Record captures per hour per lane in
the status.
Native `bun wisp pad` commands wait for an exclusive machine-capacity window
before client input and keep it through the whole batch (maximum 15 minutes).
To run four lanes together, start their foreground batch runner inside one
`machine-capacity run --class exclusive --timeout-seconds 900 -- ...` command;
pad children reuse that window. Separate exclusive commands queue in turn.
Each result records `load_average` and `capacity_lease` (#311).
Signed-in A and B are only for tests that need Battle.net itself: real
netplay or latency, direct play (#142), spectating. Tom's install (account a,
display :0) is Tom's. A run during which a client wrote a desync report or
crashed is invalid; read the autopsy line it printed
(wisp:docs/autopsy.md), rerun, and debug the desync with `bun wisp engine`.

Read warcraft-modding and its off-monitor dependency,
private-desktop-development, before controlling the game. Default automation off-monitor; use the primary display
for a requested hands-on trial. Preserve authenticated clients across map
iterations. Never direct-launch Warcraft as assumed authentication recovery.
Keep A/B in separate prefixes and use distinct online accounts. Credentials
belong in the encrypted machine configuration, never this repository or logs.

For changed custom UI, inspect the resolved Warcraft frame components before
raw positioning or click overlays. Run headless layout checks where supported,
then verify native hit targets, keyboard-focus release, draw order and
widescreen behavior. Keep local presentation separate from synchronized
gameplay and create shared handles consistently.

Don't publish releases, GitHub or otherwise, until Tom decides to release.
Playable candidates are private builds named Smashcraft 0.0.N; increment only N.
Internal diagnostics use distinct run IDs and names without advancing the
player release counter. Always identify the current playable artifact separately
from an experimental candidate; a diagnostic pass does not replace that release. Install one
current candidate under Maps/00-Smashcraft. Keep proprietary game assets and
base maps privately outside repository trees. Preserve peer work in owned lanes.
