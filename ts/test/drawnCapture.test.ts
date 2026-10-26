import { expect, test } from "bun:test";
import { Effect } from "effect";
import { captureWhenDrawn } from "../scripts/integrity/drawnCapture";

const held = () => ({ epoch: 7, frame: 146 });
const shots = (images: readonly string[]) => {
  let next = 0;
  return Effect.sync(() => images[Math.min(next++, images.length - 1)] ?? "");
};

test("a held capture rereads a framebuffer that repeats the previous capture until the presented image changes, and is INVALID when it never does [k2 property]", async () => {
  const fresh = await Effect.runPromise(captureWhenDrawn(held, 7, 146, 1000, shots(["frame 140", "frame 140", "frame 146"]), "fixture", (image) => image === "frame 140", 1000));
  expect(fresh.shot).toBe("frame 146");
  expect(fresh.reads).toBe(3);
  const stale = await Effect.runPromise(Effect.flip(captureWhenDrawn(held, 7, 146, 1000, shots(["frame 140"]), "fixture", (image) => image === "frame 140", 60)));
  expect(String(stale.cause)).toContain("INVALID: stale image");
});
