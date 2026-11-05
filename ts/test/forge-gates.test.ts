import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { balanceMatchups } from "../scripts/balancePlan";
import baseline from "../scripts/balanceBaseline.json";
import { FORGE_FIGHTERS, FORGE_STAGES, gatedFighters, gatedSlugs, isFeatured, setForgeRoster } from "../src/game/roster/forge";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/roster/kits";

const ROOT = join(import.meta.dir, "..");
const WORKFLOWS = "../.github/workflows";
const ROSTER_LIST = /\b(?:SELECTABLE_CHARACTERS|PLAYABLE_CHARACTERS)\b/;
const GATE_HELPER = /\b(?:gatedFighters|gatedSlugs)\b/;

const CAPTURE = "capture, strip and drift tooling that renders any fighter a developer names";
const SYNC = "determinism, sync, soak and native-smoke coverage of every pickable fighter, which protects players who turn the Forge toggle on";
const LOOKUP = "resolves one fighter by slug or name, so a Forge fighter stays reachable by name";
const MENU = "menu, selection and lobby correctness: every pickable fighter must be offered";
const SPAWN = "load and spawn correctness: every pickable fighter has its models, costumes and move list";
const REPORT = "report generator that lists every fighter and gates nothing";
const FIGHTER = "tests one fighter's own kit";

const CORRECTNESS: Readonly<Record<string, string>> = {
  "scripts/captureQueueServe.ts": CAPTURE,
  "scripts/captureQueue.ts": CAPTURE,
  "scripts/nativeCapturePlan.ts": CAPTURE,
  "scripts/painStrip.ts": CAPTURE,
  "scripts/poseDrift.ts": CAPTURE,
  "scripts/comboExplorer.ts": LOOKUP,
  "scripts/wisp/commands/perf.ts": LOOKUP,
  "scripts/wisp/perfLua.ts": LOOKUP,
  "scripts/wisp/commands/view.ts": REPORT,
  "scripts/soundTable.ts": REPORT,
  "scripts/ledger/attributes.ts": REPORT,
  "scripts/playtest.ts": SYNC,
  "scripts/wisp/soak.ts": SYNC,
  "scripts/wisp/memoryLua.ts": SYNC,
  "scripts/wisp/netAcceptance.ts": SYNC,
  "scripts/wisp/standaloneGame.ts": SPAWN,
  "scripts/wisp/commands/smoke.ts": SYNC,
  "scripts/wisp/nativeSmoke.ts": SYNC,
  "scripts/wisp/smokeShards.ts": SYNC,
  "scripts/wisp/gateBindings.ts": SYNC,
  "scripts/wisp/gateMoves.ts": SYNC,
  "scripts/wisp/gateResults.ts": SYNC,
  "scripts/wisp/gateStart.ts": SYNC,
  "test/captureStage.test.ts": SPAWN,
  "test/costume-colors.test.ts": SPAWN,
  "test/forge-lobby.test.ts": MENU,
  "test/move-list-forge.test.ts": SPAWN,
  "test/rifleman-removed.test.ts": MENU,
  "test/standalonePreload.test.ts": SPAWN,
  "src/game/arcade/tables.tests.ts": MENU,
  "src/game/arcade/tierSelect.tests.ts": MENU,
  "src/game/fighters/blademaster/specials.tests.ts": FIGHTER,
  "src/game/fighters/kaelthas/siphonMana.tests.ts": FIGHTER,
  "src/game/lobby/cpuRandomFighter.tests.ts": MENU,
  "src/game/lobby/cpuTiers.tests.ts": MENU,
  "src/game/match/orbs.tests.ts": SPAWN,
  "src/game/match/tutorial.tests.ts": MENU,
  "src/game/presentation/fighterDraw.tests.ts": SPAWN,
  "src/game/presentation/menuCues.tests.ts": MENU,
  "src/game/roster/forge.tests.ts": MENU,
  "src/game/sim/lichFloat.tests.ts": FIGHTER,
  "src/game/ui/namePlate.tests.ts": MENU,
  "src/game/ui/nativeChat.tests.ts": MENU,
  "src/game/ui/plateLayout.tests.ts": MENU,
  "src/game/ui/selectionFrames.tests.ts": MENU,
};

function sources(): string[] {
  const files = readdirSync(ROOT, { recursive: true, encoding: "utf8" }).filter(file => !file.includes("node_modules") && file.endsWith(".ts"));
  return files.filter(file => file.startsWith("scripts/") || file.startsWith("test/") || (file.startsWith("src/") && file.endsWith(".tests.ts"))).map(file => relative(".", file)).concat(readdirSync(join(ROOT, WORKFLOWS)).filter(file => file.endsWith(".yml")).map(file => join(WORKFLOWS, file))).sort();
}

const text = (file: string): string => readFileSync(join(ROOT, file), "utf8");

test("every balance and quality script, test or workflow that lists the whole roster uses the gated helper or is a named correctness tool [k1 scenario]", () => {
  const wholeRoster = sources().filter(file => ROSTER_LIST.test(text(file.replace(/^\.\//, "")))).filter(file => !file.endsWith("forge-gates.test.ts"));
  const ungated = wholeRoster.filter(file => !GATE_HELPER.test(text(file)) && CORRECTNESS[file] === undefined);
  expect(ungated).toEqual([]);
  const stale = Object.keys(CORRECTNESS).filter(file => !wholeRoster.includes(file) || GATE_HELPER.test(text(file)));
  expect(stale).toEqual([]);
});

test("the gated fighters are the featured ones, and the balance baseline holds exactly them [k1 scenario]", () => {
  expect(gatedFighters()).toEqual(SELECTABLE_CHARACTERS.filter(isFeatured));
  expect(gatedFighters().length).toBe(SELECTABLE_CHARACTERS.length - FORGE_FIGHTERS.length);
  for (const slug of FORGE_FIGHTERS) expect(gatedSlugs()).not.toContain(slug);
  expect(Object.keys(baseline).sort()).toEqual(gatedSlugs().slice().sort());
});

test("removing a slug from the Forge adds that fighter to the balance plan [k1 scenario]", () => {
  const promoted = FORGE_FIGHTERS[0]!;
  const before = balanceMatchups();
  expect(before.some(pair => pair.split(":").includes(promoted))).toBe(false);
  setForgeRoster(FORGE_FIGHTERS.filter(slug => slug !== promoted), FORGE_STAGES);
  try {
    const after = balanceMatchups();
    expect(gatedSlugs()).toContain(promoted);
    expect(after.length).toBe(before.length + gatedSlugs().length - 1);
    expect(after.filter(pair => pair.split(":").includes(promoted)).length).toBe(gatedSlugs().length - 1);
    expect(gatedFighters().map(fighterSlug)).toContain(promoted);
  } finally {
    setForgeRoster(FORGE_FIGHTERS, FORGE_STAGES);
  }
});
