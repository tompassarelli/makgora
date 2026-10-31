import { expect, test } from "bun:test";
import { ARENA_CAMERA } from "../src/game/presentation/arenaCamera";
import { Phase, ResultPick } from "../src/game/lobby/lobbyState";
import { pickResult } from "../src/host/loop/menus";
import { shell } from "../src/host/loop/state";
import { NEUTRAL_INPUT, createStandaloneSession } from "../scripts/wisp/standalone";

const MATCH_FRAME_LIMIT = 20000;
const RESULT_FRAMES = 700;

type Session = Awaited<ReturnType<typeof createStandaloneSession>>;

const read = (session: Session): number[] => {
  let fields: number[] = [];
  session.client.run(() => {
    fields = [CAMERA_FIELD_ROTATION, CAMERA_FIELD_ANGLE_OF_ATTACK, CAMERA_FIELD_TARGET_DISTANCE, CAMERA_FIELD_ZOFFSET, CAMERA_FIELD_FIELD_OF_VIEW].map(field => GetCameraField(field));
    fields.push(GetCameraTargetPositionX());
  });
  return fields;
};

const phase = (session: Session): Phase => {
  let value = Phase.match;
  session.client.run(() => { value = shell().game.phase as Phase; });
  return value;
};

test("the results camera keeps the match camera's heading and pitch on every frame [k1 scenario]", async () => {
  const session = await createStandaloneSession({ start: "results" });
  try {
    let frames = 0;
    while (!session.finished() && frames++ < MATCH_FRAME_LIMIT) {
      session.step(NEUTRAL_INPUT);
      expect(read(session).slice(0, 2)).toEqual([ARENA_CAMERA.rotation, ARENA_CAMERA.angleOfAttack]);
    }
    expect(phase(session)).toBe(Phase.result);
    for (let frame = 0; frame < RESULT_FRAMES; frame++) {
      session.step(NEUTRAL_INPUT);
      expect(read(session).slice(0, 2)).toEqual([ARENA_CAMERA.rotation, ARENA_CAMERA.angleOfAttack]);
    }
  } finally {
    session.close();
  }
}, 120_000);

test("a rematch's first frame has the camera a fresh match's first frame has [k1 scenario]", async () => {
  const fresh = await createStandaloneSession();
  let freshFirst: number[];
  try {
    fresh.step(NEUTRAL_INPUT);
    freshFirst = read(fresh);
  } finally {
    fresh.close();
  }
  const session = await createStandaloneSession({ start: "results" });
  try {
    let frames = 0;
    while (!session.finished() && frames++ < MATCH_FRAME_LIMIT) session.step(NEUTRAL_INPUT);
    expect(phase(session)).toBe(Phase.result);
    for (let frame = 0; frame < RESULT_FRAMES; frame++) session.step(NEUTRAL_INPUT);
    session.client.run(() => pickResult(shell(), 0, ResultPick.rematch));
    expect(phase(session)).toBe(Phase.match);
    session.step(NEUTRAL_INPUT);
    expect(read(session)).toEqual(freshFirst);
  } finally {
    session.close();
  }
}, 180_000);
