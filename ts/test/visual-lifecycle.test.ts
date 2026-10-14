import { expect, test } from "bun:test";
import { createFrameControls } from "../src/game/match/controls";
import { captureFrame, createMatchFrameInput } from "../src/game/match/frameInput";
import { Phase, requestStageSelect, selectCharacter } from "../src/game/match/rules";
import { executeNext, startAtGo, testMatch } from "../src/game/match/testMatch";
import { IMPACT_DUST, IMPACTS_PER_KIND } from "../src/game/presentation/impactState";
import { cameraPoint, FLOOR_HEIGHT } from "../src/game/presentation/arenaCamera";
import { ReplayCorrections, ReplayHistory } from "../src/game/replay/history";
import { MATCH_CAMERA_ASPECT } from "../src/game/sim/matchCamera";
import { ROSTER_MANA } from "../src/game/sim/mana";
import { IMPACT_HIT_MODEL } from "../src/game/assets/impactAssetInfo";
import { PROJECTILE_DRAW_OFFSETS } from "../src/game/presentation/projectileArt";
import { AttackStyle, Character, SpecialAction } from "../src/game/sim/codes";
import { FIGHTER_ULTIMATES } from "../src/game/sim/ultimates";
import { SELECTABLE_CHARACTERS, heroDefinition } from "../src/game/sim/heroes/registry";
import { createFighter } from "../src/game/sim/fighter";
import { soloWorld } from "../src/game/sim/testWorld";
import { copyControls, neutralControls } from "../src/game/sim/roster";
import { beginFighterAttack } from "../src/game/sim/attacks";
import { advanceFighter } from "../src/game/sim/step";
import { advanceFighterPose, createFighterPose } from "../src/game/presentation/fighterPose";
import { FighterPoolPresentation } from "../src/game/render/fighterPool";
import { originalLightPath } from "../src/game/assets/fighterOriginalClipInfo";
import { fighterAt } from "../src/game/sim/roster";
import { install, start } from "../src/platform/main";
import { applyFrame } from "../src/platform/shell/frame";
import { startMatch } from "../src/platform/shell/matchStart";
import { confirm } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
import { pauseMatchPresentation, renderPersistentPresentation, serviceResumePresentation } from "../src/platform/shell/view";
import { testHeadless } from "./headless";
import type { EffectPose, HeadlessClient } from "wisp/src/headless/client";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { SpecialCueEffects } from "../src/game/render/specialCueEffects";

const headless = testHeadless(SMASHCRAFT_HEADLESS);


function effectPoses(client: HeadlessClient): Map<unknown, EffectPose> {
  return new Map(client.effectPoses().map((pose) => [pose.handle, pose]));
}

const hidden = (pose: EffectPose) => pose.alpha === 0 || pose.scale === 0;

function visible(client: HeadlessClient, handles: ReadonlySet<unknown>): Map<unknown, EffectPose> {
  return new Map([...effectPoses(client)].filter(([handle, pose]) => handles.has(handle) && !hidden(pose)));
}

// Alpha, scale and time scale do not stop Warcraft model particle emitters.




function hiddenInView(client: HeadlessClient): unknown[] {
  const ground = shell().origin.z - FLOOR_HEIGHT;
  return [...effectPoses(client)].filter(([, pose]) => hidden(pose) && pose.z > ground).map(([handle]) => handle);
}

test("every fighter's charged smashes hold their drawn pose and start one swing on release (#436) [k2 property]", () => {
  const client = headless.clients({ start: () => {}, install: () => {} }, [0]).client(0);
  client.run(() => {
    for (const character of SELECTABLE_CHARACTERS) for (const style of [AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash]) {
      const fighter = createFighter(character, 0, 1);
      const world = soloWorld(fighter), input = neutralControls(), pose = createFighterPose();
      const pool = new FighterPoolPresentation(character, 0, { x: 0, y: 0, z: 0 });
      beginFighterAttack(world, 0, style, true);
      let held: EffectPose | undefined, released: EffectPose | undefined;
      let chargeSelection = 0, releaseSelection = 0;
      for (let frame = 0; frame < 140; frame++) {
        input.attackHeld = frame < 40;
        if (frame > 0) advanceFighter(world, 0, 0, input, 0, frame);
        advanceFighterPose(pose, fighter, world, input, false, false, frame === 0, false);
        pool.present(fighter, pose, 0, frame);
        const body = client.effectPoses({ visibleOnly: true }).find(effect => effect.destroyed === undefined && effect.model !== originalLightPath(character));
        expect(body, `${character}/${style}/${frame}: drawn body`).toBeDefined();
        if (body === undefined) throw new Error("missing drawn body");
        if (frame === 0) { held = body; chargeSelection = pose.selectionSerial; }
        if (frame < 40) {
          expect(body.handle).toBe(held?.handle);
          expect(body.animationElapsed).toBe(held?.animationElapsed);
          expect(body.timeScale).toBe(0);
          expect(pose.selectionSerial).toBe(chargeSelection);
        } else if (frame === 40) {
          expect(pose.selectionSerial).toBe(chargeSelection + 1);
          releaseSelection = pose.selectionSerial;
          released = body;
        } else if (fighter.attack.style !== undefined) {
          expect(pose.selectionSerial).toBe(releaseSelection);
          expect(body.handle).toBe(released?.handle);
          expect(body.animationElapsed).toBeGreaterThanOrEqual(released?.animationElapsed ?? 0);
          if (frame === 41) expect(body.animationElapsed, `${character}/${style}: release clock`).toBeGreaterThan(released?.animationElapsed ?? 0);
          released = body;
        } else break;
      }
      expect(pool.missingSelections).toBe(0);
      pool.destroy();
    }
  });
  expect(client.errors).toEqual([]);
});

test("combat effects: rollback, pause/resume and rematch neither replay nor retain effects [k1 scenario]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing host client");
  client.run(() => {
    const s = shell();
    selectCharacter(s.game, 0, Character.demonHunter);
    selectCharacter(s.game, 1, Character.rifleman);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(startAtGo(s.game, 0)).toBe(true);
    startMatch(s);
    s.game.timeLimitMinutes = 0;
    const handles = new Set([...effectPoses(client)].filter(([, pose]) => hidden(pose)).map(([handle]) => handle));
    expect(hiddenInView(client)).toEqual([]);
    const initialAllocations = client.log.filter(({ name }) => name === "AddSpecialEffect").length;
    const history = new ReplayHistory();
    const live = { world: s.world, match: s.game, controls: s.produced, runtime: s.runtime };
    expect(history.beginEpoch(14, 1, 12)).toBe(true);
    const step = () => {
      const frame = s.runtime.simulationFrame + 1;
      expect(captureFrame(s.frameInput, frame, s.world.mask, s.produced, s.runtime)).toBe(true);
      expect(history.saveSpeculative(14, s.frameInput, live)).toBe(true);
      applyFrame(s);
      renderPersistentPresentation(s);
    };
    const actionStart = client.log.length;
    s.produced.inputs[0].specialPressed = true;
    step();
    s.produced.inputs[0].specialPressed = false;
    const resets = client.log.slice(actionStart).filter(({ name, args }) => name === "BlzSetSpecialEffectTime" && args[1] === 0);
    expect(resets).toHaveLength(1);
    const animated = resets[0]?.args[0];
    const restarts = () => client.log.slice(actionStart).filter(({ name, args }) => name === "BlzSetSpecialEffectTime" && args[0] === animated && args[1] === 0);
    expect(visible(client, handles).has(animated)).toBe(true);
    s.produced.inputs[1].groundDodgePressed = true;
    s.produced.inputs[1].shield = true;
    step();
    s.produced.inputs[1].groundDodgePressed = false;
    s.produced.inputs[1].shield = false;
    for (let frame = 3; frame <= 5; frame++) step();
    expect(s.runtime.impacts.nextSlot[IMPACT_DUST]).toBe(2);
    expect(hiddenInView(client)).toEqual([]);
    const beforeCorrection = visible(client, handles);
    const corrected = createMatchFrameInput();
    expect(captureFrame(corrected, 2, s.world.mask, createFrameControls(), s.runtime)).toBe(true);
    const corrections = new ReplayCorrections();
    expect(corrections.beginEpoch(14)).toBe(true);
    expect(corrections.add(corrected)).toBe(true);
    const traceBeforeReplay = client.log.length;
    expect(history.correct(14, corrections, live)).toBe(2);
    expect(client.log.length).toBe(traceBeforeReplay);
    expect(s.runtime.impacts.nextSlot[IMPACT_DUST]).toBe(0);
    expect(s.runtime.impacts.ages[IMPACT_DUST * IMPACTS_PER_KIND]).toBeUndefined();
    renderPersistentPresentation(s);
    s.ui?.special.presentConfirmedAnimated(s.runtime.simulationFrame, fighterAt(s.world, 0), 0);
    expect(visible(client, handles).size).toBeLessThan(beforeCorrection.size);
    expect(restarts()).toHaveLength(1);
    expect(client.log.filter(({ name }) => name === "AddSpecialEffect")).toHaveLength(initialAllocations);
    expect(hiddenInView(client)).toEqual([]);

    s.session.paused = true;
    pauseMatchPresentation(s, true);
    const paused = visible(client, handles);
    expect(paused.has(animated)).toBe(true);
    expect(paused.get(animated)?.timeScale).toBe(0);
    expect([...paused.values()].every((pose) => pose.timeScale === 0)).toBe(true);
    expect(hiddenInView(client)).toEqual([]);
    for (let callback = 0; callback < 20; callback++) renderPersistentPresentation(s);
    expect(s.runtime.simulationFrame).toBe(5);
    expect(visible(client, handles)).toEqual(paused);
    expect(restarts()).toHaveLength(1);
    s.session.paused = false;
    pauseMatchPresentation(s, false);
    client.setWallTime(client.clockSeconds() + 1 / 60);
    client.draw(1 / 60);
    serviceResumePresentation(s);
    renderPersistentPresentation(s);
    expect(visible(client, handles)).toEqual(paused);
    expect(visible(client, handles).get(animated)?.timeScale).toBe(0);
    client.setWallTime(client.clockSeconds() + 2 / 60);
    serviceResumePresentation(s);
    expect(visible(client, handles).get(animated)?.timeScale).toBe(1);
    step();
    expect(s.runtime.simulationFrame).toBe(6);
    expect(restarts()).toHaveLength(1);

    s.game.timeLimitMinutes = 1;
    s.game.remainingFrames = 1;
    step();
    expect(s.game.phase).toBe(Phase.result);
    expect(visible(client, handles).size).toBe(0);
    expect(hiddenInView(client)).toEqual([]);
    confirm(s, 0);
    confirm(s, 1);
    expect(s.game.phase).toBe(Phase.characterMenu);
    expect(visible(client, handles).size).toBe(0);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(startAtGo(s.game, 0)).toBe(true);
    startMatch(s);
    expect(s.runtime.simulationFrame).toBe(0);
    expect(visible(client, handles).size).toBe(0);
    expect(hiddenInView(client)).toEqual([]);
    s.produced.inputs[0].specialPressed = true;
    expect(captureFrame(s.frameInput, 1, s.world.mask, s.produced, s.runtime)).toBe(true);
    applyFrame(s);
    renderPersistentPresentation(s);
    expect(visible(client, handles).has(animated)).toBe(true);

    expect(restarts().filter(({ args }) => args[0] === animated)).toHaveLength(2);

    s.game.remainingFrames = 1;
    expect(captureFrame(s.frameInput, 2, s.world.mask, s.produced, s.runtime)).toBe(true);
    applyFrame(s);
    renderPersistentPresentation(s);
    confirm(s, 0);
    confirm(s, 1);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(startAtGo(s.game, 0)).toBe(true);
    startMatch(s);
    const rifleman = fighterAt(s.world, 1), target = fighterAt(s.world, 0);
    rifleman.motion.x = 200;
    rifleman.facing = -1;
    rifleman.mana.points = ROSTER_MANA.max;
    target.motion.x = -200;
    const aimed = new Set<number>(), traced = new Set<number>();
    const lightningAllocations = client.log.filter(({ name }) => name === "AddLightningEx").length;
    let flashed = false;
    for (let tick = 1; tick <= 60; tick++) {
      for (const input of s.produced.inputs) copyControls(input, neutralControls());
      s.produced.inputs[1].ultimatePressed = tick === 1;
      s.produced.inputs[1].attackHeld = tick === 1;
      s.produced.inputs[1].specialPressed = tick === 1;
      const before = client.log.length;
      expect(captureFrame(s.frameInput, tick, s.world.mask, s.produced, s.runtime)).toBe(true);
      applyFrame(s);
      renderPersistentPresentation(s);
      const calls = client.log.slice(before);
      const aim = calls.find(({ name, args }) => name === "SetLightningColor" && args[1] === 1 && args[2] === 0 && args[3] === 0 && args[4] === 1);
      const trace = calls.find(({ name, args }) => name === "SetLightningColor" && args[1] === 1 && args[2] === 0.75 && args[3] === 0.25 && args[4] === 1);
      if (aim !== undefined) aimed.add(rifleman.special.frame);
      if (trace !== undefined) {
        traced.add(rifleman.special.frame);
        const moved = calls.find(({ name, args }) => name === "MoveLightningEx" && args[0] === trace.args[0]);
        expect(moved).toBeDefined();
        const x1 = moved?.args[2], z1 = moved?.args[4], x2 = moved?.args[5], z2 = moved?.args[7];
        if (typeof x1 !== "number" || typeof z1 !== "number" || typeof x2 !== "number" || typeof z2 !== "number") throw new Error("missing tracer segment");
        const first = cameraPoint(s.camera, MATCH_CAMERA_ASPECT, x1 - s.origin.x, z1 - s.origin.z);
        const last = cameraPoint(s.camera, MATCH_CAMERA_ASPECT, x2 - s.origin.x, z2 - s.origin.z);
        expect(Math.min(first.column, last.column)).toBeLessThan(1);
        expect(Math.max(first.column, last.column)).toBeGreaterThan(0);
        expect(first.row).toBeGreaterThan(0);
        expect(first.row).toBeLessThan(1);
      }
      flashed ||= client.effectPoses({ visibleOnly: true }).some(pose => pose.model === IMPACT_HIT_MODEL && !hidden(pose));
    }
    expect([...aimed]).toEqual(Array.from({ length: 29 }, (_, index) => index + 4));
    expect([...traced]).toEqual([36, 37, 38, 39, 40, 41]);
    expect(flashed).toBe(true);
    expect(target.status.damage).toBeGreaterThan(0);
    expect(client.log.filter(({ name }) => name === "AddLightningEx")).toHaveLength(lightningAllocations);

    globalThis.__smashcraftCueDefinitive = false;
    const chenMatch = testMatch(1, Character.chen), chen = fighterAt(chenMatch.world, 0), breathInput = chenMatch.inputs.inputs[0];
    chenMatch.game.practice = true;
    chen.mana.points = ROSTER_MANA.max;
    const breath = new SpecialCueEffects(Character.chen, { x: 0, y: 0, z: 100 }, true);
    const fire = () => client.effectPoses({ visibleOnly: true }).filter(pose => pose.model.includes("BreathOfFireMissile") && !hidden(pose));
    for (let frame = 0; frame < 14; frame++) {
      breathInput.specialPressed = frame === 0;
      executeNext(chenMatch);
    }
    breath.confirm(chen, true, 0);
    breath.present(chen, true, false);
    const confirmedBreath = fire();
    expect(confirmedBreath.length).toBeGreaterThan(0);
    for (let frame = 14; frame < 42; frame++) {
      breathInput.specialPressed = false;
      executeNext(chenMatch);
    }
    breath.present(chen, true, false);
    expect(fire()).toEqual(confirmedBreath);
    breath.confirm(chen, true, 0.2);
    breath.present(chen, true, false);
    expect(fire()).toEqual([]);
    breath.destroy();

  });
  expect(client.errors).toEqual([]);
});

test("however Rifleman's Aimed Shot ends, no ultimate effect stays on screen one frame past its lifetime (#457) [k1 scenario]", () => {
  const ultimate = FIGHTER_ULTIMATES[Character.rifleman];
  if (ultimate === undefined) throw new Error("missing Rifleman ultimate");
  const models = new Set((ultimate.projectiles ?? []).map((shot) => shot.model));
  const shots = new Set(ultimate.projectiles ?? []);
  for (const ending of ["natural", "hit", "ko", "match end"] as const) {
    const clients = headless.clients({ start, install });
    clients.start();
    clients.frames(30);
    const client = clients.clients[0];
    if (client === undefined) throw new Error("missing host client");
    client.run(() => {
      const s = shell();
      selectCharacter(s.game, 0, Character.demonHunter);
      selectCharacter(s.game, 1, Character.rifleman);
      expect(requestStageSelect(s.game, 0)).toBe(true);
      expect(startAtGo(s.game, 0)).toBe(true);
      startMatch(s);
      s.game.timeLimitMinutes = 0;
      const rifleman = fighterAt(s.world, 1), target = fighterAt(s.world, 0);
      rifleman.motion.x = 200;
      rifleman.facing = -1;
      rifleman.mana.points = ROSTER_MANA.max;
      target.motion.x = ending === "hit" ? 140 : -200;
      target.facing = 1;
      const ground = s.origin.z - FLOOR_HEIGHT;
      let tick = 0;
      const step = () => {
        tick++;
        for (const input of s.produced.inputs) copyControls(input, neutralControls());
        s.produced.inputs[1].ultimatePressed = tick === 1;
        s.produced.inputs[1].attackHeld = tick === 1;
        s.produced.inputs[1].specialPressed = tick === 1;
        if (ending === "hit" && tick === 12) s.produced.inputs[0].specialPressed = true;
        if (ending === "ko" && tick === 20) rifleman.motion.x = 99999;
        if (ending === "match end" && tick === 38) { s.game.timeLimitMinutes = 1; s.game.remainingFrames = 1; }
        expect(captureFrame(s.frameInput, tick, s.world.mask, s.produced, s.runtime)).toBe(true);
        applyFrame(s);
        renderPersistentPresentation(s);
      };
      step();
      expect(rifleman.special.action).toBe(SpecialAction.heroUltimate);
      while (rifleman.special.action === SpecialAction.heroUltimate && s.game.phase === Phase.match) step();
      if (ending === "natural") expect(tick).toBe(ultimate.endFrame);
      else expect(tick).toBeLessThan(ultimate.endFrame);
      while (s.game.phase === Phase.match && rifleman.projectiles.some((projectile) => projectile.spec !== undefined && shots.has(projectile.spec) && projectile.life > 0)) step();
      step();
      const effects = client.effectPoses({ visibleOnly: true }).filter((pose) => pose.destroyed === undefined && models.has(pose.model) && pose.z > ground);
      expect(effects.map((pose) => `${ending}: ${pose.model}`)).toEqual([]);
      const bolts = client.lightnings.poses().filter((bolt) => bolt.codeName === "LEAS");
      expect(bolts).toHaveLength(2);
      for (const bolt of bolts) {
        expect(bolt.color[3], `${ending}: bolt alpha`).toBe(0);
        expect(Math.max(bolt.from[2] ?? 0, bolt.to[2] ?? 0), `${ending}: bolt left on stage`).toBeLessThan(ground);
      }
    });
    expect(client.errors).toEqual([]);
  }
});

test("Classic Cairne's Shockwave draws a playing wave on its projectile for the projectile's whole life, both facings (#484) [k1 scenario]", () => {
  const wave = heroDefinition(Character.cairne)?.specials.neutral.ground.projectiles?.[0];
  if (wave?.model === undefined) throw new Error("missing Cairne Shockwave projectile");
  const offset = Math.abs(PROJECTILE_DRAW_OFFSETS[wave.model]?.x ?? 0.0);
  for (const facing of [-1, 1]) {
    const clients = headless.clients({ start, install });
    clients.start();
    clients.frames(30);
    const client = clients.clients[0];
    if (client === undefined) throw new Error("missing host client");
    client.run(() => {
      globalThis.__smashcraftCueDefinitive = false;
      const s = shell();
      selectCharacter(s.game, 0, Character.cairne);
      selectCharacter(s.game, 1, Character.cairne);
      expect(requestStageSelect(s.game, 0)).toBe(true);
      expect(startAtGo(s.game, 0)).toBe(true);
      startMatch(s);
      s.game.timeLimitMinutes = 0;
      const cairne = fighterAt(s.world, 0), target = fighterAt(s.world, 1);
      cairne.motion.x = -400 * facing;
      cairne.facing = facing;
      cairne.mana.points = ROSTER_MANA.max;
      target.motion.x = 2000 * facing;
      let tick = 0, drawn = 0, alive = 0;
      const clocks = new Map<unknown, number>();
      const births = new Map<unknown, number>();
      const step = () => {
        tick++;
        for (const input of s.produced.inputs) copyControls(input, neutralControls());
        s.produced.inputs[0].specialPressed = tick === 1;
        expect(captureFrame(s.frameInput, tick, s.world.mask, s.produced, s.runtime)).toBe(true);
        applyFrame(s);
        renderPersistentPresentation(s);
        client.draw(1 / 60);
      };
      for (let frame = 0; frame < 120 && (tick < 2 || cairne.projectiles.some((p) => p.life > 0) || drawn === 0); frame++) {
        const traceStart = client.log.length;
        step();
        const calls = client.log.slice(traceStart);
        const live = cairne.projectiles.filter((p) => p.spec?.model === wave.model && p.life > 0);
        const waves = client.effectPoses({ visibleOnly: true }).filter((pose) => pose.destroyed === undefined && pose.model === wave.model);
        alive += live.length;
        for (const projectile of live) {
          const pose = waves.find((effect) => Math.abs(effect.x - (s.origin.x + projectile.x)) <= wave.radius + offset);
          expect(pose, `tick ${tick}: wave drawn at projectile x ${projectile.x}`).toBeDefined();
          if (pose === undefined) continue;
          expect(pose.timeScale, `tick ${tick}: wave animation plays`).toBeGreaterThan(0);
          const previous = clocks.get(pose.handle);
          if (previous !== undefined) expect(pose.animationClock, `tick ${tick}: wave clock advances`).toBeGreaterThan(previous);
          const bornLife = births.get(pose.handle);
          if (bornLife === undefined) births.set(pose.handle, projectile.life);
          else if (projectile.life === bornLife - 1) expect(calls.some(call => call.name === "BlzSetSpecialEffectTime" && call.args[0] === pose.handle), "second callback seeks the wave after sequence selection (#58)").toBe(true);
          clocks.set(pose.handle, pose.animationClock);
          drawn++;
        }
      }
      expect(alive, "wave frames alive").toBeGreaterThan(0);
      expect(drawn, "wave frames drawn").toBe(alive);
    });
    expect(client.errors).toEqual([]);
  }
});


test("Mirror Image matches its owning fighter colour across repeated casts, expiry, results and rematches [k1 scenario]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(30);
  const client = clients.client(0);
  client.run(() => {
    const s = shell();
    for (const slot of [0, 1]) selectCharacter(s.game, slot, Character.blademaster);
    const imagePath = heroDefinition(Character.blademaster)?.presentation.placedModel?.path;
    expect(imagePath).toBeDefined();
    const images = () => client.effectPoses({ visibleOnly: true }).filter(pose => pose.model === imagePath && pose.z > s.origin.z - 500 && pose.scale > 0 && pose.alpha > 0);
    const step = () => {
      expect(captureFrame(s.frameInput, s.runtime.simulationFrame + 1, s.world.mask, s.produced, s.runtime)).toBe(true);
      applyFrame(s);
      renderPersistentPresentation(s);
    };
    for (let rematch = 0; rematch < 2; rematch++) {
      expect(requestStageSelect(s.game, 0)).toBe(true);
      expect(startAtGo(s.game, 0)).toBe(true);
      startMatch(s);
      s.game.practice = true;
      s.game.timeLimitMinutes = 0;
      expect(images()).toHaveLength(0);
      for (const slot of [0, 1]) {
        const body = client.unitPoses().find(pose => pose.owner === slot);
        expect(body?.teamColor).toBe(slot);
        const fighter = fighterAt(s.world, slot);
        fighter.motion.x = slot === 0 ? -300 : 300;
      }
      for (let cast = 0; cast < (rematch === 0 ? 3 : 1); cast++) {
        for (const slot of [0, 1]) {
          const input = s.produced.inputs[slot];
          input.specialPressed = true;
          input.specialZ = -1;
          fighterAt(s.world, slot).mana.points = ROSTER_MANA.max;
        }
        step();
        for (const slot of [0, 1]) s.produced.inputs[slot].specialPressed = false;
        while (fighterAt(s.world, 0).placed.life === 0 && s.runtime.simulationFrame < 1000) step();
        const drawn = images();
        expect(drawn).toHaveLength(2);
        for (const slot of [0, 1]) {
          const fighter = fighterAt(s.world, slot);
          const image = drawn.find(pose => pose.x === s.origin.x + fighter.placed.x);
          expect(image?.teamColor, `P${slot + 1} decoy matches its body`).toBe(slot);
          expect(image?.alpha).toBe(heroDefinition(Character.blademaster)?.presentation.placedModel?.alpha);
        }
        if (rematch === 0 && cast < 2) {
          const remaining = fighterAt(s.world, 0).placed.life;
          expect(remaining + 1).toBe(fighterAt(s.world, 0).placed.spec?.life);
          for (let tick = 1; tick <= remaining; tick++) {
            step();
            expect(images()).toHaveLength(tick < remaining ? 2 : 0);
          }
        }
      }
      s.game.practice = false;
      s.game.timeLimitMinutes = 1;
      s.game.remainingFrames = 1;
      step();
      expect(s.game.phase).toBe(Phase.result);
      expect(images()).toHaveLength(0);
      confirm(s, 0);
      confirm(s, 1);
      expect(s.game.phase).toBe(Phase.characterMenu);
      expect(images()).toHaveLength(0);
    }
  });
  expect(client.errors).toEqual([]);
});
