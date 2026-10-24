import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { type AgencyRule, type AgencyString, DEFAULT_RULE, FLAG_KINDS, type FlagKind, TICKS_PER_SECOND, distribution, flagString } from "./agencyCore";

export const ESCAPE_FLOORS: readonly number[] = [0.1, 0.15, 0.2, 0.25, 0.3];
export const CONTROL_SECONDS: readonly number[] = [1.5, 2, 2.5, 3];

const percent = (share: number): string => `${(100 * share).toFixed(0)}%`;

/** Markdown for the strings' per-link escape and flags under `rule` (smashcraft#63's by default), how many strings it flags, then the (E, T) table of how many strings each pair flags. */
export function renderAgencyTable(strings: readonly AgencyString[], label: (string: AgencyString) => string = () => "", rule: AgencyRule = DEFAULT_RULE): string {
  const named = `E ${percent(rule.escapeFloor)}, T ${rule.controlFrames / TICKS_PER_SECOND} s`;
  const lines = [`| String | Moves | Escape per follow-up | Conversion | Flags (${named}) |`, "| --- | --- | --- | --- | --- |"];
  const byKind: Record<FlagKind, number> = { "true-chain": 0, "low-agency-link": 0, "long-no-control": 0, loop: 0 };
  let flagged = 0;
  for (const string of strings) {
    const between = string.links.filter((link) => !link.within);
    const flags = flagString(string, rule);
    const kinds = new Set(flags.map((flag) => flag.kind));
    if (kinds.size > 0) flagged++;
    for (const kind of kinds) byKind[kind]++;
    lines.push(`| ${label(string)} | ${string.attacker} > ${string.victim}: ${string.moves.join(", ")} | ${between.map((link) => percent(link.escape)).join(", ") || "none"} | ${percent(string.conversion)} | ${flags.map((flag) => `${flag.kind} (${flag.cause.split(":")[0]})`).join("; ") || "none"} |`);
  }
  lines.push("", `Strings flagged under ${named}: ${flagged} of ${strings.length} (${FLAG_KINDS.map((kind) => `${byKind[kind]} ${kind}`).join(", ")}).`);
  lines.push("", `Strings flagged of ${strings.length}, any kind (true-chain / low-agency-link / long-no-control / loop):`, "", `| E \\ T | ${CONTROL_SECONDS.map((seconds) => `${seconds} s`).join(" | ")} |`, `| --- | ${CONTROL_SECONDS.map(() => "---").join(" | ")} |`);
  const cells = distribution(strings, ESCAPE_FLOORS, CONTROL_SECONDS, rule);
  for (const floor of ESCAPE_FLOORS) {
    const row = cells.filter((cell) => cell.escapeFloor === floor);
    lines.push(`| ${percent(floor)} | ${row.map((cell) => `${cell.strings} (${cell.byKind["true-chain"]}/${cell.byKind["low-agency-link"]}/${cell.byKind["long-no-control"]}/${cell.byKind.loop})`).join(" | ")} |`);
  }
  const frames = strings.flatMap((string) => string.links.filter((link) => !link.within).map((link) => link.nextFrame - link.frame));
  lines.push("", `${strings.reduce((sum, string) => sum + string.links.length, 0)} links, ${frames.length} between moves; true-chain and loop do not depend on E or T; smashcraft#63's rule is E ${percent(DEFAULT_RULE.escapeFloor)}, T ${DEFAULT_RULE.controlFrames / TICKS_PER_SECOND} s.`);
  return lines.join("\n");
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({ args: process.argv.slice(2), options: { e: { type: "string" }, t: { type: "string" } }, allowPositionals: true, strict: true });
  const escapeFloor = values.e === undefined ? DEFAULT_RULE.escapeFloor : Number(values.e) / 100;
  const seconds = values.t === undefined ? DEFAULT_RULE.controlFrames / TICKS_PER_SECOND : Number(values.t);
  if (!(escapeFloor >= 0 && escapeFloor <= 1) || !(seconds > 0)) throw new Error(`--e takes a percent from 0 to 100 and --t positive seconds, not ${values.e} and ${values.t}`);
  const strings = positionals.flatMap((file): AgencyString[] => JSON.parse(readFileSync(file, "utf8")) as AgencyString[]);
  console.log(renderAgencyTable(strings, () => "", { ...DEFAULT_RULE, escapeFloor, controlFrames: seconds * TICKS_PER_SECOND }));
}
