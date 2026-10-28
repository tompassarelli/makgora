import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";

const MORPHS = [
  { id: "malfurion-stag", hero: "hero-malfurion-stormrage", keys: "d+u", look: "Malfurion's Stag Charge: he bounds forward as a black stag" },
  { id: "kaelthas-phoenix", hero: "hero-kael'thas-sunstrider", keys: "w+u", look: "Kael'thas's Phoenix: he gathers flame, then flies up as a burning Phoenix and drops back as himself" },
] as const;

export const meterRimChecks = (rules: readonly Rule[]): NativeCheck[] => MORPHS.map(({ id, hero, keys, look }): NativeCheck => ({
  id: `499-${id}`,
  closes: "smashcraft#499 box 2",
  map: hero,
  session: `499-${id}`,
  setup: [{ waitMs: 3000 }, { chat: "-dev meter 100" }, { waitMs: 1200 }, { keys: [keys], client: "a" }],
  capture: [{ kind: "frames", name: id, client: "a", count: 40, everyMs: 50 }],
  pass: [...rules],
  look: `${look}. With a full ultimate meter both fighters wear a breathing gold outline. While he is in the other form, no gold outline of his normal body shows round it; on the frames after he is back in his own model the gold outline is round him again.`,
}));
