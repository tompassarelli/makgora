import { expect, test } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = join(import.meta.dir, "../src");

test("no map source changes Warcraft's chat frame, whose level change crashes the game when it ends with chat on screen [k2 property]", () => {
  const paths = [...new Glob("**/*.ts").scanSync(SOURCE)];
  expect(paths.length).toBeGreaterThan(0);
  const touching = paths.filter((path) => readFileSync(join(SOURCE, path), "utf8").includes("ORIGIN_FRAME_CHAT_MSG"));
  expect(touching).toEqual([]);
});
