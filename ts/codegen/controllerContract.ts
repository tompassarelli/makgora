import { resolve } from "node:path";
import { ACTION_ORDER, Action } from "../src/game/input/actions";
import { SAVED_BINDING_FORMAT, keyLabel, presetBindings } from "../src/game/input/keyBindings";
import { PAD_ACTIVE_KEY, PAD_AXIS_LEVELS, PAD_KEYS, PAD_PRESENT_KEY, PAD_TRIGGER_LEVELS, cursorWorldPacket, decodePad } from "../src/game/input/padCapture";
import { DASH_STICK_THRESHOLD, STICK_DEADZONE, TAP_JUMP_STICK_THRESHOLD, TRIGGER_FULL_LEVEL, TRIGGER_PRESS_LEVEL } from "../src/game/sim/stickZones";

export const CONTROLLER_CONTRACT_PATH = resolve(import.meta.dir, "../../contracts/controller.json");

const actionName = (action: Action): string => {
  const entry = Object.entries(Action).find(([, bit]) => bit === action);
  if (entry === undefined) throw new Error(`action ${action} has no name`);
  return entry[0];
};

function standardKeys() {
  const { keys } = presetBindings("standard");
  return keys.flatMap((code, index) => code === SAVED_BINDING_FORMAT.empty ? [] : [{
    key: keyLabel(code).toLowerCase(),
    code,
    action: actionName(ACTION_ORDER[Math.floor(index / 2)] ?? -1 as Action),
    slot: index % 2,
  }]);
}

type PadField = "axisX" | "axisZ" | "triggerLeft" | "triggerRight";

function padPacketFields() {
  const zero = decodePad(0);
  if (zero === undefined) throw new Error("pad packet 0 must decode");
  const fields: { name: PadField; shift: number; bits: number }[] = [];
  let limit = 1;
  for (let shift = 0; decodePad(limit) !== undefined; shift++, limit *= 2) {
    const decoded = decodePad(limit);
    const changed = (Object.keys(zero) as PadField[]).filter((name) => decoded?.[name] !== zero[name]);
    const [name] = changed;
    if (name === undefined || changed.length !== 1) throw new Error(`pad packet bit ${shift} must change exactly one field`);
    const last = fields.at(-1);
    if (last?.name === name) last.bits++;
    else fields.push({ name, shift, bits: 1 });
  }
  return { fields, limit };
}

function cursorPacket() {
  const calibration = { first: { x: 0, y: 0 }, last: { x: 127, y: 127 } };
  const yStep = cursorWorldPacket(calibration, 0, 1);
  const max = cursorWorldPacket(calibration, 127, 0);
  if (yStep === undefined || max === undefined) throw new Error("cursor packet must encode cells");
  return { cellMax: max, yShift: Math.log2(yStep) };
}

export function controllerContract() {
  return {
    actions: ACTION_ORDER.map((action) => ({ name: actionName(action), bit: action })),
    standardKeys: standardKeys(),
    savedBindings: SAVED_BINDING_FORMAT,
    padPacket: {
      axisLevels: PAD_AXIS_LEVELS,
      triggerLevels: PAD_TRIGGER_LEVELS,
      ...padPacketFields(),
      carrierKeys: PAD_KEYS,
      activeKey: PAD_ACTIVE_KEY,
      presentKey: PAD_PRESENT_KEY,
      cursor: cursorPacket(),
    },
    thresholds: {
      stickDeadzone: STICK_DEADZONE,
      tapJump: TAP_JUMP_STICK_THRESHOLD,
      cStickSmash: DASH_STICK_THRESHOLD,
      triggerPress: TRIGGER_PRESS_LEVEL,
      triggerFull: TRIGGER_FULL_LEVEL,
    },
  };
}

export const controllerContractText = (): string => `${JSON.stringify(controllerContract(), null, 2)}\n`;
