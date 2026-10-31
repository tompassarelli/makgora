import { expect, test } from "bun:test";
import { Phase } from "../src/game/lobby/lobbyState";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { MARKER_HEIGHT, MARKER_WIDTH } from "../src/game/ui/fighterMarker";
import { MATCH_CLOCK_BOX, MATCH_COUNTDOWN_BOX, MATCH_NOTICE_BOX, type TextBox } from "../src/game/ui/hudLayout";
import { clearNoticePlace } from "../src/game/ui/noticeLayout";
import { install, startBuild } from "../src/platform/main";
import { shellState } from "../src/host/loop/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const SPAWN_FRAMES = 40;

type Rectangle = readonly [number, number, number, number];

const disjoint = ([left, top, right, bottom]: Rectangle, [otherLeft, otherTop, otherRight, otherBottom]: Rectangle): boolean =>
  right <= otherLeft || otherRight <= left || bottom >= otherTop || otherBottom >= top;

const boxRectangle = (box: TextBox): Rectangle => [box.left, box.top, box.left + box.width, box.top - box.height];
const markerRectangle = (x: number, y: number): Rectangle => [x - MARKER_WIDTH / 2, y + MARKER_HEIGHT, x + MARKER_WIDTH / 2, y];
const inside = ([left, top, right, bottom]: Rectangle, [outerLeft, outerTop, outerRight, outerBottom]: Rectangle): boolean =>
  left >= outerLeft - 1e-6 && right <= outerRight + 1e-6 && top <= outerTop + 1e-6 && bottom >= outerBottom - 1e-6;

test("the pre-match line moves clear of every fighter marker, the clock and the countdown wherever the fighters stand, as on Durotar Skies and Tomb of Sargeras [k1 scenario]", () => {
  const rows = [0.3, 0.38, 0.44, 0.5];
  const leftColumns = [0.1, 0.14];
  const rightColumns = [0.65, 0.7];
  const obstacles = [boxRectangle(MATCH_CLOCK_BOX), boxRectangle(MATCH_COUNTDOWN_BOX)];
  for (const firstY of rows) for (const secondY of rows) for (const firstX of leftColumns) for (const secondX of rightColumns) {
    const place = { left: MATCH_NOTICE_BOX.left, top: MATCH_NOTICE_BOX.top };
    clearNoticePlace(place, [firstX, secondX, 0.0, 0.0], [firstY, secondY, 0.0, 0.0], [true, true, false, false]);
    const notice = boxRectangle({ ...MATCH_NOTICE_BOX, ...place });
    for (const other of [markerRectangle(firstX, firstY), markerRectangle(secondX, secondY), ...obstacles]) expect(disjoint(notice, other)).toBe(true);
  }
  for (const alone of [0.1, 0.2, 0.6, 0.7]) for (const row of rows) {
    const place = { left: MATCH_NOTICE_BOX.left, top: MATCH_NOTICE_BOX.top };
    clearNoticePlace(place, [alone, 0.0, 0.0, 0.0], [row, 0.0, 0.0, 0.0], [true, false, false, false]);
    for (const other of [markerRectangle(alone, row), ...obstacles]) expect(disjoint(boxRectangle({ ...MATCH_NOTICE_BOX, ...place }), other)).toBe(true);
  }
  const settled = { left: MATCH_NOTICE_BOX.left, top: MATCH_NOTICE_BOX.top };
  clearNoticePlace(settled, [0.65, 0.14, 0.0, 0.0], [0.44, 0.44, 0.0, 0.0], [true, true, false, false]);
  const kept = { ...settled };
  expect(clearNoticePlace(settled, [0.65, 0.14, 0.0, 0.0], [0.44, 0.44, 0.0, 0.0], [true, true, false, false])).toBe(false);
  expect(settled).toEqual(kept);
});

test("the start-hold line on screen shares no rectangle with a fighter's damage, percent or name tag [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild({ ...PLAYABLE_BUILD, id: "typescript-notice-clear", devConsole: true }) }, [0]);
  const client = clients.client(0);
  clients.start();
  clients.frames(120);
  clients.chat(0, "-dev quick cpu wren expert hero illidan");
  let phase = -1;
  for (let frame = 0; frame < 600 && phase !== Phase.match; frame++) {
    clients.frames(1);
    client.run(() => { phase = shellState()?.game.phase ?? -1; });
  }
  expect(phase).toBe(Phase.match);
  client.run(() => {
    const s = shellState();
    if (s === undefined) return;
    s.game.startHold = 600;
    s.game.matchFrame = 0;
  });
  let sawNotice = false;
  for (let frame = 0; frame < SPAWN_FRAMES; frame++) {
    clients.frames(1);
    const seen = client.frames.snapshot({ visibleOnly: true });
    const notice = seen.find(item => item.name === "MeleeNotice");
    if (notice?.rectangle === undefined) continue;
    sawNotice = true;
    expect(notice.text).toContain("CPU 2");
    const others = seen.filter(item => item !== notice && (item.text ?? "") !== "" && item.rectangle !== undefined && !/Outline/.test(item.name ?? ""));
    expect(others.length).toBeGreaterThan(8);
    for (const other of others) expect(disjoint(notice.rectangle, other.rectangle as Rectangle)).toBe(true);
    const clock = others.filter(item => /^\|cffffffff\d\d(:\d\d)?\|r$/.test(item.text ?? "") && (item.rectangle?.[1] ?? 0) > 0.5);
    expect(clock.length).toBe(2);
    for (const part of clock) expect(inside(part.rectangle as Rectangle, boxRectangle(MATCH_CLOCK_BOX))).toBe(true);
    const countdown = others.find(item => item.name === "MatchCountdown");
    if (countdown !== undefined) expect(inside(countdown.rectangle as Rectangle, boxRectangle(MATCH_COUNTDOWN_BOX))).toBe(true);
  }
  expect(sawNotice).toBe(true);
  expect(client.errors).toEqual([]);
});
