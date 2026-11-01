import { f32 } from "wisp/src/sim/f32";
import { GHOST_DASH, GHOST_DASH_SPEED, GHOST_GLIDE, GHOST_LEAP, GHOST_SHIFT } from "../fighters/thrall/ghostWolf";
import { GHOST_WOLF_MODEL } from "../fighters/thrall/wolves";
import { STOCK_WOLF_STRIDE } from "./projectileArt";
import type { Cue, CueState, MoveCues } from "./specialCues";

const WOLF_SCALE = f32(0.85);
const POUNCE_FRAMES = GHOST_GLIDE.last - GHOST_LEAP.first + 1;
const POUNCE_SECONDS = f32(0.867);

const puff = (model: string): Cue => ({ model, anchor: "body", scale: f32(0.9), sequence: "birth", seconds: 0.0, pitch: 0.0 });
const wolf = (sequence: string, timeScale: number): Cue => ({ model: GHOST_WOLF_MODEL, anchor: "feet", scale: WOLF_SCALE, sequence, seconds: 0.0, pitch: 0.0, timeScale, replacesBody: true });

const SHIFT = puff("Abilities\\Spells\\Orc\\FeralSpirit\\feralspirittarget.mdx");
const RETURN = puff("Abilities\\Spells\\Orc\\FeralSpirit\\FeralSpiritDone.mdx");
const RUN = wolf("walk", f32(f32(GHOST_DASH_SPEED * 60.0) / f32(STOCK_WOLF_STRIDE * WOLF_SCALE)));
const POUNCE = wolf("attack slam", f32(POUNCE_SECONDS / f32(POUNCE_FRAMES / 60.0)));

const SHIFTING: CueState = { cues: { spell: "Ghost Wolf", startup: SHIFT, active: RUN }, phase: "startup" };
const RUNNING: CueState = { cues: { spell: "Ghost Wolf", startup: SHIFT, active: RUN }, phase: "active" };
const POUNCING: CueState = { cues: { spell: "Ghost Wolf pounce", startup: SHIFT, active: POUNCE } satisfies MoveCues, phase: "active" };
const RETURNING: CueState = { cues: { spell: "Ghost Wolf return", startup: RETURN, active: RETURN }, phase: "startup" };

export const GHOST_WOLF_CUES: readonly MoveCues[] = [SHIFTING, RUNNING, POUNCING, RETURNING].flatMap((state) => (state.cues === undefined ? [] : [state.cues]));

export function ghostWolfCueState(frame: number): CueState {
  if (frame <= GHOST_SHIFT.last) return SHIFTING;
  if (frame <= GHOST_DASH.last) return RUNNING;
  if (frame <= GHOST_GLIDE.last) return POUNCING;
  return RETURNING;
}
