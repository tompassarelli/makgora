import { SHIELD_ENERGY_SETUP } from "../../src/game/session/shieldEnergyCapture";
import { teamResultsCheck } from "./teamResultsCheck";
import { loserPoseChecks } from "./loserPoseChecks";
import { winCountChecks } from "./winCountChecks";
import { koboldDirectionChecks } from "./koboldDirectionChecks";
import { murlocStabChecks } from "./murlocStabChecks";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AcceptSuite, NativeCheck, Rule } from "wisp/scripts/wisp/accept";
import { QUICK_CPU_COMMAND, QUICK_HERO_COMMAND, QUICK_TRAINING_COMMAND } from "../../src/game/session/devSettings";
import { HIT_PRESENTATION_CASES } from "../../src/game/session/hitPresentationCases";
import { HERO_ROSTER } from "../../src/game/sim/heroes/registry";
import { STAGE_CATALOG } from "../../src/game/menu/stageCatalog";
import { FIGHTER_SEPARATION_CHECKS, FLOATING_STAGE_CHECKS, FLOATING_STAGE_MAPS, STAGE_COMPOSITION_CHECKS, STAGE_COMPOSITION_MAPS, STAGE_ENTRY_CHECKS, STAGE_ENTRY_MAPS, STAGE_FOG_CHECKS } from "./stageCompositionChecks";
import { gateChecks } from "./gateChecks";
import { specialStripChecks, specialStripMaps } from "./specialStripChecks";
import { newestPresentation } from "./presentationInputs";

const inputs = join(homedir(), ".local/share/smashcraft-build-inputs");

export interface SmashcraftMapProfile {
  readonly describe: string;
  readonly path: string;

  readonly rebuild?: string;

  readonly quick: string;

  readonly computers?: number;
}


const PRESENTATION = newestPresentation(inputs);
const LIGHTING = join(inputs, "visuals-170-20261007/Smashcraft diagnostic stage lighting.w3x");

const heroes = HERO_ROSTER.filter(({ complete }) => complete);
const rankedStages = STAGE_CATALOG.filter(({ id }) => id !== 0);
const stageProfile = (name: string) => `stage-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`;
const heroProfile = (name: string) => `hero-${name.toLowerCase().replace(/\s+/g, "-")}`;

/** Stands for the Classic map built from HEAD; accept swaps in the built file, or the --map it was given. */
export const CURRENT_CANDIDATE = "current-candidate";

export const MAP_PROFILES: Readonly<Record<string, SmashcraftMapProfile>> = {
  "gate-playable": { describe: "exact playable candidate, with ordinary selection and input", path: CURRENT_CANDIDATE, quick: "" },
  outfits: { describe: "four-colour portrait candidate, red Illidan and blue Rifleman", path: join(inputs, "slot-outfits-161-20261007/Smashcraft diagnostic slot portrait outfits.w3x"), quick: "-dev quick" },
  ...STAGE_COMPOSITION_MAPS,
  ...STAGE_ENTRY_MAPS,
  ...FLOATING_STAGE_MAPS,
  "unlit-contact": { describe: "retained 5a1815b4 map, tech spark without the contact light", path: join(inputs, "stage-presentation-r3-20261008/5a1815b4.w3x"), quick: "-dev quick" },
  "slash-unlit": { describe: "integrity map built at f9d0fbf3, slash hit spark without its contact light", path: join(inputs, "particles-192-20261008/before.w3x"), quick: "-dev quick" },
  "slash-lit": { describe: "integrity map built with the slash hit spark's contact light", path: join(inputs, "particles-192-20261008/after.w3x"), quick: "-dev quick" },
  presentation: { describe: "development map rebuilt from this checkout, `-dev quick` (Illidan and Rifleman idle on the default stage)", path: PRESENTATION, rebuild: "main", quick: "-dev quick" },
  "team-results": { describe: "development map rebuilt from this checkout, left at fighter select for the four-computer team setup", path: PRESENTATION, rebuild: "main", quick: "" },


  keyboard: { describe: "playable input (native-perf profile) rebuilt from this checkout, `-dev quick cpu wren expert` (Wren Expert, three stocks)", path: join(inputs, "keyboard-native-166-20261007/keyboard-native.w3x"), rebuild: "native-perf", quick: `${QUICK_CPU_COMMAND}wren expert` },
  underside: { describe: "development map built with scenario underside (smashcraft:docs/player-view.md), `-dev quick`", path: join(inputs, "stage-model-20261006/Smashcraft diagnostic underside.w3x"), quick: "-dev quick" },
  "cpu-startup": { describe: "development map rebuilt from this checkout, hosted with one lobby computer and left on fighter select", path: PRESENTATION, rebuild: "main", quick: "", computers: 1 },
  "shield-energy": { describe: "development map rebuilt from this checkout, held shield-down/full/mid/low samples with drawn-state receipts", path: PRESENTATION, rebuild: "main", quick: SHIELD_ENERGY_SETUP },
  training: { describe: "development map rebuilt from this checkout, `-dev quick training` (a computer partner shielding at 40%, hit areas on)", path: PRESENTATION, rebuild: "main", quick: QUICK_TRAINING_COMMAND },

  ...Object.fromEntries(rankedStages.map(({ id, name }) => [stageProfile(name), {
    describe: `development map rebuilt from this checkout, a quick match on ${name}`,
    path: PRESENTATION,
    rebuild: "main",
    quick: `-dev quick stage ${id}`,
  }])),
  ...Object.fromEntries(STAGE_CATALOG.map(({ id, name }) => [`lighting-${id}`, {
    describe: `development map with every stage lighting import; paused stock/stage comparison on ${name}`,
    path: LIGHTING,
    quick: `-dev quick stage ${id}`,
  }])),
  ...Object.fromEntries(heroes.map(({ name }) => [heroProfile(name), {
    describe: `development map rebuilt from this checkout, every human plays ${name}`,
    path: PRESENTATION,
    rebuild: "main",
    quick: `${QUICK_HERO_COMMAND}${name.toLowerCase()}`,
  }])),
  ...specialStripMaps(PRESENTATION),
};


const NO_ERRORS: Rule = { kind: "receipt", pattern: "^error \\d+ in ", max: 0 };

const DEV_RECEIPT: Rule = { kind: "receipt", pattern: "^SMASHCRAFT DEV v=1 ", min: 1 };

const NO_IMPORT_FAILURES: Rule = { kind: "log", pattern: "^model creation failed - war3mapImported", since: "session", max: 0 };

const EXPECTATIONS: Readonly<Record<number, string>> = {
  12: "a flash at stage centre, chest height (wall tech)",
  13: "a flash at stage centre, chest height (ceiling tech)",
  14: "a yellow shield-contact spark at stage centre, chest height (ledge catch)",
  15: "a brown dust cloud at stage centre, chest height (ledge recovery)",
  24: "a flash at stage centre, chest height (double jump)",
  2: "a blue lightning flash at stage centre, chest height (electric hit)",
  7: "a blue lightning flash at stage centre, chest height (electric shield hit)",
  5: "control for 2 and 7: an ice spark at stage centre",
  6: "control for 2 and 7: a shield spark at stage centre",
  4: "a spray of slash sparks at stage centre, chest height",
  9: "a large white column above and right of centre (shield break)",
  11: "a small dot at floor level (floor tech)",
  25: "a flash at stage centre, chest height (wall jump)",
  26: "two floor dust puffs (ordinary landing)",
};


const stageChecks: NativeCheck[] = rankedStages.map(({ name }): NativeCheck => ({
  id: `109-${stageProfile(name)}`,
  closes: "smashcraft#109 box 5",
  map: stageProfile(name),
  setup: [{ waitMs: 5000 }],
  capture: [{ kind: "frames", name: "match", client: "a" }, { kind: "frames", name: "match", client: "b" }],
  pass: [NO_IMPORT_FAILURES, NO_ERRORS],
  look: `${name}: sky, fog and scenery behind the fighting volume, no mirror-twin scenery or creatures, a themed main deck distinct from the fog, both fighters and the HUD drawn`,
}));


const lightingChecks: NativeCheck[] = STAGE_CATALOG.flatMap(({ id, name }): NativeCheck[] => [
  {
    id: `170-${id}-stock`, closes: "smashcraft#170 box 4", map: "floating-stages", session: "floating-stages",
    setup: [{ chat: "-dev reset" }, { chat: `-dev quick stage ${id}` }, { chat: "-dev view off" }, { waitMs: 5000 }, { keys: ["y"] }, { chat: "-dev lighting stock" }],
    capture: [{ kind: "frames", name: "stock", client: "a" }, { kind: "frames", name: "stock", client: "b" }],
    pass: [NO_IMPORT_FAILURES, NO_ERRORS], look: `${name}: paused fighters, sky, fog, scenery and deck; stock lighting reference`,
  },
  {
    id: `170-${id}-mask`, closes: "smashcraft#170 box 4", map: "floating-stages", session: "floating-stages",
    setup: [{ chat: "-dev backdrop off" }, { waitMs: 13000 }],
    capture: [{ kind: "frames", name: "mask", client: "a" }, { kind: "frames", name: "mask", client: "b" }],
    pass: [NO_ERRORS], look: `${name}: same paused fighters alone; no residual snow or fire in the fighter mask`,
  },
  {
    id: `170-${id}-stage`, closes: "smashcraft#170 box 4", map: "floating-stages", session: "floating-stages",
    setup: [{ chat: "-dev backdrop on" }, { chat: "-dev lighting stage" }, { waitMs: 1000 }],
    capture: [{ kind: "frames", name: "stage", client: "a" }, { kind: "frames", name: "stage", client: "b" }],
    pass: [NO_IMPORT_FAILURES, NO_ERRORS], look: `${name}: same paused pose and camera; neither |ΔL| nor ΔE00 reduced against stock; record any change to shadows; run smashcraft:tools/stage/contrast.ts on this pair`,
  },
]);


const effectChecks: NativeCheck[] = [12, 13, 14, 15, 24, 2, 7, 5, 6, 4, 9, 11, 25, 26].flatMap((index): NativeCheck[] => {
  const scenario = HIT_PRESENTATION_CASES[index];
  if (scenario === undefined) return [];
  const { model, sound } = scenario;
  return [{
    id: `82-effects-${index}`,
    closes: "smashcraft#82 box 2",
    map: "presentation",
    setup: [{ waitMs: 3000 }, { chat: `-dev effects ${index}` }, { receipt: "^SMASHCRAFT DEV v=1 ", seconds: 4 }],
    capture: [
      { kind: "frames", name: "centre", count: 6, everyMs: 50 },
      { kind: "reading", name: "label", pattern: `dev: effects ${index} (\\S+ \\S+)` },
    ],

    pass: [DEV_RECEIPT, NO_ERRORS, { kind: "reading", name: "label", pattern: `${model} ${sound}`, orLook: true }],
    look: EXPECTATIONS[index] ?? "the case's effect at stage centre",
  }];
});

const contactLightChecks: NativeCheck[] = (["before", "after"] as const).map((phase): NativeCheck => ({
  id: `192-tech-${phase}`, closes: "smashcraft#192 box 3", map: phase === "before" ? "unlit-contact" : "floating-stages", session: phase === "before" ? "contact-light" : "floating-stages",
  setup: [{ chat: "-dev reset" }, { chat: "-dev quick" }, { chat: "-dev view off" }, { waitMs: 5000 }, { chat: "-dev effects 12" }, { receipt: "^SMASHCRAFT DEV v=1 ", seconds: 4 }],
  capture: [{ kind: "frames", name: "contact", client: "a", count: 6, everyMs: 50 }],
  pass: [NO_IMPORT_FAILURES, NO_ERRORS, DEV_RECEIPT],
  look: `Tech contact ${phase}: compare the same chest-height spark, fighter surface and team colours at 50 ms intervals. The contact light must make the contact easier to read in HD; Classic retains the complete spark. Record graphics mode and native frame cost alongside the original #168 budget.`,
}));


const slashLightChecks: NativeCheck[] = (["before", "after"] as const).map((phase): NativeCheck => ({
  id: `192-slash-${phase}`, closes: "smashcraft#192 box 3", map: phase === "before" ? "slash-unlit" : "slash-lit", session: `slash-${phase}`,
  setup: [{ chat: "-dev reset" }, { chat: "-dev quick" }, { chat: "-dev view off" }, { waitMs: 5000 }, { chat: "-dev effects 4" }, { receipt: "^SMASHCRAFT DEV v=1 ", seconds: 4 }],
  capture: [{ kind: "frames", name: "contact", client: "a", count: 6, everyMs: 25 }, { kind: "reading", name: "label", pattern: "dev: effects 4 (\\S+ \\S+)" }],
  pass: [NO_IMPORT_FAILURES, NO_ERRORS, DEV_RECEIPT, { kind: "reading", name: "label", pattern: "ImpactHit- MetalLightSliceFlesh1", orLook: true }],
  look: `Slash hit ${phase}: the same chest-height spark at 25 ms intervals over its 150 ms life. After must light the nearer fighter's surface warm white and fade by 140 ms in Reforged; Classic shows the identical spark with no light. Record graphics mode and native frame cost against the #168 budget.`,
}));

export const SMASHCRAFT_ACCEPT: AcceptSuite = {
  maps: MAP_PROFILES,
  checks: [
    ...gateChecks(NO_ERRORS),
    {
      id: "123-selection", closes: "smashcraft#123 box 5", map: "presentation", session: "123-match-flow",
      setup: [
        { chat: "-dev reset" }, { chat: "-dev slots 1 2" }, { chat: "-dev stocks 1" },
        { chat: "-dev fighter 2 Illidan" }, { chat: "-dev stage 2" }, { chat: "-dev auto-rematch off" },
        { waitMs: 10000 }, { keys: ["r"], client: "a" }, { waitMs: 2000 },
      ],
      capture: [{ kind: "frames", name: "fighter-selection", client: "a" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "Record the selected client's isolated audio sink with the checks pool profile (music muted). During the selection wait, move its private pointer across roster cells; match MouseOver1 and BigButtonClick above every rival by normalized cross-correlation. Retain #123's accepted earlier sound measurements.",
    },
    {
      id: "123-countdown", closes: "smashcraft#123 box 5", map: "presentation", session: "123-match-flow",
      setup: [{ keys: ["y"], client: "a" }, { waitMs: 600 }, { keys: ["y"], client: "a" }],
      capture: [{ kind: "frames", name: "countdown", client: "a", count: 24, everyMs: 150 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "OCR reads the normal match's 3, 2, 1 and GO! calls from the retained frames.",
    },
    {
      id: "123-result", closes: "smashcraft#123 box 5", map: "presentation", session: "123-match-flow",
      setup: [{ receipt: "^parts [0-9]+$", client: "a", seconds: 600 }],
      capture: [{ kind: "frames", name: "game-and-results", client: "a", count: 16, everyMs: 150 }],
      pass: [NO_ERRORS, { kind: "receipt", pattern: "^parts [0-9]+$", client: "a", min: 1 }],
      look: "OCR reads GAME! and the results numbers; measure the winner's normally coloured pixels visible beside the panel. The one-stock match ends through ordinary combat against Illidan.",
    },
    {
      id: "161-slot-outfits", closes: "smashcraft#161 box 4", map: "outfits",
      setup: [{ waitMs: 3000 }],
      capture: [{ kind: "frames", name: "stage-and-hud", client: "a" }, { kind: "frames", name: "stage-and-hud", client: "b" }],

      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "In the same frame, Illidan's red clothing and Rifleman's blue hood on stage match their HUD busts and stock icons; frames alone are insufficient.",
    },
    {
      id: "185-cpu-preview", closes: "smashcraft#185 box 5", map: "presentation", session: "cpu-settings",
      setup: [
        { chat: "-dev reset" }, { chat: "-dev slots 3 4" },
        { keys: ["e", "e", "n", "w", "w", "w", "w", "w", "e", "r"], client: "a" },
        { waitMs: 300 },
      ],
      capture: [{ kind: "frames", name: "rook-advanced-panel", client: "a" }, { kind: "frames", name: "shared-cpu-card", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "CPU 3 shows Rook / Advanced with Reading habits and fighting up close; Watch for Hesitation at risky openings. Opponent precedes Difficulty; all panel text and buttons fit the widescreen client. Repeat using mapped stick/D-pad, A and X; retain actual helper menu_emit evidence. Confirm the settings button is below the chip drag target.",
    },
    {
      id: "185-cpu-focus-release", closes: "smashcraft#185 box 5", map: "presentation", session: "cpu-settings",
      setup: [{ keys: ["u", "n", "y"], client: "a" }, { waitMs: 300 }],
      capture: [{ kind: "frames", name: "start-closed-panel", client: "a" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "Back retains Rook / Advanced and returns focused Opponent settings; Choose reopens it. Start closes into fighter selection without starting a match. After release, focused controls and ordinary chip dragging still work; Enter opens Warcraft chat. Check mouse Close and the settings hit target on both 16:9 and the available wider client.",
    },
    {
      id: "161-neutral-grid-picked-outfits", closes: "smashcraft#161 box 4", map: "outfits",
      setup: [
        { chat: "-dev reset" }, { chat: "-dev fighter 1 Illidan", client: "a" }, { chat: "-dev fighter 2 Rifleman", client: "b" },
        { waitMs: 1500 },
      ],
      capture: [{ kind: "frames", name: "grid-and-picked-cards", client: "a" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "The roster grid stays neutral; picked player cards show red Illidan and blue Rifleman clothing.",
    },
    ...(["a", "b"] as const).map((client): NativeCheck => ({
      id: `174-defile-${client}`,
      closes: "smashcraft#174 box 2",
      map: heroProfile("Lich King"),
      session: "174-defile",
      setup: [{ waitMs: 3000 }, { keys: ["e+u"], client }],
      capture: [{ kind: "frames", name: "cast-and-pool", client, count: 16, everyMs: 50 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "He raises Frostmourne, plants its point in the floor and pulls it back. A dark pool spreads ahead with a crisp glowing danger edge, dim during warning and violet when armed. The edge flashes on each growth. Cast frames 60/380/560/700 in smashcraft:ts/test/native/pads/lich-king-defile.pad show the plant in both facings; 65/77 show warning/armed pool. The growth frames 696/732/768 in 174/growth.pad show three widening flashes. The cast script also checks repeated casts and an unhurt jump escape.",
    })),


    {
      id: "166-keyboard-match",
      closes: "smashcraft#166 box 3 (keyboard half)",
      map: "keyboard",
      setup: [
        { waitMs: 4000 },
        ...Array.from({ length: 60 }, (_, round) => [{ keys: round % 2 === 0 ? ["r", "n", "i", "n", "u"] : ["w", "n", "e", "o", "i"], client: "a" }, { waitMs: 500 }]).flat(),
        { receipt: "^parts [0-9]+$", client: "a", seconds: 600 },
      ],
      pass: [NO_ERRORS, { kind: "receipt", pattern: "^parts [0-9]+$", min: 1 }],
      look: "client A's replay (smashcraft-replay-N.txt with its parts) replays to its checksum with `LUA=<32-bit lua> bun wisp replay` and shows player 1's key presses",
    },
    {
      id: "166-controller-match",
      closes: "smashcraft#166 box 3 (controller half)",
      map: "keyboard",
      session: "166-controller",

      setup: [{ receipt: "^parts [0-9]+$", client: "a", seconds: 600 }],
      pass: [NO_ERRORS, { kind: "receipt", pattern: "^parts [0-9]+$", min: 1 }],
      look: "the controller log shows its key presses and client A's replay reaches its checksums with player 1's input",
    },
    {
      id: "169-render-clock",
      closes: "smashcraft#169 box 1 (callback cadence and cost; compare 60/144 fps reports)",
      map: "presentation",
      setup: [{ chat: "-dev render-clock" }, { receipt: "^render-clock run=[0-9]+ clock=", seconds: 12 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS, { kind: "receipt", pattern: "^render-clock run=[0-9]+ clock=running", min: 1 }],
      look: "native session owner: compare callback bursts and recording cost with renderer telemetry at 60 and 144 fps; a receipt alone does not establish a render-rate hook",
    },

    {
      id: "73-map-load",
      closes: "smashcraft#73 box 1",
      map: "presentation",
      setup: [{ waitMs: 2000 }],
      capture: [{ kind: "frames", name: "match", client: "a" }, { kind: "frames", name: "match", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "deck and fighters drawn on each client; run with client A's private desktop at 2880x1920 for the 3:2 box",
    },
    ...effectChecks,
    ...specialStripChecks([NO_IMPORT_FAILURES, NO_ERRORS]),
    ...stageChecks,
    ...lightingChecks,
    ...STAGE_COMPOSITION_CHECKS,
    ...STAGE_ENTRY_CHECKS,
    ...FLOATING_STAGE_CHECKS,
    ...STAGE_FOG_CHECKS,
    ...FIGHTER_SEPARATION_CHECKS,
    ...contactLightChecks,
    ...slashLightChecks,
    {
      id: "57-underside",
      closes: "smashcraft#57 box 2",
      map: "underside",
      capture: [{ kind: "frames", name: "underside", client: "a" }, { kind: "frames", name: "underside", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "the deck's underside edge at about 74% of the frame height, player 1 at about 62-72%, both above the HUD (about 82%)",
    },
    {
      id: "120-training",
      closes: "smashcraft#120 box 5",
      map: "training",
      setup: [{ waitMs: 3000 }],
      capture: [{ kind: "frames", name: "match", client: "a" }, { kind: "frames", name: "match", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "green body outlines on every fighter and the partner's shield, outlines on the fighters' plane; after an attack, the top-left readout (frames, advantage, combo) readable on both clients",
    },
    {
      id: "150-special-name",
      closes: "smashcraft#150 box 5 (readout half)",
      map: "training",
      setup: [{ waitMs: 3000 }, { keys: ["u"] }, { waitMs: 1500 }],
      capture: [{ kind: "frames", name: "readout", client: "a" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "after the neutral special, the top-left readout's first line names it (for example 'Swift Arrow: 34 total'), not 'Attack' or 'Special'",
    },

    {
      id: "278-cairne-double-jump",
      closes: "smashcraft#278 box 3",
      map: heroProfile("Cairne Bloodhoof"),
      setup: [{ waitMs: 3000 }, { keys: ["8"], holdMs: 150, client: "a" }, { waitMs: 300 }, { keys: ["8"], client: "a" }],
      capture: [{ kind: "frames", name: "double-jump", client: "a", count: 16, everyMs: 33 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "Cairne drawn on every frame of his double jump, knees lifting as he rises; no frame missing his body",
    },
    {
      id: "153-mana-full",
      closes: "smashcraft#153 box 5 (full bars)",
      map: heroProfile("Forsaken Paladin"),
      setup: [{ waitMs: 3000 }],
      capture: [{ kind: "frames", name: "full", client: "a" }, { kind: "frames", name: "full", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "a thin segmented blue bar (three segments) full over each fighter's head, and a matching full bar on each HUD plate",
    },
    {
      id: "153-mana-spent",
      closes: "smashcraft#153 box 5 (drain on specials)",
      map: heroProfile("Forsaken Paladin"),

      setup: [{ keys: ["r+u"] }, { waitMs: 900 }, { keys: ["r+u"] }, { waitMs: 900 }, { keys: ["r+u"] }, { waitMs: 900 }],
      capture: [{ kind: "frames", name: "spent", client: "a" }, { kind: "frames", name: "spent", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "player 1's bars about half full (over the head and on the plate), lower than player 2's; a rush that hit shows player 2's bar a little up",
    },
    {
      id: "153-mana-escape",
      closes: "smashcraft#153 box 5 (stacked with the escape meter)",
      map: heroProfile("Forsaken Paladin"),

      setup: [{ keys: ["o"] }, { waitMs: 150 }],
      capture: [{ kind: "frames", name: "held", client: "a", count: 4, everyMs: 120 }, { kind: "frames", name: "held", client: "b", count: 4, everyMs: 120 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "over the held fighter, the yellow escape meter with its blue mana bar just above it, not overlapping; the holder's mana bar alone over its head",
    },
    {
      id: "153-mana-refused",
      closes: "smashcraft#153 box 5 (refused special)",
      map: heroProfile("Forsaken Paladin"),

      setup: [{ waitMs: 1500 }, { keys: ["r+u"] }, { waitMs: 900 }, { keys: ["r+u"] }, { waitMs: 900 }, { keys: ["r+u"] }, { waitMs: 300 }, { keys: ["r+u"] }],
      capture: [{ kind: "frames", name: "refused", client: "a", count: 8, everyMs: 100 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "player 1's bars near empty and, in some frames, blinking red; no rush starts on the refused press",
    },
    {
      id: "c42-victory", closes: "smashcraft#7 C42N and smashcraft#31 box 4", map: "presentation", session: "c42-victory",
      setup: [
        { chat: "-dev reset" }, { chat: "-dev slots 1 2" }, { chat: "-dev fighter 2 Blademaster" },
        { chat: "-dev auto-rematch off" }, { chat: "-dev time 10" }, { chat: "-dev quick pair Rifleman / Blademaster" },
        { receipt: "^result frames=\\d+ winner=P2 timed-out=0 interrupted=0$", client: "a", seconds: 600 },
      ],
      capture: [{ kind: "frames", name: "victory-from-result", client: "a", count: 46, everyMs: 67 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS, { kind: "receipt", pattern: "^rules stocks=1 minutes=10$", client: "a", min: 1 }, { kind: "receipt", pattern: "^result frames=\\d+ winner=P2 timed-out=0 interrupted=0$", client: "a", min: 1 }],
      look: "Classic: idle Rifleman loses one stock to computer Blademaster by KO. Capture immediately on the first result receipt, then at roughly four-frame intervals for three seconds. The GAME call, drawn since #336 as the status-line words 'Computer wins!' with no centred text, holds about 1.5 s; then the results panel names Blademaster the winner. Across both, Blademaster plays his stock victory clip from its beginning, visibly different from Rifleman's clip. Judge the original strip and elapsed capture times; receipt polling and framebuffer reads can miss the first animation frame.",
    },
    {
      id: "c39-wren-match", closes: "smashcraft#7 C39N setup: the opening quick match's replay is written before the countdown check starts waiting", map: "presentation", session: "c39-countdown",
      setup: [
        { chat: "-dev reset" }, { chat: "-dev slots 1 0" }, { chat: "-dev auto-rematch on" }, { chat: `${QUICK_CPU_COMMAND}wren expert` },
        { receipt: "^SETUP phase=\\d+ human-fighters=1 computers=[1-9]\\d* .* stocks=3 ", client: "a", seconds: 10 }, { waitMs: 3000 },
      ],
      pass: [NO_ERRORS, DEV_RECEIPT],
    },
    {
      id: "c39-rematch-countdown", closes: "smashcraft#7 C39N and the E1 countdown box", map: "presentation", session: "c39-countdown",
      setup: [{ receipt: "^parts [0-9]+$", client: "a", seconds: 600 }],
      capture: [{ kind: "frames", name: "countdown", client: "a", count: 200, everyMs: 50 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "After the first match ends, the rematch seconds 5 to 1 and then the next match's 3, 2, 1, GO! each appear centred on the stage, popping in and fading out; the next match's fighters stay held until GO!.",
    },
    teamResultsCheck([NO_IMPORT_FAILURES, NO_ERRORS, DEV_RECEIPT]),
    ...loserPoseChecks([NO_IMPORT_FAILURES, NO_ERRORS]),
    ...winCountChecks(NO_ERRORS, NO_IMPORT_FAILURES),
    ...koboldDirectionChecks(heroProfile("Kobold"), [NO_IMPORT_FAILURES, NO_ERRORS]),
    ...murlocStabChecks(heroProfile("Murloc"), [NO_IMPORT_FAILURES, NO_ERRORS]),
    ...(["first", "second"] as const).map((order): NativeCheck => ({
      id: `c40-cpu-startup-${order}`, closes: "smashcraft#7 C40N", map: "cpu-startup", session: `cpu-startup-${order}`,
      setup: [{ waitMs: 8000 }, { chat: "-dev stocks 3" }, { receipt: "^SMASHCRAFT DEV v=1 ", client: "a", seconds: 10 }, { receipt: "^SMASHCRAFT DEV v=1 ", client: "b", seconds: 10 }, { keys: ["Escape"], client: "a" }, { keys: ["Escape"], client: "b" }, { waitMs: 500 }],
      capture: [{ kind: "frames", name: "fighter-select", client: "a" }, { kind: "frames", name: "fighter-select", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS, { kind: "receipt", client: "a", pattern: "^SETUP .* computers=[1-9]", min: 1 }, { kind: "receipt", client: "b", pattern: "^SETUP .* computers=[1-9]", min: 1 }],
      look: "With each client's first-run Controls panel closed, the computer's starting fighter in SETUP characters= is the same on both clients and matches both fighter-select frames; it differs between the first and second session.",
    })),
    {
      id: "c37-mount", closes: "smashcraft#10 C37N", map: "presentation", session: "c37-platforms",
      setup: [{ chat: "-dev reset" }, { chat: "-dev slots 3 0" }, { chat: "-dev quick stage 2" }, { waitMs: 4000 }, { keys: ["8"], holdMs: 150, client: "a" }],
      capture: [{ kind: "frames", name: "mount", client: "a", count: 16, everyMs: 100 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "On Frozen Throne player 1 jumps, rises through the platform above and lands on it with the ordinary landing puff.",
    },
    {
      id: "c37-drop", closes: "smashcraft#10 C37N", map: "presentation", session: "c37-platforms",
      setup: [{ waitMs: 500 }, { keys: ["s"], client: "a" }],
      capture: [{ kind: "frames", name: "drop", client: "a", count: 16, everyMs: 100 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "Standing on the platform, one fresh down press drops player 1 through it at once.",
    },
    {
      id: "c37-remount", closes: "smashcraft#10 C37N", map: "presentation", session: "c37-platforms",
      setup: [{ waitMs: 1500 }, { keys: ["8"], holdMs: 150, client: "a" }],
      capture: [{ kind: "frames", name: "remount", client: "a", count: 16, everyMs: 100 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "Player 1 jumps back up through the platform and lands on it again.",
    },
    {
      id: "c37-repress", closes: "smashcraft#10 C37N", map: "presentation", session: "c37-platforms",
      setup: [{ waitMs: 500 }, { keys: ["s"], client: "a" }],
      capture: [{ kind: "frames", name: "repress", client: "a", count: 16, everyMs: 100 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "A second fresh down press drops player 1 through the platform again.",
    },
    {
      id: "c43-phased-opacity-roster", closes: "smashcraft#383 (roster)", map: "presentation", session: "c43-phased",
      setup: [{ chat: "-dev reset" }, { chat: "-dev quick pair Dreadlord / Lich" }, { waitMs: 4000 }, { keys: ["q+s"], client: "b" }],
      capture: [{ kind: "frames", name: "spot-dodge", client: "a", count: 16, everyMs: 33 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "Player 2's Lich, the roster's other alpha-keyed body beside Dreadlord, spot dodges: drawn on every intangible frame, robe and skull intact, then fully opaque again.",
    },
    {
      id: "c43-phased-opacity-lifecycle", closes: "smashcraft#383 (lifecycle)", map: "presentation", session: "c43-phased",
      setup: [{ chat: "-dev reset" }, { chat: "-dev quick hero Dreadlord stocks 3" }, { waitMs: 4000 }, { keys: ["a"], holdMs: 1500, client: "a" }],
      capture: [{ kind: "frames", name: "respawn", client: "a", count: 30, everyMs: 120 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "Player 1's Dreadlord walks off the left edge and loses a stock; he respawns on the platform see-through yet drawn on every frame of his 90-frame invincibility, wings and all, then turns fully opaque when it ends.",
    },
    {
      id: "c43-phased-opacity-hit-status", closes: "smashcraft#383 (hit status)", map: "presentation", session: "c43-phased",
      setup: [
        { chat: "-dev reset" }, { chat: "-dev quick pair Kael'thas Sunstrider / Dreadlord" }, { waitMs: 4000 },
        { keys: ["d"], holdMs: 600, client: "a" }, { keys: ["s+u"], client: "a" }, { waitMs: 250 },
      ],
      capture: [{ kind: "frames", name: "banish", client: "a", count: 14, everyMs: 120 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "Kael'thas's Banish lands on player 2's Dreadlord: the victim turns green and see-through yet stays drawn on every frame of the 90-frame status, then returns to full colour and opacity.",
    },
    {
      id: "482-shield-energy", closes: "smashcraft-dev#482 box 3 (Classic)", map: "shield-energy", session: "482-shield",
      setup: [{ chat: "-dev reset" }, { chat: SHIELD_ENERGY_SETUP }],
      capture: [{ kind: "frames", name: "shield-down-full-mid-low", client: "a", count: 4 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS, ...["down", "full", "mid", "low"].map(sample => ({ kind: "receipt" as const, client: "a", pattern: `^SMASHCRAFT SHIELD sample=${sample} .* pass=1$`, min: 1, max: 1 }))],
      look: "Four held frames in order: shield down, full, mid, low. Each frame has a SMASHCRAFT SHIELD receipt with frame, raised, energy, and centreX/centreZ/radius from the drawn pose. The partner holds its shield while energy drains naturally. Compare the bubble with the receipt geometry. Classic raised=T with no visible bubble is FAIL, never RECAPTURE.",
    },
    {
      id: "406-voice-trace", closes: "smashcraft-dev#406 box 4 (voice cap half)", map: "presentation", session: "406-voices",
      setup: [{ chat: "-dev reset" }, { chat: "-dev slots 1 14" }, { chat: `${QUICK_CPU_COMMAND}wren expert` }, { waitMs: 8000 }, { keys: ["ctrl+t"], client: "a" }, { waitMs: 7000 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "wc3-melee-input-trace.txt on client a holds per-voice lines `frame F class C slot S live L` with every L <= 16.",
    },
    ...heroes.map(({ name }): NativeCheck => ({
      id: `96-hero-${heroProfile(name).slice(5)}`,
      closes: "smashcraft#96 box 5",
      map: heroProfile(name),
      setup: [{ waitMs: 3000 }],
      capture: [{ kind: "frames", name: "match", client: "a" }, { kind: "frames", name: "match", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: `${name} drawn with its model and animations on both clients, and the HUD mana label placed beside its portrait`,
    })),
  ],
};
