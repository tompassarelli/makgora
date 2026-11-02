import { resolve } from "node:path";
import type { RunFolders } from "./nativeCaptureHost";

export const USAGE = "usage: bun scripts/windowStrip.ts PAD.pad --out STRIP.jpg --row N,N,... [--row N,N,...]... [--after N] [--count N] [--owner NAME] [--tile WxH] [--resolution WxH] [--keep-frames]";

export function argumentsOf(args: readonly string[]) {
  const [pad, ...rest] = args;
  const rows: number[][] = [];
  let out: string | undefined, after = 580, count = 1000, owner = "window-strip", tile = "480x270", resolution = "1600x900", keep = false;
  if (pad === undefined || pad.startsWith("--")) throw new Error(USAGE);
  for (let index = 0; index < rest.length; index++) {
    const flag = rest[index];
    if (flag === "--keep-frames") { keep = true; continue; }
    const value = rest[++index];
    if (value === undefined) throw new Error(`${flag} needs a value\n${USAGE}`);
    if (flag === "--out") out = resolve(value);
    else if (flag === "--row" && /^\d+(,\d+)*$/.test(value)) rows.push(value.split(",").map(Number));
    else if (flag === "--after" && /^\d+$/.test(value)) after = Number(value);
    else if (flag === "--count" && /^[1-9]\d*$/.test(value)) count = Number(value);
    else if (flag === "--owner") owner = value;
    else if (flag === "--tile" && /^\d+x\d+$/.test(value)) tile = value;
    else if (flag === "--resolution" && /^\d+x\d+$/.test(value)) resolution = value;
    else throw new Error(USAGE);
  }
  if (out === undefined || rows.length === 0) throw new Error(USAGE);
  const last = Math.max(...rows.flat());
  if (last >= count) throw new Error(`--row names frame ${last} but --count ${count} saves frames 0 to ${count - 1}`);
  return { pad: resolve(pad), out, rows, after, count, owner, tile, resolution, keep };
}

export type StripArguments = ReturnType<typeof argumentsOf>;

export const padFile = (pad: string) => pad.replace(/^.*\//, "");

export const outFile = (out: string) => out.replace(/^.*\//, "");

/** The windowStrip command line on the capture host: the pad and the strip live in the run's folders, and the strip's folder comes back whole. */
export const shippedArguments = (strip: StripArguments, folders: RunFolders) => [
  `${folders.input}/${padFile(strip.pad)}`,
  "--out", `${folders.out}/${outFile(strip.out)}`,
  ...strip.rows.flatMap(row => ["--row", row.join(",")]),
  "--after", String(strip.after), "--count", String(strip.count), "--owner", strip.owner, "--tile", strip.tile, "--resolution", strip.resolution,
  ...(strip.keep ? ["--keep-frames"] : []),
];
