import { assertEquals, test } from "wisp/src/runtime/testing";
import { createMatchControls, startKeyDown, startKeyUp } from "../../game/match/controls";
import { PLAYABLE_CHARACTERS } from "../../game/sim/heroes/registry";
import { Phase, createMatchState, requestStageSelect, returnToCharacters, selectCharacter, selectStage, setParticipants, unreadyCharacter } from "../../game/lobby/lobbyState";
import { Key, ensureKeyTriggerPair, keyEventAllowed, syncKeyEventPolicy } from "./keyEvents";
import { BINDING_PRESETS, presetBindings } from "../../game/input/keyBindings";
import { Action } from "../../game/input/actions";
import { PAD_LAYER } from "../../game/input/padKeys";
import { PAUSE_CAMERA_KEYS, pauseHeldKeys } from "./pauseCamera";

const hitbox = presetBindings("standard");

test("character selection, start and stage keys keep one registration pair across menu cycles [k2 property]", () => {
  const state = createMatchState();
  setParticipants(state, 3, 0);
  const controls = createMatchControls();
  const policy = { enabled: true, escapeOnly: false };
  const triggers = { down: undefined as number | undefined, up: undefined as number | undefined };
  let nextTrigger = 0;
  let registrations = 0;
  const register = (): void => { registrations++; };
  const ensureTriggers = (): void => ensureKeyTriggerPair(triggers, () => nextTrigger++, register, () => {});
  const first = PLAYABLE_CHARACTERS[0];
  const second = PLAYABLE_CHARACTERS[1];
  if (first === undefined || second === undefined) throw new Error("two playable characters are required");

  for (let cycle = 0; cycle < 20; cycle++) {
    ensureTriggers();
    syncKeyEventPolicy(policy, false, false, false);
    assertEquals(keyEventAllowed(policy, Key.w, hitbox), true);
    selectCharacter(state, 0, first);
    selectCharacter(state, 1, second);
    assertEquals(startKeyDown(controls, 0, state.phase, false), "confirm");
    startKeyUp(controls, 0);
    assertEquals(requestStageSelect(state, 0), true);
    assertEquals(state.phase, Phase.stageMenu);
    assertEquals(keyEventAllowed(policy, Key.n, hitbox), true);
    selectStage(state, 0, state.stageChoice);
    syncKeyEventPolicy(policy, false, true, false);
    assertEquals(keyEventAllowed(policy, Key.escape, hitbox), true);
    assertEquals(keyEventAllowed(policy, Key.w, hitbox), false);
    syncKeyEventPolicy(policy, true, false, false);
    assertEquals(keyEventAllowed(policy, Key.w, hitbox), false);
    returnToCharacters(state, 0);
    unreadyCharacter(state, 0);
    unreadyCharacter(state, 1);
  }

  assertEquals(nextTrigger, 2);
  assertEquals(registrations, 1);
  assertEquals(triggers.down, 0);
  assertEquals(triggers.up, 1);
});

test("while paused every camera key moves the camera on each preset, and a pad jump held across resume is not held back [k2 property]", () => {
  const policy = { enabled: true, escapeOnly: false };
  syncKeyEventPolicy(policy, true, true, false);
  const jump = PAD_LAYER.find(({ action }) => action === Action.jump)!.code;
  for (const preset of BINDING_PRESETS) {
    const bindings = presetBindings(preset);
    const held = pauseHeldKeys(bindings);
    for (const key of PAUSE_CAMERA_KEYS) {
      assertEquals(keyEventAllowed(policy, key, bindings), true, `${preset} paused camera key ${key}`);
      assertEquals(held.includes(key), true, `${preset} held camera key ${key}`);
    }
    assertEquals(PAUSE_CAMERA_KEYS.includes(jump), false, "the pad jump key is not a camera key");
    assertEquals(held.includes(jump), false, `${preset} holds the pad jump key across resume`);
  }
});
