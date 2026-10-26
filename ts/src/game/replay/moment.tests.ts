import { recordTokens } from "wisp/src/runtime/recordText";
import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { KEYED_BY_ACTION, SECTION_TOKEN_WIDTH, savedFighter } from "./moment";

test("every fighter's saved moment state fits Preload's line width token by token [k4 reference native]", () => {
  const overlong: string[] = [];
  for (const character of Object.values(Character)) {
    for (const token of recordTokens({ fighter: savedFighter(createFighter(character, 0, 1)) }, KEYED_BY_ACTION) ?? ["unwritable"]) {
      if (token.length > SECTION_TOKEN_WIDTH) overlong.push(`${character}: ${token.substring(0, 40)}`);
    }
  }
  assertEquals(overlong.join("; "), "");
});
