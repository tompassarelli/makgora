import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { fighterName, SELECTABLE_CHARACTERS, selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { Character } from "../src/game/sim/codes";
import { DEFAULT_OPTIONS, playTextMatch } from "../scripts/textMatch";
import { parseCommands } from "../scripts/textMatchView";

test("a fresh untilted hard shield blocks Illidan's forward air for every fighter it reaches, and a shield held from frame 15 is drained enough to leave Tinker's head to the second hit [k1 scenario]", () => {
  const cpu = selectableCharacterBySlug("illidan");
  if (cpu === undefined) throw new Error("no fighter illidan");
  const contacts = (shieldFrame: number) => SELECTABLE_CHARACTERS.map((you) => {
    const lines = playTextMatch({ ...DEFAULT_OPTIONS, seed: 44, you, cpu, frames: 70 }, parseCommands(`0 neutral\n${shieldFrame} shield\n70 neutral\n`)).lines;
    return {
      name: fighterName(you),
      block: lines.findIndex((line) => /^\d+ A x\S+ z\S+ 0% \S+ hitlag /.test(line)),
      damage: lines.findIndex((line) => /^\d+ A x\S+ z\S+ [1-9]\d*% /.test(line)),
    };
  });
  const unreached: readonly Character[] = [Character.rifleman, Character.mountainKing, Character.peon, Character.murloc, Character.kobold];
  const fresh = contacts(46);
  expect(fresh.filter((contact) => contact.block !== -1).map((contact) => contact.name)).toEqual(SELECTABLE_CHARACTERS.filter((character) => !unreached.includes(character)).map(fighterName));
  expect(fresh.filter((contact) => contact.damage !== -1).map((contact) => contact.name)).toEqual([]);
  const drained = contacts(15);
  expect(drained.filter((contact) => contact.damage !== -1).map((contact) => contact.name)).toEqual([fighterName(Character.tinker)]);
  expect(drained.filter((contact) => contact.damage !== -1 && contact.block !== -1 && contact.block < contact.damage).map((contact) => contact.name)).toEqual([fighterName(Character.tinker)]);
});

test("an Expert computer hit by a stationary opponent's down smash stops re-approaching into it within each of the opponent's stocks and punishes [k1 scenario]", () => {
  const input = readFileSync(new URL("./playtest407/dsmash-loop.in", import.meta.url), "utf8");
  const options = { ...DEFAULT_OPTIONS, seed: 9, cpu: selectableCharacterBySlug("thrall") ?? DEFAULT_OPTIONS.cpu, level: "expert" as const, frames: 3000 };
  const lines = playTextMatch(options, parseCommands(input)).lines.filter((line) => /^\d+ A x/.test(line));
  const percents = lines.map((line) => /^\d+ A \S+ \S+ (\d+)% (\d+)st .* \| B \S+ \S+ (\d+)% (\d)st/.exec(line));
  let taken = 0;
  let mostTaken = 0;
  let landed = 0;
  for (let index = 1; index < percents.length; index++) {
    const before = percents[index - 1];
    const now = percents[index];
    if (before === null || now === null || before === undefined || now === undefined) continue;
    if (now[2] !== before[2]) taken = 0;
    if (Number(now[3]) > Number(before[3]) && now[4] === before[4]) mostTaken = Math.max(mostTaken, ++taken);
    if (Number(now[1]) > Number(before[1])) landed++;
  }
  expect(mostTaken).toBeLessThanOrEqual(2);
  expect(landed).toBeGreaterThanOrEqual(1);
});
