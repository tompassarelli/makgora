import { expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { MAKGORA_HEADLESS } from "../scripts/wisp/headless";
import { FLOOR_HEIGHT, PLAYABLE_BOUNDS } from "../src/game/presentation/arenaCamera";
import { BossSpell, FIRE_BURST_MODEL, SHOCKWAVE_MODEL, SHOCKWAVE_POINTS } from "../src/game/presentation/bossSpellArt";
import { BossSpells, spellCast } from "../src/game/render/bossSpells";

const HOLD = 15;
const ZONES = [-300.0, 0.0, 300.0];

function play(spell: BossSpell, tell: number, active: number, frame: (into: number, created: ReadonlySet<number>, live: readonly { readonly model: string; readonly id: number }[]) => void): void {
  const runtime = installHeadless(MAKGORA_HEADLESS);
  try {
    const clients = runtime.clients({ install() {}, start() {} }, [0]);
    const client = clients.client(0);
    clients.start();
    client.run(() => {
      const spells = new BossSpells({ x: 0.0, y: PLAYABLE_BOUNDS.centreY, z: FLOOR_HEIGHT });
      const cast = spellCast();
      cast.spell = spell;
      cast.strike = 0;
      cast.tell = tell;
      cast.active = active;
      cast.zones = ZONES.map((x) => ({ x, halfWidth: 90.0, bottom: 0.0, top: 400.0 }));
      const seen = new Set<number>();
      for (let into = 0; into < tell + active + 30; into++) {
        cast.into = into;
        spells.present(cast);
        const live = client.effects.snapshot({}).filter((pose) => pose.destroyed === undefined).map((pose) => ({ model: pose.model, id: pose.handle.id }));
        const created = new Set<number>();
        for (const { id } of live) if (!seen.has(id)) { seen.add(id); created.add(id); }
        frame(into, created, live);
      }
      spells.destroy();
    });
  } finally {
    runtime.restore();
  }
}

test("Archimonde's Rain of Fire impact stands one fire tower at every zone from the hit frame through 15 frames after it, never respawned [k1 scenario]", () => {
  const tell = 50;
  const born: number[] = [];
  let pillars: readonly number[] = [];
  play(BossSpell.rainOfFire, tell, 14, (into, created, live) => {
    const shown = live.filter((pose) => pose.model === FIRE_BURST_MODEL).map((pose) => pose.id);
    if (shown.some((id) => created.has(id))) born.push(into);
    if (into === tell) pillars = shown;
    if (into >= tell && into <= tell + HOLD) expect(shown).toEqual(pillars);
  });
  expect(born).toEqual([tell]);
  expect(pillars.length).toBe(ZONES.length);
});

test("Doom's Shockwave impact stands one fire jet at every pillar from the hit frame through 15 frames after it, never respawned [k1 scenario]", () => {
  const tell = 45;
  const born: number[] = [];
  let jets: readonly number[] = [];
  play(BossSpell.doomsShockwave, tell, 10, (into, created, live) => {
    const shown = live.filter((pose) => pose.model === SHOCKWAVE_MODEL).map((pose) => pose.id);
    if (shown.some((id) => created.has(id))) born.push(into);
    if (into === tell) jets = shown;
    if (into >= tell && into <= tell + HOLD) expect(shown).toEqual(jets);
  });
  expect(born).toEqual([tell]);
  expect(jets.length).toBe(SHOCKWAVE_POINTS);
});
