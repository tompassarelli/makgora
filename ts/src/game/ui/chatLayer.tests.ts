import { assertEquals, test } from "wisp/src/runtime/testing";
import { CHAT_LEVELS, SELECT_LEVELS, chatLevel } from "./chatLayer";

test("player chat sits above every select-screen frame while select is open and returns to its match level after [k2 property]", () => {
  const top = Math.max(...Object.values(SELECT_LEVELS));
  assertEquals(chatLevel(true) > top, true, `chat level ${chatLevel(true)} above select level ${top}`);
  assertEquals(chatLevel(false), CHAT_LEVELS.match, "chat level after select");
});
