import { formatInt } from "wisp/game/text";
import { writeLines } from "wisp/src/platform/fileio";

export const wheelLogFile = (slot: number) => `makgora-dev-wheel-p${formatInt(slot)}.txt`;

// Lua: the log is module state that lives for the session; it stays off until `-dev popup` starts it, so a normal session writes nothing.
const turns: string[] = [];
let logSlot = -1;

export function startWheelLog(slot: number): void {
  logSlot = slot;
  turns.length = 0;
  writeLines(wheelLogFile(slot), turns);
}

export function recordWheel(popup: string, delta: number, first: number): void {
  if (logSlot < 0) return;
  turns.push(`WHEEL popup=${popup} delta=${formatInt(delta)} first=${formatInt(first)} n=${formatInt(turns.length + 1)}`);
  writeLines(wheelLogFile(logSlot), turns);
}
