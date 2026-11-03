import { expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { MAKGORA_HEADLESS } from "../scripts/wisp/headless";
import { FLOOR_HEIGHT, PLAYABLE_BOUNDS } from "../src/game/presentation/arenaCamera";
import { BossSpell, FIRE_BURST_MODEL, SHOCKWAVE_MODEL } from "../src/game/presentation/bossSpellArt";
import { BossSpells, spellCast } from "../src/game/render/bossSpells";

const HOLD = 15;
const BURST_SHOWS = 4;

test("Archimonde's Rain of Fire and Doom's Shockwave impact bursts appear first on the hit frame and a fresh burst stays on screen through 15 frames after it, at every zone or pillar [k1 scenario]", () => {
  const runtime = installHeadless(MAKGORA_HEADLESS);
  try {
    const clients = runtime.clients({ install() {}, start() {} }, [0]);
    const client = clients.client(0);
    clients.start();
    client.run(() => {
      const origin = { x: 0.0, y: PLAYABLE_BOUNDS.centreY, z: FLOOR_HEIGHT };
      for (const [spell, model, places, tell, active] of [[BossSpell.rainOfFire, FIRE_BURST_MODEL, 3, 50, 14], [BossSpell.doomsShockwave, SHOCKWAVE_MODEL, 11, 45, 10]] as const) {
        const spells = new BossSpells(origin);
        const cast = spellCast();
        cast.spell = spell;
        cast.strike = 0;
        cast.tell = tell;
        cast.active = active;
        cast.zones = [-300.0, 0.0, 300.0].map((x) => ({ x, halfWidth: 90.0, bottom: 0.0, top: 400.0 }));
        const seen = new Set<number>();
        const born: number[] = [];
        for (let into = 0; into < tell + active + 30; into++) {
          cast.into = into;
          spells.present(cast);
          let fresh = 0;
          for (const pose of client.effects.snapshot({})) {
            if (pose.model !== model || seen.has(pose.handle.id)) continue;
            seen.add(pose.handle.id);
            fresh++;
          }
          if (fresh > 0) {
            expect(fresh).toBe(places);
            born.push(into);
          }
        }
        expect(born[0]).toBe(tell);
        for (let into = tell; into <= tell + HOLD; into++) expect(born.some((at) => at <= into && into - at < BURST_SHOWS + 1)).toBe(true);
        spells.destroy();
      }
    });
  } finally {
    runtime.restore();
  }
});

test("a held or paused match freezes Archimonde's Rain of Fire impact bursts where they stand and keeps them until play resumes, so a held capture frame shows the burst its frame drew [k1 scenario]", () => {
  const runtime = installHeadless(MAKGORA_HEADLESS);
  try {
    const clients = runtime.clients({ install() {}, start() {} }, [0]);
    const client = clients.client(0);
    clients.start();
    client.run(() => {
      const origin = { x: 0.0, y: PLAYABLE_BOUNDS.centreY, z: FLOOR_HEIGHT };
      const spells = new BossSpells(origin);
      const cast = spellCast();
      cast.spell = BossSpell.rainOfFire;
      cast.strike = 0;
      cast.tell = 50;
      cast.active = 14;
      cast.zones = [-300.0, 0.0, 300.0].map((x) => ({ x, halfWidth: 90.0, bottom: 0.0, top: 400.0 }));
      const bursts = () => client.effects.snapshot({}).filter((pose) => pose.model === FIRE_BURST_MODEL);
      for (let into = 0; into <= cast.tell; into++) {
        cast.into = into;
        spells.present(cast);
      }
      const drawn = bursts().map((pose) => pose.handle.id);
      expect(drawn.length).toBe(cast.zones.length);
      spells.setPaused(true);
      for (let held = 0; held < 600; held++) spells.present(cast);
      expect(bursts().map((pose) => pose.handle.id)).toEqual(drawn);
      for (const pose of bursts()) expect(pose.timeScale).toBe(0);
      spells.setPaused(false);
      for (const pose of bursts()) expect(pose.timeScale).toBe(1);
      spells.destroy();
    });
  } finally {
    runtime.restore();
  }
});
