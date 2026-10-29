import { max } from "../../core/numbers";
import type { Fighter } from "../fighter";
import type { Controls } from "../roster";
import type { SpecialChannel } from "./castWindows";
import type { FrameWindow } from "./schema";

function rewindTo(f: Fighter, frame: number): void {
  const { special } = f;
  const rewound = special.frame - frame;
  special.refires++;
  special.frame = frame;
  special.lockFrames += rewound;
  f.attack.cooldown += rewound;
}

export function skipSpecialTo(f: Fighter, frame: number): void {
  const skipped = frame - f.special.frame;
  if (skipped <= 0) return;
  f.special.frame = frame;
  f.special.lockFrames = max(0, f.special.lockFrames - skipped);
  f.attack.cooldown = max(0, f.attack.cooldown - skipped);
}

export function advanceRefire(f: Fighter, refire: Readonly<FrameWindow> | undefined, input: Readonly<Controls> | undefined): void {
  if (refire === undefined) return;
  const { special } = f;
  if (special.frame === 1) {
    special.refire = false;
    special.refires = 0;
  }
  if (special.refire && special.frame === refire.last + 1) {
    special.refire = false;
    rewindTo(f, refire.first);
  }
  if (input?.specialPressed === true && special.frame >= refire.first && special.frame <= refire.last) special.refire = true;
}

export function advanceChannel(f: Fighter, channel: Readonly<SpecialChannel> | undefined, input: Readonly<Controls> | undefined): void {
  if (channel === undefined) return;
  const { special } = f;
  if (special.frame === 1) special.refires = 0;
  const held = input?.specialHeld === true;
  if (held && special.frame === channel.last + 1 && special.refires < channel.rewinds) rewindTo(f, channel.first);
  else if (!held && special.refires > 0 && special.frame >= channel.first && special.frame <= channel.last) skipSpecialTo(f, channel.last + 1);
}
