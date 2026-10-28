const root = process.argv[2]!;
const { authoredTuning } = await import(`${root}/src/game/sim/tuning`);
const { specialKit } = await import(`${root}${process.env.KIT ?? "/src/game/sim/specials/schema"}`);
const { heroCueWindows } = await import(`${root}/src/game/presentation/specialCues`);
const reg = await import(`${root}/src/game/sim/heroes/registry`);
const slots = ["neutral-special", "side-special", "up-special", "down-special"];
for (const key of process.argv.slice(3)) {
  const [fighter, move] = key.split(":");
  const character = reg.SELECTABLE_CHARACTERS.find((c: number) => reg.fighterSlug(c) === fighter);
  const t = authoredTuning(character);
  const m = move === "ultimate" ? t.ultimate : specialKit(t.specials, slots.indexOf(move!)).ground;
  const w = heroCueWindows(m);
  console.log(key, JSON.stringify(w.active), "end", m.endFrame, "proj", (m.projectiles ?? []).map((p: { spawnFrame: number; lifetime?: number }) => `${p.spawnFrame}+${p.lifetime}`).join(","));
}
