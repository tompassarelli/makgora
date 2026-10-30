import { LAST_FRAME, NO_EPOCH, type Receipt, acceptRows, acceptedRow, ledgerCapacity } from "wisp/src/netcode/ledger";
import { captureTarget } from "wisp/src/netcode/fixedSchedule";
import { type ShadowSchedule, maxInputDelay, remoteThrough, shadowSchedule } from "wisp/src/netcode/shadowSchedule";
import type { InputRow } from "../input/inputRow";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { INPUT_ROW_CODEC, type InputPacket, decodePacket } from "../input/wire";
import { REPLAY_HISTORY_CAPACITY, REPLAY_MAX_CORRECTION_FRAMES } from "../replay/limits";

export type InputSchedule = ShadowSchedule<InputRow>;
export type FixedDelay = number;

export const MAX_INPUT_DELAY = maxInputDelay(REPLAY_MAX_CORRECTION_FRAMES);
export const PENDING_CAPACITY = ledgerCapacity(REPLAY_HISTORY_CAPACITY);

export function isFixedDelay(value: number): value is FixedDelay {
  return Math.floor(value) === value && value >= 0 && value <= MAX_INPUT_DELAY;
}

export function inputSchedule(): InputSchedule {
  return shadowSchedule(INPUT_ROW_CODEC, PARTICIPANT_CAPACITY, REPLAY_HISTORY_CAPACITY, REPLAY_MAX_CORRECTION_FRAMES);
}

export function participantMask(schedule: InputSchedule): number {
  return schedule.fixed.ledger.participants;
}

export function acceptedInput(schedule: InputSchedule, slot: number, frame: number): Readonly<InputRow> | undefined {
  return acceptedRow(schedule.fixed.ledger, slot, frame);
}

export function remoteAccepted(schedule: InputSchedule, local: number): number {
  return Math.min(remoteThrough(schedule, local), LAST_FRAME);
}

export function nextCaptureTarget(schedule: InputSchedule): number | undefined {
  return schedule.epoch === NO_EPOCH ? undefined : captureTarget(schedule.nextSpeculative, schedule.delay);
}

const PACKET_MAX_ROWS = 2;
const NO_ROWS = 0;

export function acceptPacket(schedule: InputSchedule, sender: number, packet: InputPacket): Receipt {
  const count = packet.rows.length > PACKET_MAX_ROWS ? NO_ROWS : packet.rows.length;
  const receipt = acceptRows(schedule.fixed.ledger, sender, packet.epoch, packet.firstFrame, packet.rows, count);
  if (receipt === "accepted") schedule.acceptedPackets++;
  return receipt;
}

export function receivePacket(schedule: InputSchedule, sender: number, wire: string): Receipt {
  const packet = decodePacket(wire);
  return packet === undefined ? "malformed" : acceptPacket(schedule, sender, packet);
}
