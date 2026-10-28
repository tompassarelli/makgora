import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [root, out, kit = "/src/game/sim/specials/schema", ...keys] = process.argv.slice(2);
const { authoredTuning } = await import(`${root}/src/game/sim/tuning`);
const { specialKit } = await import(`${root}${kit}`);
const { heroCueWindows } = await import(`${root}/src/game/presentation/specialCues`);
const reg = await import(`${root}/src/game/sim/heroes/registry`);
const slots = ["neutral-special", "side-special", "up-special", "down-special"];
const names: Record<string, string> = { blademaster: "blademaster", "chen-stormstout": "chen stormstout", murloc: "murloc", "shadow-hunter": "shadow hunter", "mountain-king": "mountain king", thrall: "thrall", "cairne-bloodhoof": "cairne bloodhoof", lich: "lich" };
mkdirSync(out!, { recursive: true });
for (const key of keys) {
  const [fighter = "", move = ""] = key.split(":");
  const character = reg.SELECTABLE_CHARACTERS.find((c: number) => reg.fighterSlug(c) === fighter);
  const tuning = authoredTuning(character);
  const authored = move === "ultimate" ? tuning.ultimate : specialKit(tuning.specials, slots.indexOf(move)).ground;
  const { first, last } = heroCueWindows(authored).active;
  const kind = move === "ultimate" ? "ultimate 0" : `special ${slots.indexOf(move)}`;
  const lines = [
    `# #454 screen calibration: ${fighter} ${move}, every active frame (special frames ${first}-${last}) held with its cues shown, then concealed by -dev hide cues 0.`,
    `#! chat -dev quick hero ${names[fighter]}`,
    `#! conceal-cues a ${fighter} ${move}`,
    `40 a move ${kind} right`,
    ...Array.from({ length: last - first + 1 }, (_, index) => `${38 + first + index} a capture`),
  ];
  writeFileSync(join(out!, `${fighter}-${move}.pad`), `${lines.join("\n")}\n`);
  console.log(key, first, last);
}
