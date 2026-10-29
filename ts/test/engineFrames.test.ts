import { expect, test } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = join(import.meta.dir, "../src");
const HIDER = "game/ui/warcraftChat.ts";
const MOVES_A_FRAME = /BlzFrame(?:SetLevel|SetAbsPoint|SetPoint|SetAllPoints|ClearAllPoints|SetSize|SetScale|SetParent)|BlzSetFrame/;

test("only the Warcraft chat hider names Warcraft's chat frame, and it never changes the frame's level or place, which crashes the game when it ends with chat on screen [k2 property]", () => {
  const paths = [...new Glob("**/*.ts").scanSync(SOURCE)];
  expect(paths.length).toBeGreaterThan(0);
  const touching = paths.filter((path) => readFileSync(join(SOURCE, path), "utf8").includes("ORIGIN_FRAME_CHAT_MSG"));
  expect(touching).toEqual([HIDER]);
  expect(readFileSync(join(SOURCE, HIDER), "utf8")).not.toMatch(MOVES_A_FRAME);
});
