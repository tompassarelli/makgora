import { f32 } from "wisp/src/sim/f32";
import { max } from "../core/numbers";
import { SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { steeredFlightLeft } from "../sim/specials/engine";
import { heroLook } from "../roster/looks";
import { characterModelScale } from "./modelScale";
import type { FlightLook } from "./model/look";

const LAST_EMBER = f32(0.15);

export interface FlightPose {
  visible: boolean;
  z: number;
  scale: number;
}

export const emptyFlightPose = (): FlightPose => ({ visible: false, z: 0.0, scale: 0.0 });

export function fighterFlight(character: number): FlightLook | undefined {
  return heroLook(character)?.flight;
}


export const eggShown = (fighter: Readonly<Fighter>): boolean =>
  fighter.special.egg && !fighter.status.out && fighterFlight(fighter.character) !== undefined;


export function flightFlamesLeft(fighter: Readonly<Fighter>): number {
  if (fighter.status.out || fighter.special.egg || fighter.special.action === SpecialAction.none) return 0.0;
  return steeredFlightLeft(fighter);
}


export const flightFormShown = (fighter: Readonly<Fighter>): boolean =>
  eggShown(fighter) || (fighterFlight(fighter.character) !== undefined && flightFlamesLeft(fighter) > 0.0);


export function flightFlamesPose(fighter: Readonly<Fighter>, flight: Readonly<FlightLook>, out: FlightPose): FlightPose {
  const left = flightFlamesLeft(fighter);
  out.visible = left > 0.0;
  const scale = characterModelScale(fighter.character);
  out.z = f32(flight.flamesZ * scale);
  out.scale = f32(f32(flight.flamesScale * max(LAST_EMBER, left)) * scale);
  return out;
}


export function eggPose(fighter: Readonly<Fighter>, flight: Readonly<FlightLook>, out: FlightPose): FlightPose {
  out.visible = eggShown(fighter);
  out.z = 0.0;
  out.scale = f32(flight.eggScale * characterModelScale(fighter.character));
  return out;
}
