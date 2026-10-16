import { describe, expect, test } from "bun:test";
import { type ScoreFrame, scoreDoubleJump, scoreLedgeHang } from "../scripts/wisp/animScore";

const CORNER = { x: 24, z: 90 };

function frame(points: readonly (readonly [number, number])[], nodes: readonly (readonly [number, number])[] = []): ScoreFrame {
  const faces: number[] = [];
  for (let index = 0; index + 2 < points.length; index += 3) faces.push(index, index + 1, index + 2);
  return { frame: 0, vertices: Float32Array.from(points.flat()), drawn: new Uint8Array(points.length).fill(1), faces: Uint32Array.from(faces), nodes: Float32Array.from(nodes.flat()) };
}

const column = (x: number, bottom: number, top: number) => Array.from({ length: 30 }, (_, index) => [x + ([0, 8, 0][index % 3] ?? 0), bottom + (top - bottom - 8) * Math.floor(index / 3) / 9 + ([0, 0, 8][index % 3] ?? 0)] as const);
const STAND = frame(column(0, 0, 100));
const CAPSULE = [{ x1: 0, z1: 20, x2: 0, z2: 80, radius: 30 }];

describe("ledge hang line", () => {
  test("a body hanging below its grip at the corner passes, and one standing on the deck, sunk into the wall or reaching short fails [k2 property]", () => {
    const hanging = frame([...column(4, 0, 84), [22, 88], [23, 90], [24, 89]]);
    expect(scoreLedgeHang(STAND, [hanging], CAPSULE, CORNER).pass).toBe(true);
    const standing = frame(column(4, 90, 190));
    expect(scoreLedgeHang(STAND, [standing], CAPSULE, CORNER).below).toBeLessThan(0.5);
    const sunk = frame([...column(40, 0, 84), [23, 90]]);
    expect(scoreLedgeHang(STAND, [sunk], CAPSULE, CORNER).clear).toBeLessThan(0.5);
    const short = frame(column(4, 0, 60));
    expect(scoreLedgeHang(STAND, [short], CAPSULE, CORNER).grip).toBeGreaterThan(0.2);
  });

  test("a hang is judged on the body below the ledge, however far the grip above it leaves the hurtbox [k2 property]", () => {
    const reach = [[30, 100], [30, 105], [30, 110], [30, 115], [30, 120]] as const;
    const reaching = frame([...column(4, 0, 84), ...column(-80, 0, 84).slice(0, 19), [23, 90], ...reach]);
    const held = scoreLedgeHang(STAND, [reaching], CAPSULE, CORNER);
    expect(held.fit).toBeGreaterThanOrEqual(0.6);
    expect(held.pass).toBe(true);
    const spilling = scoreLedgeHang(STAND, [frame([...column(4, 0, 84), ...column(-80, 0, 84), [23, 90], ...reach])], CAPSULE, CORNER);
    expect(spilling.fit).toBeLessThan(0.6);
    expect(spilling.pass).toBe(false);
  });
});

describe("double jump line", () => {
  test("a double jump that repeats the first jump fails and one that turns the body passes [k2 property]", () => {
    const parents = [undefined, 0, 1];
    const upright = frame(column(0, 0, 100), [[0, 0], [0, 50], [0, 100]]);
    const flipped = frame(column(0, 0, 100).map(([x, z]) => [z - 50, 50 - x] as const), [[-50, 50], [0, 50], [50, 50]]);
    const repeat = scoreDoubleJump(STAND, [upright, upright], [upright, upright], parents, 1);
    expect(repeat.angle).toBe(0);
    expect(repeat.pass).toBe(false);
    const turned = scoreDoubleJump(STAND, [upright, upright], [flipped, flipped], parents, 1);
    expect(turned.angle).toBeCloseTo(90, 3);
    expect(turned.pass).toBe(true);
  });
});
