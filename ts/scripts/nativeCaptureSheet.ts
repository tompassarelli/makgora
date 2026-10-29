import { Effect, Schema, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { encodePpm, type Frame } from "wisp/scripts/wisp/frameProbe";
import { runProcess } from "./hostProcess";

export type Region = readonly [number, number, number, number];
export interface SheetRow { readonly row: string; readonly frames: readonly number[] }
export class SheetFailure extends Schema.TaggedError<SheetFailure, { readonly brand: unique symbol }>()("SheetFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}

export function sheetCanvas(rows: readonly SheetRow[]): Frame {
  return { width: 40 + 10 * 96, height: rows.length * 56, rgb: new Uint8Array((40 + 10 * 96) * rows.length * 56 * 3) };
}

export function putSheetFrame(canvas: Frame, row: number, column: number, frame: Frame, region: Region): void {
  const [left, top, width, height] = region;
  if (!region.every(Number.isInteger) || left < 0 || top < 0 || width <= 0 || height <= 0 || left + width > frame.width || top + height > frame.height) throw new Error("sheet crop outside capture");
  for (let y = 0; y < 54; y++) for (let x = 0; x < 96; x++) {
    const from = (Math.floor(top + y * height / 54) * frame.width + Math.floor(left + x * width / 96)) * 3;
    const to = ((row * 56 + y) * canvas.width + 40 + column * 96 + x) * 3;
    canvas.rgb.set(frame.rgb.subarray(from, from + 3), to);
  }
}

export const writeSheet = (canvas: Frame, rows: readonly SheetRow[], file: string) => Effect.gen(function*() {
  if (rows.some(row => !/^R\d+$/.test(row.row))) return yield* new SheetFailure({ problem: "sheet labels must be opaque row IDs" });
  yield* runProcess(ChildProcess.make("magick", ["ppm:-", "-font", "DejaVu-Sans", "-pointsize", "11", "-fill", "white", ...rows.flatMap((row, index) => ["-draw", `text 3,${index * 56 + 28} '${row.row}'`]), "-strip", "-sampling-factor", "4:2:0", "-quality", "85", "-define", "jpeg:extent=128kb", file], { stdin: Stream.make(encodePpm(canvas)) }))
    .pipe(Effect.mapError(cause => new SheetFailure({ problem: cause.message })));
  const bytes = yield* Effect.tryPromise({ try: async () => Bun.file(file).size, catch: cause => new SheetFailure({ problem: String(cause) }) });
  if (bytes > 128 * 1024) return yield* new SheetFailure({ problem: `${file}: ${bytes} exceeds 128 KiB` });
  return bytes;
});
