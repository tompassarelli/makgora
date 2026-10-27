import type { Fighter } from "../fighter";
import type { Controls } from "../roster";
import type { FrameWindow } from "./schema";

export function advanceRefire(f: Fighter, refire: Readonly<FrameWindow> | undefined, input: Readonly<Controls> | undefined): void {
  if (refire === undefined) return;
  const { special } = f;
  if (special.frame === 1) {
    special.refire = false;
    special.refires = 0;
  }
  if (special.refire && special.frame === refire.last + 1) {
    const rewound = special.frame - refire.first;
    special.refire = false;
    special.refires++;
    special.frame = refire.first;
    special.lockFrames += rewound;
    f.attack.cooldown += rewound;
  }
  if (input?.specialPressed === true && special.frame >= refire.first && special.frame <= refire.last) special.refire = true;
}
