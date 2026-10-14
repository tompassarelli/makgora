import { expect, test } from "bun:test";
import { Character, SpecialAction } from "../src/game/sim/codes";
import { SpecialForm } from "../src/game/sim/heroSpecials";
import { fighterAt } from "../src/game/sim/roster";
import { ROSTER_MANA } from "../src/game/sim/mana";
import { executeNext, testMatch } from "../src/game/match/testMatch";
import { SpecialCueEffects } from "../src/game/render/specialCueEffects";
import { ProjectilePresentation } from "../src/game/render/projectilePresentation";
import { PlacedObjectEffects } from "../src/game/render/placedObjectEffects";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);
const explosion = "Objects\\Spawnmodels\\Other\\NeutralBuildingExplosion\\NeutralBuildingExplosion.mdx";

test("Peon's lumber and burrow place/pack lifecycle emits no explosion model or audio, while Worksite Launch keeps its blast (#563) [k1 scenario]", () => {
  for (const definitive of [false, true]) for (const ex of [false, true]) {
    const client = headless.clients({ start: () => {}, install: () => {} }, [0]).client(0);
    client.run(() => {
      globalThis.__smashcraftCueDefinitive = definitive;
      const match = testMatch(1, Character.peon), fighter = fighterAt(match.world, 0), input = match.inputs.inputs[0];
      match.game.practice = true;
      fighter.motion.x = 0;
      const cues = new SpecialCueEffects(Character.peon, { x: 0, y: 0, z: 0 }, true);
      const shots = new ProjectilePresentation(Character.peon, { x: 0, y: 0, z: 0 });
      const placed = new PlacedObjectEffects({ x: 0, y: 0, z: 0 });
      placed.prepareFighter(0, Character.peon);
      let lumber = false, burrow = false, packed = false, launched = false;
      const audioStart = client.soundLog.length;
      for (let frame = 1; frame <= 430; frame++) {
        input.specialPressed = frame === 1 || frame === 100 || frame === 180 || frame === 360;
        input.specialX = frame >= 100 && frame < 360 ? 1 : 0;
        input.specialZ = frame >= 360 ? 1 : 0;
        input.shield = ex && input.specialPressed;
        if (input.specialPressed) fighter.mana.points = ROSTER_MANA.max;
        executeNext(match);
        client.draw(1 / 60);
        cues.confirm(fighter, true, frame / 60);
        cues.present(fighter, true, false);
        shots.present(fighter, true, false);
        placed.presentConfirmed(frame, fighter, 0);
        placed.present(fighter, 0);
        const visible = client.effectPoses({ visibleOnly: true }).filter(pose => pose.z > -500 && pose.scale > 0 && pose.alpha > 0);
        const blasts = visible.filter(pose => pose.model === explosion);
        if (frame < 360) {
          expect(blasts, `frame ${frame}: explosion Birth also carries intrinsic SNDxDHLB`).toHaveLength(0);
          expect(client.soundLog.slice(audioStart).filter(cue => cue.event === "start" && /explosion|DeathHumanLargeBuilding|DeathOrcLargeBuilding|BuildingDeathLarge|DHLB|DOLB/i.test(`${cue.label ?? ""} ${cue.source ?? ""}`))).toHaveLength(0);
        } else launched ||= blasts.length > 0;
        lumber ||= visible.some(pose => pose.model.includes("BundleofLumber"));
        burrow ||= fighter.placed.life > 0 && visible.some(pose => pose.model.includes("TrollBurrow"));
        packed ||= fighter.special.action === SpecialAction.heroSide && fighter.special.form === SpecialForm.recall;
        if (frame === 340) expect(fighter.placed.life).toBe(0);
      }
      expect({ lumber, burrow, packed, launched }).toEqual({ lumber: true, burrow: true, packed: true, launched: true });
      cues.clear(); shots.clear(); placed.clear();
      expect(client.effectPoses({ visibleOnly: true }).filter(pose => pose.model === explosion && pose.z > -500 && pose.scale > 0)).toHaveLength(0);
      placed.destroy(); shots.destroy(); cues.destroy();
    });
    expect(client.errors).toEqual([]);
  }
});
