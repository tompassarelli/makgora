import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { type AgencyString, DEFAULT_RULE, TICKS_PER_SECOND, distribution, flagString } from "./agencyCore";

export const ESCAPE_FLOORS: readonly number[] = [0.1, 0.15, 0.2, 0.25, 0.3];
export const CONTROL_SECONDS: readonly number[] = [1.5, 2, 2.5, 3];

const percent = (share: number): string => `${(100 * share).toFixed(0)}%`;

/** Markdown for the strings' per-link escape and flags under the default candidate rule, then the (E, T) table of how many strings each pair flags. */
export function renderAgencyTable(strings: readonly AgencyString[], label: (string: AgencyString) => string = () => ""): string {
  const lines = ["| String | Moves | Escape per follow-up | Conversion | Flags (E 20%, T 2.5 s) |", "| --- | --- | --- | --- | --- |"];
  for (const string of strings) {
    const between = string.links.filter((link) => !link.within);
    const flags = flagString(string, DEFAULT_RULE);
    lines.push(`| ${label(string)} | ${string.attacker} > ${string.victim}: ${string.moves.join(", ")} | ${between.map((link) => percent(link.escape)).join(", ") || "none"} | ${percent(string.conversion)} | ${flags.map((flag) => `${flag.kind} (${flag.cause.split(":")[0]})`).join("; ") || "none"} |`);
  }
  lines.push("", `Strings flagged of ${strings.length}, any kind (true-chain / low-agency-link / long-no-control / loop):`, "", `| E \\ T | ${CONTROL_SECONDS.map((seconds) => `${seconds} s`).join(" | ")} |`, `| --- | ${CONTROL_SECONDS.map(() => "---").join(" | ")} |`);
  const cells = distribution(strings, ESCAPE_FLOORS, CONTROL_SECONDS);
  for (const floor of ESCAPE_FLOORS) {
    const row = cells.filter((cell) => cell.escapeFloor === floor);
    lines.push(`| ${percent(floor)} | ${row.map((cell) => `${cell.strings} (${cell.byKind["true-chain"]}/${cell.byKind["low-agency-link"]}/${cell.byKind["long-no-control"]}/${cell.byKind.loop})`).join(" | ")} |`);
  }
  const frames = strings.flatMap((string) => string.links.filter((link) => !link.within).map((link) => link.nextFrame - link.frame));
  lines.push("", `${strings.reduce((sum, string) => sum + string.links.length, 0)} links, ${frames.length} between moves; true-chain and loop do not depend on E or T; ${(DEFAULT_RULE.controlFrames / TICKS_PER_SECOND).toFixed(1)} s is the default T.`);
  return lines.join("\n");
}

if (import.meta.main) {
  const { positionals } = parseArgs({ args: process.argv.slice(2), allowPositionals: true, strict: true });
  const strings = positionals.flatMap((file): AgencyString[] => JSON.parse(readFileSync(file, "utf8")) as AgencyString[]);
  console.log(renderAgencyTable(strings));
}
