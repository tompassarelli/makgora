import { DuoPipState } from "../sim/duoStatus";
import { shownPercent } from "./plateLayout";

export const DUO_TITLE = "Mrgl & Grgl";

const GLYPHS: Readonly<Record<DuoPipState, string>> = {
  [DuoPipState.synced]: "SYNC",
  [DuoPipState.holding]: "HOLD",
  [DuoPipState.separated]: "APART",
  [DuoPipState.down]: "DOWN",
  [DuoPipState.reviveReady]: "REVIVE",
  [DuoPipState.noRoom]: "NO ROOM",
};

const showsPercent = (state: DuoPipState): boolean =>
  state === DuoPipState.synced || state === DuoPipState.holding || state === DuoPipState.separated;

export const duoPipText = (state: DuoPipState, percent: number): string =>
  showsPercent(state) ? `${shownPercent(percent)}% ${GLYPHS[state]}` : GLYPHS[state];

export const duoHasPartner = (state: DuoPipState): boolean => state !== DuoPipState.noRoom;
