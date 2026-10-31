import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { Phase, fighterColor, humanFighterActive } from "../../game/lobby/lobbyState";
import { type ScreenPoint, cameraPoint } from "../../game/presentation/arenaCamera";
import { overheadAnchorZ, standingTopZ } from "../../game/presentation/escapeMeter";
import { fighterOffscreen } from "../../game/presentation/fighterFraming";
import type { MatchCamera } from "../../game/sim/matchCamera";
import { fighterAt, isActive } from "../../game/sim/roster";
import { partnerOwner } from "../../game/sim/duoOwner";
import { MARKER_CLEARANCE, spreadMarkers } from "../../game/ui/fighterMarker";
import { type NoticePlace, clearNoticePlace } from "../../game/ui/noticeLayout";
import { unitsForPixels } from "../../game/ui/portraitFrames";
import { pauseHudHidden } from "./pauseCamera";
import { presentedMatch } from "./presentedMatch";
import type { ShellState } from "./state";
import { views } from "./ui";

const METER_LIFT = unitsForPixels(40);
const POINT: ScreenPoint = { column: 0.0, row: 0.0 };
const X = [0.0, 0.0, 0.0, 0.0];
const Y = [0.0, 0.0, 0.0, 0.0];
const SHOWN = [false, false, false, false];


export function presentFighterMarkers(s: ShellState, framing: Readonly<MatchCamera>, aspect: number, escaping: readonly boolean[]): void {
  const { world, game } = presentedMatch(s);
  const showing = game.phase === Phase.match && !s.session.paused && !pauseHudHidden(s);
  for (const slot of PARTICIPANT_SLOTS) {
    const fighter = isActive(world, slot) ? fighterAt(world, slot) : undefined;
    SHOWN[slot] = showing && fighter !== undefined && !fighter.status.out && !fighterOffscreen(framing, aspect, fighter.character, fighter.motion.x, fighter.motion.z);
    if (fighter === undefined || SHOWN[slot] !== true) continue;
    const lifted = escaping[slot] === true;
    cameraPoint(framing, aspect, fighter.motion.x, lifted ? overheadAnchorZ(fighter) : standingTopZ(fighter), POINT);
    X[slot] = f32(0.4) + (POINT.column - 0.5) * aspect * f32(0.6);
    Y[slot] = (1.0 - POINT.row) * f32(0.6) + MARKER_CLEARANCE + (lifted ? METER_LIFT : 0.0);
  }
  spreadMarkers(X, Y, SHOWN);
  for (const slot of PARTICIPANT_SLOTS) {
    const fighter = isActive(world, slot) ? fighterAt(world, slot) : undefined;
    const owner = partnerOwner(fighter, slot);
    views(s).markers[slot].update(SHOWN[slot] === true, fighterColor(game, owner), humanFighterActive(game, slot), owner !== slot, fighter?.status.damage ?? 0.0, X[slot] ?? 0.0, Y[slot] ?? 0.0);
  }
}


export function keepNoticeClearOfMarkers(notice: framehandle, visible: boolean, place: NoticePlace): void {
  if (visible && clearNoticePlace(place, X, Y, SHOWN)) BlzFrameSetAbsPoint(notice, FRAMEPOINT_TOPLEFT, place.left, place.top);
}
