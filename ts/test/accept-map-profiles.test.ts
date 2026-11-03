import { expect, test } from "bun:test";
import { MAP_PROFILES, mapProfilesFor } from "../scripts/wisp/acceptChecks";

test("a given --map replaces every map but the candidate's own dev build, which still rebuilds from the checkout [k2 property]", () => {
  const profiles = mapProfilesFor(MAP_PROFILES, "/maps/candidate.w3x", undefined);
  expect(profiles["gate-playable"]?.path).toBe("/maps/candidate.w3x");
  expect(profiles["fighter-select"]).toMatchObject({ path: "/maps/candidate.w3x" });
  expect(profiles["fighter-select"]?.rebuild).toBeUndefined();
  expect(profiles["candidate-dev"]).toEqual(MAP_PROFILES["candidate-dev"]!);
  expect(profiles["candidate-dev"]?.rebuild).toBe("main");
});

test("with no --map only the playable candidate's path is the built candidate [k2 property]", () => {
  const profiles = mapProfilesFor(MAP_PROFILES, undefined, "/maps/built.w3x");
  expect(profiles["gate-playable"]?.path).toBe("/maps/built.w3x");
  expect(profiles["candidate-dev"]).toEqual(MAP_PROFILES["candidate-dev"]!);
  expect(mapProfilesFor(MAP_PROFILES, undefined, undefined)).toBe(MAP_PROFILES);
});
