import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../../input/actions";
import { type RowFields, inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { adaptInput } from "../../match/inputAdapter";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { observeDamageContacts } from "../../sim/contacts";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character, HeroStatusKind } from "../../sim/codes";
import { createFighter } from "../../sim/fighter";
import { applyHeroStatus, damageEndsHeroStatus } from "../../sim/heroStatus";
import { createRoster, fighterAt } from "../../sim/roster";
import { NET_ROOT } from "./specials";

const LEADER = 0;
const FOE = 1;
const PARTNER = 2;
const FOE_AHEAD = 60.0;
const CAST_TICK = 12;
const RENET_TICK = 80;

const NEUTRAL_SPECIAL: RowFields = { held: maskOf(Action.special), pressed: maskOf(Action.special) };

interface Hit { readonly source: number; readonly damage: number }
interface Frame { readonly condition: number; readonly frames: number }

function match(paired: boolean, foeDamage: number): ReplayState {
  const state = createReplaySnapshot();
  const fighters = paired
    ? [createFighter(Character.murloc, 0.0, 1), createFighter(Character.peon, FOE_AHEAD, -1)]
    : [createFighter(Character.murloc, 0.0, 1), createFighter(Character.peon, FOE_AHEAD, -1), createFighter(Character.peon, -400.0, 1), createFighter(Character.peon, 400.0, -1)];
  const world = createRoster(paired ? 3 : 15, fighters);
  fighterAt(world, FOE).status.damage = foeDamage;
  const current = state.match;
  current.phase = Phase.match;
  current.stageChoice = 0;
  current.startHold = 0;
  current.hazards = false;
  current.items.on = false;
  current.timeLimitMinutes = 0;
  current.ultimatesOff = true;
  initializeMatchFighters(current, world);
  return { ...state, world };
}

function play(paired: boolean, foeDamage: number, leaderRow: (tick: number) => RowFields, length: number): { readonly hits: Hit[]; readonly foe: Frame[]; readonly state: ReplayState } {
  const state = match(paired, foeDamage);
  const hits: Hit[] = [];
  const foe: Frame[] = [];
  observeDamageContacts((source, target, damage) => {
    if (target === FOE) hits.push({ source, damage });
  });
  for (let tick = 1; tick <= length; tick++) {
    const leader = inputRow(leaderRow(tick));
    const idle = inputRow({});
    if (leader === undefined || idle === undefined) throw new Error("net row");
    adaptInput(leader, fighterAt(state.world, LEADER), tick, state.controls.inputs[LEADER], state.controls.commands[LEADER]);
    adaptInput(idle, fighterAt(state.world, FOE), tick, state.controls.inputs[FOE], state.controls.commands[FOE]);
    stepMatch(state.match, state.world, state.controls, tick);
    const { status } = fighterAt(state.world, FOE);
    foe.push({ condition: status.condition, frames: status.conditionFrames });
  }
  observeDamageContacts(undefined);
  return { hits, foe, state };
}

const rootEpisodes = (foe: readonly Frame[]): number => foe.filter((frame, index) => frame.condition === HeroStatusKind.root && foe[index - 1]?.condition !== HeroStatusKind.root).length;
const castOnce = (tick: number): RowFields => (tick === CAST_TICK ? NEUTRAL_SPECIAL : {});
const rootedFrames = (foe: readonly Frame[]): number => foe.filter(frame => frame.condition === HeroStatusKind.root).length;

test("A synced pair's net roots a standing foe for 30 frames at 0% [k3 measure docs/design/murloc.md]", () => {
  const { foe } = play(true, 0.0, castOnce, 140);
  assertEquals(rootedFrames(foe), 30);
});

test("The net's hold is capped at 75 frames at 200% [k3 measure docs/design/murloc.md]", () => {
  const { foe } = play(true, 200.0, castOnce, 160);
  assertEquals(rootedFrames(foe), 75);
});

test("Grgl's net on a rooted foe deals damage and adds no frames [k3 measure docs/design/murloc.md]", () => {
  const { hits, foe } = play(true, 0.0, castOnce, 140);
  assertEquals(hits.some(hit => hit.source === PARTNER), true, "Grgl's net lands");
  const rooted = foe.filter(frame => frame.condition === HeroStatusKind.root);
  for (let index = 1; index < rooted.length; index++) assertEquals((rooted[index]?.frames ?? 0) + 1, rooted[index - 1]?.frames ?? 0, "one frame ticks off per frame");
});

test("The net breaks on the third hit taken [k3 measure docs/design/murloc.md]", () => {
  const foe = createFighter(Character.peon, 0.0, 1);
  applyHeroStatus(foe, NET_ROOT);
  assertEquals(foe.status.condition, HeroStatusKind.root);
  damageEndsHeroStatus(foe);
  damageEndsHeroStatus(foe);
  assertEquals(foe.status.condition, HeroStatusKind.root, "two hits leave the net");
  damageEndsHeroStatus(foe);
  assertEquals(foe.status.condition, HeroStatusKind.none, "the third breaks it");
});

test("A foe cannot be netted again for 120 frames after the net ends [k3 measure docs/design/murloc.md]", () => {
  const { hits, foe } = play(true, 0.0, tick => (tick === CAST_TICK || tick === RENET_TICK ? NEUTRAL_SPECIAL : {}), 200);
  assertEquals(hits.filter(hit => hit.source === LEADER).length >= 2, true, "the second net lands");
  assertEquals(rootEpisodes(foe), 1);
});

test("A solo Mrgl's net slows and does not root [k3 measure docs/design/murloc.md]", () => {
  const { hits, foe } = play(false, 0.0, castOnce, 140);
  assertEquals(hits.length > 0, true, "the net lands");
  assertEquals(rootedFrames(foe), 0);
  assertEquals(foe.some(frame => frame.condition === HeroStatusKind.chill), true, "chilled");
});
