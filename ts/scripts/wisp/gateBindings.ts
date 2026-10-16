import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { InputInjection } from "wisp/scripts/platform/services";
import { batch, capture, click, focus, frameWords, loadClients } from "wisp/scripts/warcraft/desktop";
import { encodePpm } from "wisp/scripts/wisp/frameProbe";
import { preloadLines } from "wisp/scripts/wisp/preloadRecord";
import { Action, bit } from "../../src/game/input/actions";
import { cellRect, rosterGrid } from "../../src/game/menu/selectionGrid";
import { parkedChipLeft, readyChipSize } from "../../src/game/menu/selectionDrag";
import { PLAYABLE_CHARACTERS } from "../../src/game/sim/heroes/registry";
import { Phase } from "../../src/game/lobby/lobbyState";
import { PLAYABLE_BUILD } from "../../src/game/session/currentBuild";
import { journalMenuFile } from "../../src/game/core/gameFiles";
import { gameProcess } from "../integrity/capture";
import { inject, openPad } from "../integrity/linux";
import { ABS_X, ABS_Y, ABS_Z, ABS_RX, ABS_RY, ABS_RZ, BTN_A, BTN_B, BTN_X, BTN_Y, BTN_TL, BTN_TR, BTN_START, EV_ABS, EV_KEY, PAD_BUTTONS } from "../integrity/linuxInput";
import { runProcess, startInputProcess } from "../hostProcess";
import { pollUntil } from "../hostPoll";
import { JournalMenu, ResponsePage } from "./boundary";
import { SERVICE_LAUNCHER } from "./controllerService";
import { projectRoot } from "./project";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });
const Contract = Schema.fromJsonString(Schema.Struct({ map_actions: Schema.Record(Schema.String, Schema.String) }));
const QUALIFIED_HELPER_SHA256 = "a127a5ce147aa4fc4edc168475ea9583cb8c5cc7656a6d717d278106de0ce6d2";
const Metadata = Schema.fromJsonString(Schema.Struct({ packages: Schema.Array(Schema.Struct({ name: Schema.String, manifest_path: Schema.String, source: Schema.NullOr(Schema.String) })) }));
const controls: Readonly<Record<string, readonly [number, number]>> = {
  "button a": [EV_KEY, BTN_A], "button b": [EV_KEY, BTN_B], "button x": [EV_KEY, BTN_X], "button y": [EV_KEY, BTN_Y],
  "button leftshoulder": [EV_KEY, BTN_TL], "button rightshoulder": [EV_KEY, BTN_TR], "button start": [EV_KEY, BTN_START],
  "axis leftx": [EV_ABS, ABS_X], "axis lefty": [EV_ABS, ABS_Y], "axis rightx": [EV_ABS, ABS_RX], "axis righty": [EV_ABS, ABS_RY],
  "axis lefttrigger": [EV_ABS, ABS_Z], "axis righttrigger": [EV_ABS, ABS_RZ],
};
const actions: Readonly<Record<string, Action>> = {
  attack: Action.attack, special: Action.special, jump: Action.jump, grab: Action.grab,
  shield: Action.leftTrigger, rightTrigger: Action.rightTrigger, lightShield: Action.lightShield,
  shortHop: Action.shortHop, exSpecial: Action.exSpecial, moveLeft: Action.moveLeft, moveRight: Action.moveRight,
  moveUp: Action.moveUp, moveDown: Action.moveDown, smashLeft: Action.smashLeft,
  smashRight: Action.smashRight, smashUp: Action.smashUp, smashDown: Action.smashDown,
};
const samples = [
  ["Attack", "button a", 1, 0, "smash", "full"],
  ["Grab", "button b", 1, 0, "smash", "full"],
  ["Special", "button x", 1, 0, "smash", "full"],
  ["Jump", "button y", 1, 0, "smash", "full"],
  ["Short hop", "button leftshoulder", 1, 0, "smash", "full"],
  ["EX special", "button rightshoulder", 1, 0, "smash", "full"],
  ["Shield", "axis lefttrigger", 32767, 0, "smash", "full"],
  ["Right shield", "axis righttrigger", 32767, 0, "smash", "full"],
  ["Pause", "button start", 1, 0, "smash", "full"],
  ["Move left", "axis leftx", -32768, 0, "smash", "full"],
  ["Move right", "axis leftx", 32767, 0, "smash", "full"],
  ["Crouch / fast fall", "axis lefty", 32767, 0, "smash", "full"],
  ["Up (aim, up special)", "axis lefty", -32768, 0, "smash", "full"],
  ["Up smash", "axis righty", -32768, 0, "smash", "full"],
  ["Down smash", "axis righty", 32767, 0, "smash", "full"],
  ["Smash left", "axis rightx", -32768, 0, "smash", "full"],
  ["Smash right", "axis rightx", 32767, 0, "smash", "full"],
  ["Up tilt / up air", "axis righty", -32768, 0, "tilt", "full"],
  ["Down tilt / down air", "axis righty", 32767, 0, "tilt", "full"],
  ["Tilt left / air left", "axis rightx", -32768, 0, "tilt", "full"],
  ["Tilt right / air right", "axis rightx", 32767, 0, "tilt", "full"],
  ["Light shield", "axis lefttrigger", 32767, 0, "smash", "light"],
  ["Light shield", "axis righttrigger", 32767, 0, "smash", "light"],
] as const;

export const measureBindingsGate = (clientsFile: string, name: string, directory: string, appIds: ReadonlyMap<string, string>) => Effect.gen(function*() {
  const clients = yield* loadClients(clientsFile).pipe(Effect.mapError(fail("bindings gate clients")));
  const client = clients.find(client => client.name === name);
  const appId = appIds.get(name);
  if (client === undefined || appId === undefined) return yield* new AcceptFailure({ operation: "bindings gate", problem: `no offline selected client ${name}` });
  const metadata = yield* runProcess(ChildProcess.make("cargo", ["metadata", "--locked", "--offline", "--format-version=1"], { cwd: join(projectRoot, "controller"), stdin: "ignore" })).pipe(Effect.flatMap(Schema.decodeEffect(Metadata)), Effect.mapError(fail("bindings gate controller contract")));
  const dependency = metadata.packages.find(packageInfo => packageInfo.name === "padbridge");
  if (dependency === undefined) return yield* new AcceptFailure({ operation: "bindings gate contract", problem: "pinned padbridge package missing" });
  const contractPath = join(dirname(dependency.manifest_path), "contract/bindings.json");
  const contractText = yield* Effect.try({ try: () => readFileSync(contractPath, "utf8"), catch: cause => new AcceptFailure({ operation: "bindings gate contract", problem: String(cause) }) });
  const contract = yield* Schema.decodeEffect(Contract)(contractText).pipe(Effect.mapError(fail("bindings gate contract")));
  const labels = Object.keys(contract.map_actions);
  if (labels.some(label => !samples.some(sample => sample[0] === label)) || samples.some(sample => contract.map_actions[sample[0]] === undefined)) return yield* new AcceptFailure({ operation: "bindings gate contract", problem: "native samples and shipped contract labels differ" });
  const helper = Bun.env.SMASHCRAFT_BINDINGS_HELPER ?? SERVICE_LAUNCHER;
  const remaps = Bun.env.SMASHCRAFT_BINDINGS_REMAPPINGS;
  const helperSha256 = yield* Effect.try({ try: () => createHash("sha256").update(readFileSync(helper)).digest("hex"), catch: cause => new AcceptFailure({ operation: "bindings gate helper", problem: String(cause) }) });
  if (helperSha256 !== QUALIFIED_HELPER_SHA256) return yield* new AcceptFailure({ operation: "bindings gate helper", problem: `unqualified SHA256 ${helperSha256}` });
  yield* Effect.try({ try: () => mkdirSync(directory, { recursive: true, mode: 0o700 }), catch: cause => new AcceptFailure({ operation: "bindings gate evidence", problem: String(cause) }) });
  const pid = yield* gameProcess(client, false).pipe(Effect.mapError(fail("bindings gate process")));
  const input = yield* InputInjection;
  const region = yield* input.windowRegion(client).pipe(Effect.mapError(fail("bindings gate viewport")));
  const data = join(client.documents, "CustomMapData");
  const pad = yield* openPad(PAD_BUTTONS).pipe(Effect.mapError(fail("bindings gate virtual pad")));
  const selectedPad = yield* pollUntil(runProcess(ChildProcess.make(helper, ["--list"], { env: { ...Bun.env, ...client.x11, ...client.wayland }, stdin: "ignore" })).pipe(
    Effect.map(output => {
      const id = output.split("\n").find(line => line.includes(`path=Some("${pad.device}")`))?.match(/^gamepad id=(\d+) /)?.[1];
      return id === undefined ? undefined : { id, listing: output };
    }),
    Effect.mapError(fail("bindings gate gamepad")),
  ), { every: "100 millis", within: "5 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "bindings gate gamepad", problem: `SDL did not enumerate ${pad.device}` })) });
  const gamepad = selectedPad.id;
  const send = (control: string, value: number) => Effect.try({
    try: () => {
      const edge = controls[control];
      if (edge === undefined) throw new Error(`no physical control ${control}`);
      return inject(pad, { type: edge[0], code: edge[1], value });
    },
    catch: cause => new AcceptFailure({ operation: "bindings gate input", problem: String(cause) }),
  });
  const save = (file: string, bytes: string | Uint8Array) => Effect.try({ try: () => writeFileSync(join(directory, file), bytes, { mode: 0o600 }), catch: cause => new AcceptFailure({ operation: "bindings gate evidence", problem: String(cause) }) });
  yield* save("gamepad.txt", selectedPad.listing);
  const menu = () => Effect.try({
    try: () => {
      const file = journalMenuFile(PLAYABLE_BUILD.id, 0);
      return { file, modified: statSync(join(data, file)).mtimeMs };
    },
    catch: cause => new AcceptFailure({ operation: "bindings gate menu", problem: String(cause) }),
  }).pipe(Effect.flatMap(latest => latest === undefined ? Effect.fail(new AcceptFailure({ operation: "bindings gate menu", problem: "no current menu journal" })) : JournalMenu.decode(latest.file, readFileSync(join(data, latest.file), "latin1")).pipe(Effect.map(value => ({ ...value, file: latest.file, modified: latest.modified })), Effect.mapError(fail("bindings gate menu")))));
  const startHelper = (stick: string, triggers: string) => startInputProcess([
    helper, "--watch-seconds", "180", "--preset", "tom", "--gamepad", gamepad, "--emit",
    "--right-stick", stick, "--left-trigger", triggers, "--right-trigger", triggers,
    ...(remaps === undefined ? [] : ["--remaps", remaps]),
    "--display", client.x11.DISPLAY ?? "", "--x11-window", client.window, "--pid", String(pid), "--private-wlr-app-id", appId,
  ], { env: { ...Bun.env, ...client.x11, ...client.wayland }, stderr: join(directory, `helper-${stick}-${triggers}.log`) }).pipe(Effect.mapError(fail("bindings gate helper")));
  const initial = yield* menu();
  if (initial.phase !== "CHARACTER") return yield* new AcceptFailure({ operation: "bindings gate setup", problem: `expected CHARACTER, got ${initial.phase}` });
  const grid = rosterGrid(PLAYABLE_CHARACTERS.length);
  for (const [slot, selected] of clients.entries()) {
    yield* focus(selected).pipe(Effect.mapError(fail("bindings gate setup")));
    const viewport = yield* input.windowRegion(selected).pipe(Effect.mapError(fail("bindings gate setup")));
    const pixels = yield* capture(selected, viewport).pipe(Effect.mapError(fail("bindings gate setup")));
    const words = yield* frameWords(selected, pixels, "light").pipe(Effect.mapError(fail("bindings gate tutorial")));
    const notNow = words.find(word => word.text === "Not");
    if (notNow !== undefined) yield* click(selected, viewport.x + notNow.x, viewport.y + notNow.y).pipe(Effect.mapError(fail("bindings gate tutorial")));
    const point = (x: number, y: number) => ({ x: Math.round(viewport.x + (viewport.width - viewport.height * 4 / 3) / 2 + x * viewport.height / 0.6), y: Math.round(viewport.y + viewport.height - y * viewport.height / 0.6) });
    const pin = point(parkedChipLeft(slot, readyChipSize(grid)) + readyChipSize(grid) / 2, 0.17);
    const cell = cellRect(grid, slot);
    const drop = point((cell.left + cell.right) / 2, (cell.top + cell.bottom) / 2);
    yield* click(selected, pin.x, pin.y).pipe(Effect.mapError(fail("bindings gate pick")));
    yield* click(selected, drop.x, drop.y).pipe(Effect.mapError(fail("bindings gate drop")));
  }
  yield* focus(client).pipe(Effect.mapError(fail("bindings gate focus")));
  const phases = [initial];
  yield* Effect.scoped(Effect.gen(function*() {
    yield* startHelper("smash", "full");
    yield* Effect.sleep("500 millis");
    for (const wanted of ["STAGE", "BLOCKED"] as const) {
      yield* send("button start", 1);
      yield* Effect.sleep("150 millis");
      yield* send("button start", 0);
      const phase = yield* pollUntil(menu().pipe(Effect.map(receipt => receipt.phase === wanted && receipt.modified > initial.modified ? receipt : undefined)), { every: "100 millis", within: "10 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "bindings gate Start", problem: `no ${wanted} journal transition` })) });
      phases.push(phase);
    }
  }));
  yield* Effect.sleep("2 seconds");
  const measured: { label: string; control: string; stick: string; triggers: string; run: number; file: string; sha256: string; lines: readonly string[]; pass: boolean }[] = [];
  for (const [stick, triggers] of [["smash", "full"], ["tilt", "full"], ["smash", "light"]] as const) yield* Effect.scoped(Effect.gen(function*() {
    yield* startHelper(stick, triggers);
    yield* Effect.sleep("500 millis");
    for (const [label, control, down, up, rightStick, triggerMode] of samples) {
      if (rightStick !== stick || triggerMode !== triggers) continue;
      for (const boundary of label === "Pause" ? ["paused", "resumed"] as const : ["sample"] as const) {
        yield* Effect.sleep("1 second");
        const started = Date.now();
        yield* batch(client, [{ kind: "keys", keys: ["ctrl+F5"] }]).pipe(Effect.mapError(fail("bindings gate probe start")));
        yield* send(control, down);
        yield* Effect.sleep("350 millis");
        if (label === "Pause") yield* send(control, up);
        yield* batch(client, [{ kind: "keys", keys: ["ctrl+F7"] }]).pipe(Effect.mapError(fail("bindings gate probe export")));
        const page = yield* pollUntil(Effect.try({
          try: () => readdirSync(data).filter(file => /^smashcraft-response-p0-run\d+-page0\.txt$/.test(file) && statSync(join(data, file)).mtimeMs >= started).sort((a, b) => Number(/run(\d+)/.exec(b)?.[1]) - Number(/run(\d+)/.exec(a)?.[1]))[0],
          catch: cause => new AcceptFailure({ operation: "bindings gate journal", problem: String(cause) }),
        }), { every: "100 millis", within: "5 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "bindings gate journal", problem: `no fresh response page for ${label}` })) });
        const text = readFileSync(join(data, page), "latin1");
        const decoded = yield* ResponsePage.decode(page, text).pipe(Effect.mapError(fail("bindings gate journal")));
        const lines = preloadLines(text) ?? [];
        const expected = contract.map_actions[label];
        const action = expected === undefined ? undefined : actions[expected];
        const mask = action === undefined ? undefined : bit(action);
        const rows = lines.filter(line => /^B \d+ /.test(line)).map(line => line.split(" ").slice(1).map(Number));
        const edges = lines.filter(line => /^I \d+ confirmed /.test(line)).map(line => line.split(" ").slice(1));
        const frames = new Map(lines.filter(line => /^A \d+ /.test(line)).map(line => {
          const row = line.split(" ").slice(1).map(Number);
          return [row[0], row[7]] as const;
        }));
        const matched = rows.some(row => row[5] === Phase.match && (label === "Pause" ? lines.some(line => new RegExp(`^I \\d+ pause-boundary ${boundary} \\d+$`).test(line)) : mask !== undefined && ((row[1] ?? 0) & mask) !== 0 && edges.some(edge => Number(edge[3]) === 0 && (Number(edge[6]) & mask) !== 0 && Number(edge[4]) <= (frames.get(row[0]) ?? -1))));
        const shield = expected === "shield" || expected === "rightTrigger" || expected === "lightShield";
        const raised = !shield || rows.some(row => row[5] === Phase.match && row[6] === 1 && mask !== undefined && ((row[1] ?? 0) & mask) !== 0);
        const image = encodePpm(yield* capture(client, region).pipe(Effect.mapError(fail("bindings gate capture"))));
        if (label !== "Pause") yield* send(control, up);
        const stem = `${String(boundary === "resumed" ? measured.length - 1 : measured.length).padStart(2, "0")}-${control.replaceAll(" ", "-")}-${stick}-${triggers}${boundary === "resumed" ? "-resumed" : ""}`;
        yield* save(`${stem}.ppm`, image);
        yield* save(`${stem}.txt`, text);
        if (boundary === "resumed") {
          const paused = measured[measured.length - 1];
          if (paused === undefined) return yield* new AcceptFailure({ operation: "bindings gate Pause", problem: "missing paused measurement" });
          paused.pass = paused.pass && matched;
        } else measured.push({ label, control, stick, triggers, run: decoded.run, file: `${stem}.ppm`, sha256: createHash("sha256").update(image).digest("hex"), lines: lines.filter(line => /^[ABI] /.test(line)), pass: matched && raised });
        yield* Effect.sleep("400 millis");
      }
    }
  }));
  const passed = measured.filter(sample => sample.pass).length;
  const receipt = `SMASHCRAFT GATE bindings labels=${labels.length} samples=${measured.length} passed=${passed} pass=${passed === samples.length ? 1 : 0} remaps=${remaps ?? "none"}`;
  yield* save("measurements.json", `${JSON.stringify({ text: receipt, helper, helperSha256, controllerSource: dependency.source, contractPath, contractSha256: createHash("sha256").update(contractText).digest("hex"), device: pad.device, gamepad, remaps, phases, measured }, null, 2)}\n`);
  return { name: "bindings-gate", text: receipt, modified: Date.now() } satisfies ReceiptFile;
}).pipe(Effect.scoped);
