import { expect, test } from "bun:test";
import { parseList } from "../scripts/autolandCore";

const isText = (value: unknown): value is string => typeof value === "string";

test("the planner names an empty or truncated input instead of crashing on the JSON parse [k2 property]", () => {
  expect(() => parseList("", "runs.json", isText)).toThrow("runs.json: empty input");
  expect(() => parseList("  \n", "lanes.json", isText)).toThrow("lanes.json: empty input");
  expect(() => parseList('["a", "b', "lanes.json", isText)).toThrow("lanes.json: truncated or malformed JSON");
  expect(() => parseList("{}", "lanes.json", isText)).toThrow("expected a list");
  expect(parseList('["a"]', "lanes.json", isText)).toEqual(["a"]);
});
