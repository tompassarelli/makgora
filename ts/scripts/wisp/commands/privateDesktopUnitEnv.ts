import { readFileSync } from "node:fs";

export const privateDesktopUnitEnv = (env: Readonly<Record<string, string | undefined>>, readDisplay = (run: string) => readFileSync(`${run}/display`, "utf8")): readonly string[] => {
  const run = env["PRIVATE_DESKTOP_RUN"];
  if (run === undefined || !run.startsWith("/run/user/") || !run.includes("/private-desktop.")) {
    throw new Error("native unit requires an active PRIVATE_DESKTOP_RUN");
  }
  let display: string;
  try {
    display = readDisplay(run).trim();
  } catch {
    throw new Error("native unit requires the private desktop display record");
  }
  if (!/^:[1-9][0-9]*$/.test(display)) throw new Error(`refusing non-private display ${display || "(empty)"}`);
  return [`--setenv=PRIVATE_DESKTOP_RUN=${run}`, `--setenv=DISPLAY=${display}`];
};
