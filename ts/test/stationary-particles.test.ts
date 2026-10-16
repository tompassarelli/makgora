import { afterAll, beforeAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { SCORED_SPECIALS } from "../scripts/wisp/animScoreSample";
import { Character, SpecialAction } from "../src/game/sim/codes";
import { fighterSlug, heroDefinition } from "../src/game/sim/heroes/registry";
import { fighterAt } from "../src/game/sim/roster";
import { executeNext, testMatch } from "../src/game/match/testMatch";
import { ROSTER_MANA } from "../src/game/sim/mana";
import { ProjectilePresentation } from "../src/game/render/projectilePresentation";
import { SpecialCueEffects } from "../src/game/render/specialCueEffects";

let headless: ReturnType<typeof installHeadless>;
beforeAll(() => { headless = installHeadless(SMASHCRAFT_HEADLESS); });
afterAll(() => headless.restore());
const facts = new Map(Object.entries(MODEL_FACTS).map(([path, value]) => [path.toLowerCase(), value]));
const slots = ["neutral", "side", "up", "down"] as const;

for (const character of [Character.lich]) {
  for (const [index, entry] of SCORED_SPECIALS.entries()) {
    if (entry.move !== "side-special") continue;
    for (const aerial of [false]) for (const ex of [false]) {
      if (entry.ultimate === true && (aerial || ex)) continue;
      const kit = heroDefinition(character)?.specials[slots[index] ?? "neutral"];
      let form = aerial ? kit?.air ?? kit?.ground : kit?.ground;
      if (ex) form = form?.ex;
      if (entry.ultimate !== true && form === undefined && heroDefinition(character) !== undefined) continue;
      const run = () => {
        let particleSamples = 0;
        for (const facing of [-1, 1]) {
          const client = headless.clients({ start: () => {}, install: () => {} }, [0]).client(0);
          client.run(() => {
            globalThis.__smashcraftCueDefinitive = false;
            const match = testMatch(1, character), fighter = fighterAt(match.world, 0);
            match.game.practice = true;
            fighter.motion.x = 0;
            fighter.facing = facing;
            fighter.mana.points = ROSTER_MANA.max;
            if (aerial) {
              fighter.motion.grounded = false;
              fighter.motion.surface = undefined;
              fighter.motion.z = 300;
            }
            const cues = new SpecialCueEffects(character, { x: 0, y: 0, z: 0 });
            const presentation = new ProjectilePresentation(character, { x: 0, y: 0, z: 0 });
            const clocks = new Map<unknown, number>();
            let started = false, ended = 0;
            for (let frame = 1; frame <= 900; frame++) {
              const input = match.inputs.inputs[0];
              input.specialPressed = frame === 1;
              input.ultimatePressed = frame === 1 && entry.ultimate === true;
              input.exPressed = ex && frame === 1;
              input.specialX = facing * entry.x;
              input.specialZ = entry.z;
              executeNext(match);
              client.draw(1 / 60);
              cues.confirm(fighter, true, frame / 60);
              cues.present(fighter, true, false);
              presentation.present(fighter, true, false);
              started ||= fighter.special.action !== SpecialAction.none;
              if (started && fighter.special.action === SpecialAction.none && ended === 0) ended = frame;
              const drawn = client.effectPoses().filter(effect => effect.destroyed === undefined && effect.z > -500 && effect.scale > 0 && effect.alpha > 0);
              for (const projectile of fighter.projectiles) {
                const path = projectile.spec?.model;
                if (projectile.life <= 0 || projectile.velocityX !== 0 || projectile.velocityZ !== 0 || path === undefined || facts.get(path.toLowerCase())?.geosets !== 0) continue;
                expect(drawn.some(effect => effect.model.toLowerCase() === path.toLowerCase()), `frame ${frame}: stationary emitter-only projectile ${path} draws`).toBe(true);
              }
              for (const effect of drawn) {
                const known = facts.get(effect.model.toLowerCase());
                expect(known, `frame ${frame}: model path absent from measured inventory: ${effect.model}`).toBeDefined();
                const stationary = fighter.projectiles.some(p => p.life > 0 && p.velocityX === 0 && p.velocityZ === 0 && p.spec?.model?.toLowerCase() === effect.model.toLowerCase());
                if (!stationary || known?.geosets !== 0) continue;
                expect(known.emitters.some(emitter => emitter.visible && emitter.whileShown), `frame ${frame}: ${effect.model} has no visible emitter or geometry`).toBe(true);
                expect(effect.timeScale, `frame ${frame}: stationary particle ${effect.model} at ${effect.animationElapsed}`).toBeGreaterThan(0);
                const previous = clocks.get(effect.handle);
                if (previous !== undefined) expect(effect.animationClock, `frame ${frame}: ${effect.model} clock advances`).toBeGreaterThan(previous);
                clocks.set(effect.handle, effect.animationClock);
                particleSamples++;
              }
              if (ended > 0 && frame >= ended + 120) break;
            }
            expect(started).toBe(true);
            expect(ended).toBeGreaterThan(0);
            presentation.destroy();
            cues.destroy();
          });
          expect(client.errors).toEqual([]);
        }
        if (character === Character.lich && entry.move === "side-special" && !aerial && !ex) expect(particleSamples, "Lich Death and Decay samples").toBeGreaterThan(0);
      };
      test(`Classic ${fighterSlug(character)} ${entry.move} ${aerial ? "air" : "ground"} ${ex ? "EX" : "base"}: resolved drawn paths and stationary emitter-only clocks advance [k2 property]`, run);
    }
  }
}
