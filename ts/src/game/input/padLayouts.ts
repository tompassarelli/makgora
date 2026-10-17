import { Action } from "./actions";

// Control names are padbridge's serde snake_case names for SDL positions with Xbox labels.
export type PadControl =
  | "left_stick" | "a" | "b" | "x" | "y" | "lb" | "rb" | "lt" | "rt" | "start" | "back"
  | "dpad_up" | "dpad_down" | "dpad_left" | "dpad_right"
  | "left_up" | "left_down" | "left_left" | "left_right" | "right_up" | "right_down" | "right_left" | "right_right";

export type PadSetting = "leftShield" | "rightShield" | "rightStick";

export const PAD_SETTINGS: Readonly<Record<PadSetting, readonly string[]>> = {
  leftShield: ["full", "light"],
  rightShield: ["full", "light"],
  rightStick: ["smash", "tilt"],
};

export const PAUSE = "pause";
export const PAUSE_KEY = "Y".charCodeAt(0);

export interface PadBinding {
  readonly control: PadControl;
  readonly action: Action | typeof PAUSE;
  readonly label: string;
  readonly when?: { readonly setting: PadSetting; readonly value: string };
}

export interface PadLayout {
  readonly name: string;
  readonly label: string;
  readonly bindings: readonly PadBinding[];
}

const bind = (control: PadControl, action: PadBinding["action"], label: string): PadBinding => ({ control, action, label });
const when = (setting: PadSetting, value: string, binding: PadBinding): PadBinding => ({ ...binding, when: { setting, value } });

const shields: readonly PadBinding[] = [
  when("leftShield", "full", bind("lt", Action.leftTrigger, "Shield")),
  when("leftShield", "light", bind("lt", Action.lightShield, "Light shield")),
  when("rightShield", "full", bind("rt", Action.rightTrigger, "Right shield")),
  when("rightShield", "light", bind("rt", Action.lightShield, "Light shield")),
];

const rightStick = (control: PadControl, action: Action, smash: string, tilt: string): PadBinding[] => [
  when("rightStick", "smash", bind(control, action, smash)),
  when("rightStick", "tilt", bind(control, action, tilt)),
];

const shared: readonly PadBinding[] = [
  ...shields,
  bind("start", PAUSE, "Pause"),
  bind("left_left", Action.moveLeft, "Move left"),
  bind("left_right", Action.moveRight, "Move right"),
  bind("left_down", Action.moveDown, "Crouch / fast fall"),
  bind("left_up", Action.moveUp, "Up (aim, up special)"),
  ...rightStick("right_up", Action.smashUp, "Up smash", "Up tilt / up air"),
  ...rightStick("right_down", Action.smashDown, "Down smash", "Down tilt / down air"),
  ...rightStick("right_left", Action.smashLeft, "Smash left", "Tilt left / air left"),
  ...rightStick("right_right", Action.smashRight, "Smash right", "Tilt right / air right"),
];

export const PAD_LAYOUTS: readonly PadLayout[] = [
  {
    name: "melee",
    label: "Melee",
    bindings: [
      bind("a", Action.attack, "Attack"), bind("b", Action.special, "Special"), bind("x", Action.jump, "Jump"), bind("y", Action.jump, "Jump"),
      bind("rb", Action.grab, "Grab"), bind("lb", Action.exSpecial, "EX special"), ...shared,
    ],
  },
  {
    name: "z-jump",
    label: "Z jump",
    bindings: [
      bind("a", Action.attack, "Attack"), bind("b", Action.special, "Special"), bind("x", Action.grab, "Grab"), bind("y", Action.jump, "Jump"),
      bind("rb", Action.jump, "Jump"), bind("lb", Action.exSpecial, "EX special"), ...shared,
    ],
  },
  {
    name: "tom",
    label: "Tom",
    bindings: [
      bind("a", Action.attack, "Attack"), bind("b", Action.grab, "Grab"), bind("x", Action.special, "Special"), bind("y", Action.jump, "Jump"),
      bind("lb", Action.shortHop, "Short hop"), bind("rb", Action.exSpecial, "EX special"), ...shared,
    ],
  },
];
