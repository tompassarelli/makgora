import { assertEquals, test } from "wisp/src/runtime/testing";
import { CHAT_LEVELS, SELECT_LEVELS, chatLevel, chatLevelToSet } from "./chatLayer";

test("player chat sits above every select-screen frame while select is open and returns to its match level after [k2 property]", () => {
  const top = Math.max(...Object.values(SELECT_LEVELS));
  assertEquals(chatLevel(true) > top, true, `chat level ${chatLevel(true)} above select level ${top}`);
  assertEquals(chatLevel(false), CHAT_LEVELS.match, "chat level after select");
});

test("chat's level is set again on every select frame, so the select backdrop shown that frame stays under chat, and only on change in a match [k2 property]", () => {
  assertEquals(chatLevelToSet(undefined, true), CHAT_LEVELS.select, "first select frame");
  assertEquals(chatLevelToSet(CHAT_LEVELS.select, true), CHAT_LEVELS.select, "later select frame");
  assertEquals(chatLevelToSet(CHAT_LEVELS.select, false), CHAT_LEVELS.match, "first match frame");
  assertEquals(chatLevelToSet(CHAT_LEVELS.match, false), undefined, "later match frame");
});
