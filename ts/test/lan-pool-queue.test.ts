import { afterEach, expect, test } from "bun:test";
import { ownerWalkStart, poolUnitCommand, unitPairIds } from "../scripts/wisp/commands/lanPoolUnit";
import { NATIVE_OUTER_PID } from "../scripts/wisp/commands/pairGuard";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});




test("each fleet session's pool unit has its own name, reads back its pairs, waits in line and names its session's process as owner [k2 property]", () => {
  const unit = (session: string, args: readonly string[] = ["--pair", "0"]) => poolUnitCommand(args, "/bin", 1000, "bun", { NORTH_FLEET_SESSION: session, PRIVATE_DESKTOP_RUN: "/run/user/1000/private-desktop.test" }, () => ":7", () => 4242);
  const name = (command: readonly string[]) => command.find((arg) => arg.startsWith("--unit="))?.slice("--unit=".length) ?? "";
  const pool = (command: readonly string[]) => command.slice(command.indexOf("pool") + 1);
  expect(new Set(["early", "late", "early"].map((session) => name(unit(session)))).size).toBe(2);
  for (const ids of [[0], [3, 12]]) expect(unitPairIds(name(unit("late", ids.flatMap((id) => ["--pair", String(id)]))))).toEqual(ids);
  expect(pool(unit("early"))).toEqual(["--pair", "0", "--queue", "--owner-pid", "4242", "--foreground"]);
  expect(pool(unit("early", ["--pair", "0", "--queue", "--owner-pid", "7"]))).toEqual(["--pair", "0", "--queue", "--owner-pid", "7", "--foreground"]);
  expect(pool(unit(""))).toEqual(["--pair", "0", "--queue", "--foreground"]);
  expect([ownerWalkStart({ [NATIVE_OUTER_PID]: "4242" }, 99), ownerWalkStart({}, 99), ownerWalkStart({ [NATIVE_OUTER_PID]: "" }, 99)]).toEqual([4242, 99, 99]);
});
