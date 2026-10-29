import { parseDecimal } from "../netcode/journal/decimal";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots, isParticipantSlot } from "../input/participants";
import type { Character } from "../sim/codes";
import { MATCH_CHARACTERS, fighterKey } from "../roster/kits";

export const SHOWCASE_COMMAND = "-dev showcase ";
export const SHOWCASE_PAD_X: Readonly<Slots<number>> = [-450.0, -150.0, 150.0, 450.0];
export const SHOWCASE_PAD_LETTERS: Readonly<Slots<string>> = ["a", "b", "c", "d"];

export type ShowcaseRequest =
  | { readonly kind: "start"; readonly fighters: readonly Character[] }
  | { readonly kind: "spawn"; readonly slot: ParticipantSlot; readonly character: Character }
  | { readonly kind: "clear"; readonly slot: ParticipantSlot }
  | { readonly kind: "camera"; readonly slot: ParticipantSlot | "all" }
  | { readonly kind: "demo"; readonly character: Character }
  | { readonly kind: "invalid" };

export interface ShowcasePads {
  readonly fighters: Slots<Character | undefined>;
  readonly serials: Slots<number>;
  serial: number;
}

export const createShowcasePads = (): ShowcasePads => ({ fighters: [undefined, undefined, undefined, undefined], serials: [0, 0, 0, 0], serial: 0 });

export function copyShowcasePads(target: ShowcasePads, source: Readonly<ShowcasePads>): void {
  for (const slot of PARTICIPANT_SLOTS) {
    target.fighters[slot] = source.fighters[slot];
    target.serials[slot] = source.serials[slot];
  }
  target.serial = source.serial;
}

export const showcaseMask = (pads: Readonly<ShowcasePads>): number =>
  PARTICIPANT_SLOTS.reduce<number>((mask, slot) => pads.fighters[slot] === undefined ? mask : mask | 1 << slot, 0);

function characterNamed(name: string): Character | undefined {
  const wanted = name.trim().toLowerCase();
  for (const character of MATCH_CHARACTERS) if (fighterKey(character).toLowerCase() === wanted) return character;
  return undefined;
}

function padSlot(text: string): ParticipantSlot | undefined {
  const letter = SHOWCASE_PAD_LETTERS.indexOf(text);
  const number = parseDecimal(text);
  const slot = letter >= 0 ? letter : number !== undefined && `${number}` === text ? number - 1 : -1;
  return isParticipantSlot(slot) ? slot : undefined;
}

function cameraRequest(args: string): ShowcaseRequest {
  const focus = args === "all" ? "all" : padSlot(args);
  return focus === undefined ? { kind: "invalid" } : { kind: "camera", slot: focus };
}

function startRequest(args: string): ShowcaseRequest {
  const names = args.split(",");
  const fighters = names.map(name => characterNamed(name)).filter(character => character !== undefined);
  return fighters.length === names.length && fighters.length <= PARTICIPANT_SLOTS.length ? { kind: "start", fighters } : { kind: "invalid" };
}

function demoRequest(args: string): ShowcaseRequest {
  const character = characterNamed(args);
  return character === undefined ? { kind: "invalid" } : { kind: "demo", character };
}

export function showcaseRequest(message: string): ShowcaseRequest | undefined {
  if (!message.startsWith(SHOWCASE_COMMAND)) return undefined;
  const rest = message.substring(SHOWCASE_COMMAND.length);
  const space = rest.indexOf(" ");
  const verb = space < 0 ? rest : rest.substring(0, space);
  const args = space < 0 ? "" : rest.substring(space + 1);
  if (verb === "start") return startRequest(args);
  if (verb === "camera") return cameraRequest(args);
  if (verb === "demo") return demoRequest(args);
  const gap = args.indexOf(" ");
  const slot = padSlot(gap < 0 ? args : args.substring(0, gap));
  if (slot === undefined) return { kind: "invalid" };
  if (verb === "clear" && gap < 0) return { kind: "clear", slot };
  const character = verb === "spawn" && gap >= 0 ? characterNamed(args.substring(gap + 1)) : undefined;
  return character === undefined ? { kind: "invalid" } : { kind: "spawn", slot, character };
}

export const padName = (character: Character): string => fighterKey(character).toLowerCase();

export function showcasePadsReceipt(pads: Readonly<ShowcasePads>): string {
  const filled: string[] = [];
  for (const slot of PARTICIPANT_SLOTS) {
    const character = pads.fighters[slot];
    if (character !== undefined) filled.push(`${slot + 1}=${padName(character)}`);
  }
  return `dev: showcase pads ${filled.join(" ")}`;
}

export function applyShowcaseRequest(pads: ShowcasePads, request: ShowcaseRequest): string | undefined {
  if (request.kind === "invalid" || request.kind === "camera" || request.kind === "demo") return undefined;
  if (request.kind === "clear") {
    if (pads.fighters[request.slot] === undefined || showcaseMask(pads) === 1 << request.slot) return undefined;
    pads.fighters[request.slot] = undefined;
    pads.serials[request.slot] = 0;
    return showcasePadsReceipt(pads);
  }
  if (request.kind === "spawn") {
    pads.fighters[request.slot] = request.character;
    pads.serials[request.slot] = ++pads.serial;
    return `dev: showcase pad ${request.slot + 1} serial ${pads.serial} ${padName(request.character)}`;
  }
  for (const slot of PARTICIPANT_SLOTS) {
    const character = request.fighters[slot];
    pads.fighters[slot] = character;
    pads.serials[slot] = character === undefined ? 0 : ++pads.serial;
  }
  return showcasePadsReceipt(pads);
}
