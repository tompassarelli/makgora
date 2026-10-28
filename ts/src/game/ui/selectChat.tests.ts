import { assertEquals, test } from "wisp/src/runtime/testing";
import { SELECT_CHAT_LINES, appendChatLine } from "./selectChat";

test("select chat keeps the newest lines in order and shows a pipe in a message as text, not a colour code [k2 property]", () => {
  let lines: string[] = [];
  for (let i = 1; i <= SELECT_CHAT_LINES + 2; i++) lines = appendChatLine(lines, "P", `line ${i}`);
  assertEquals(lines.length, SELECT_CHAT_LINES, "lines kept");
  assertEquals(lines[0]?.endsWith("line 3"), true, "oldest kept line");
  assertEquals(lines[SELECT_CHAT_LINES - 1]?.endsWith(`line ${SELECT_CHAT_LINES + 2}`), true, "newest line");
  assertEquals(appendChatLine([], "P", "|cffff0000red")[0]?.endsWith("||cffff0000red"), true, "pipe escaped");
});
