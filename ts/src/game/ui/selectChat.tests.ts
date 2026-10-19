import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { SELECT_CHAT_LINES, SELECT_CHAT_SECONDS, addChat, ageChat, chatName, chatText, createChatLog } from "./selectChat";

test("select chat keeps the newest lines, drops each after its time, and names players without their BattleTag number [k1 property]", () => {
  const log = createChatLog();
  for (let i = 0; i < SELECT_CHAT_LINES + 2; i++) addChat(log, 0, "Tom#1234", `line ${i}`);
  assertEquals(log.lines.length, SELECT_CHAT_LINES);
  assertEquals(chatText(log).split("\n")[0], "|cffff0303Tom|r: line 2");
  ageChat(log, f32(SELECT_CHAT_SECONDS - 1.0));
  addChat(log, 2, "Wren", "late");
  ageChat(log, 1.0);
  assertEquals(chatText(log), "|cff1ce6b9Wren|r: late");
  assertEquals(chatName("NoTag"), "NoTag");
});
