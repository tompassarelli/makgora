import { expect, test } from "bun:test";
import { readmeProblems } from "../scripts/readmeCheck";

const tree = new Set(["docs/player-guide.md", "ts"]);
const exists = (path: string) => tree.has(path.replace(/\/$/, ""));

test("refuses a README that still names the game Smashcraft, except for one history mention [k2 property]", () => {
  expect(readmeProblems("# Smashcraft\n", exists)).toHaveLength(1);
  expect(readmeProblems("[x](https://github.com/tompassarelli/smashcraft/issues)\n", exists)).toHaveLength(1);
  expect(readmeProblems("It was formerly called Smashcraft.\n", exists)).toEqual([]);
  expect(readmeProblems("[client](https://github.com/tompassarelli/smashcraft-client)\n", exists)).toHaveLength(1);
});

test("refuses a relative link to a path missing from the tree and ignores URLs and anchors [k2 property]", () => {
  expect(readmeProblems("[guide](docs/player-guide.md#controls) [src](ts/) [web](https://example.com/x) [top](#develop)\n", exists)).toEqual([]);
  expect(readmeProblems("[gone](docs/missing.md)\n", exists)).toHaveLength(1);
});
