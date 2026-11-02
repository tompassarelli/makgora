import { expect, test } from "bun:test";
import { NATIVE_CAPTURE_HOST, captureRoute, remoteCommand, remotePath, runFolders } from "../scripts/nativeCaptureHost";
import { argumentsOf, shippedArguments } from "../scripts/windowStripArguments";

test("a native-window capture runs in place only on gex45 and ships from every other host, gaming laptop included [k2 property]", () => {
  expect(NATIVE_CAPTURE_HOST).toBe("gex45");
  expect(captureRoute("gex45")).toBe("here");
  expect(captureRoute("whiterabbit")).toBe("ship");
  expect(captureRoute("some-worker-box")).toBe("ship");
});

test("the shipped windowStrip command line keeps every option and moves the pad and the strip into the run's folders [k2 property]", () => {
  const strip = argumentsOf(["/lane/pad/a.pad", "--out", "/shots/x/x-low.jpg", "--row", "1,2", "--row", "3", "--after", "100", "--count", "60", "--owner", "me", "--keep-frames"]);
  const folders = runFolders("run1");
  const args = shippedArguments(strip, folders);
  expect(args).toEqual([
    "$HOME/.local/state/smashcraft/remote-runs/run1/in/a.pad",
    "--out", "$HOME/.local/state/smashcraft/remote-runs/run1/out/x-low.jpg",
    "--row", "1,2", "--row", "3", "--after", "100", "--count", "60", "--owner", "me", "--tile", "480x270", "--resolution", "1600x900", "--keep-frames",
  ]);
  expect(argumentsOf(["/lane/pad/a.pad", ...args.slice(1)].map(arg => arg.replace("$HOME", "/home/t")))).toMatchObject({ rows: strip.rows, after: 100, count: 60, owner: "me", keep: true });
});

test("the remote command installs the shipped lane's packages, then runs the script with the run folder's paths expanded by the remote shell [k2 property]", () => {
  const folders = runFolders("run1");
  const command = remoteCommand(folders, "ts", "scripts/windowStrip.ts", [`${folders.input}/a b.pad`, "--owner", "it's"], { XDG_CONFIG_HOME: folders.config });
  expect(command).toBe([
    `cd "$HOME"/'.local/state/smashcraft/remote-runs/run1/src'`,
    "git init -q",
    "git add -A",
    `cd "$HOME"/'.local/state/smashcraft/remote-runs/run1/src/ts'`,
    "bun install --frozen-lockfile >&2",
    `exec env XDG_CONFIG_HOME="$HOME"/'.local/state/smashcraft/remote-runs/run1/config' bun 'scripts/windowStrip.ts' "$HOME"/'.local/state/smashcraft/remote-runs/run1/in/a b.pad' '--owner' 'it'\\''s'`,
  ].join(" && "));
  expect(remotePath("/abs/x y")).toBe("'/abs/x y'");
});
