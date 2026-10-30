// The recorded behaviour of the input ledger and the rollback schedule under seeded packet sequences. Bun and 32-bit Lua print the same text; test/netcode-golden.test.ts holds the record.
import { at } from "wisp/src/runtime/lookup";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { type InputRow, emptyInput, inputRow, sameInput } from "../input/inputRow";
import { PARTICIPANT_CAPACITY, participantActive, participantInputs } from "../input/participants";
import { type InputPacket, encodePacket } from "../input/wire";
import { REPLAY_MAX_CORRECTION_FRAMES } from "../replay/limits";
import { FUTURE_LIMIT } from "wisp/src/netcode/ledger";
import { awaitedSlots, beginShadowEpoch, captureLocal, captureLocalAt, completeConfirmed, completeSpeculative, knownFrame, lateFrom, readConfirmed, rememberResolvedInput, resolveSpeculative, rewindSpeculative, windowHalted } from "wisp/src/netcode/shadowSchedule";
import { type InputSchedule, acceptPacket, acceptedInput, inputSchedule, nextCaptureTarget, participantMask, receivePacket, remoteAccepted } from "./inputSchedule";

interface Plan {
  readonly name: string;
  readonly seed: number;
  readonly delay: number;
  readonly window: number;
  readonly mask: number;
  readonly local: number;
  readonly callbacks: number;
  /** Callbacks a slot's packet spends in flight, before jitter; the local slot's is its own echo. */
  readonly lag: readonly number[];
  readonly jitter: number;
  readonly faults: boolean;
  readonly switchAt?: { readonly callback: number; readonly delay: number; readonly mask: number };
}

interface Flight {
  readonly arrival: number;
  readonly order: number;
  readonly sender: number;
  readonly packet: InputPacket;
  readonly wire: boolean;
}

const LOG_EVERY = 25;
const CATCH_UP = 6;

const PLANS: readonly Plan[] = [
  { name: "in-order", seed: 11, delay: 2, window: 7, mask: 0b0011, local: 0, callbacks: 300, lag: [2, 2], jitter: 0, faults: false },
  { name: "late-and-reordered", seed: 23, delay: 3, window: 7, mask: 0b0111, local: 1, callbacks: 400, lag: [9, 3, 14], jitter: 12, faults: false },
  {
    name: "faults-and-leave", seed: 37, delay: 2, window: 7, mask: 0b1111, local: 2, callbacks: 360, lag: [4, 6, 3, 5], jitter: 5, faults: true,
    switchAt: { callback: 250, delay: 4, mask: 0b1110 },
  },
  { name: "window-held", seed: 41, delay: 2, window: 7, mask: 0b0011, local: 0, callbacks: 260, lag: [2, 60], jitter: 3, faults: false },
  { name: "late-echo-stall-233", seed: 53, delay: 4, window: 7, mask: 0b0001, local: 0, callbacks: 420, lag: [300], jitter: 0, faults: false },
];

function lcg(seed: number): (this: void) => number {
  let state = seed;
  return () => {
    state = floorMod(state * 75 + 74, 65537);
    return state;
  };
}

function rowOf(seed: number, slot: number, frame: number, delay: number): InputRow {
  if (frame <= delay) return emptyInput();
  const run = 2 + floorMod(seed + slot * 3, 7);
  const step = floorDiv(frame, run);
  return inputRow({ held: floorMod(step * 37 + slot * 11 + seed, 61), axisX: (floorMod(step * 13 + slot, 5) - 2) * 30 }) ?? emptyInput();
}

function differentRow(row: Readonly<InputRow>): InputRow {
  return inputRow({ held: floorMod(row.held + 1, 64), axisX: row.axisX }) ?? emptyInput();
}

function packetOf(seed: number, slot: number, epoch: number, first: number, delay: number): InputPacket {
  return { epoch, firstFrame: first, rows: [rowOf(seed, slot, first, delay), rowOf(seed, slot, first + 1, delay)] };
}

function counts(table: Map<string, number>): string {
  return [...table.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, count]) => `${key}=${count}`).join(" ");
}

function bump(table: Map<string, number>, key: string): void {
  table.set(key, (table.get(key) ?? 0) + 1);
}

class Run {
  private readonly schedule = inputSchedule();
  private readonly next: (this: void) => number;
  private readonly receipts = new Map<string, number>();
  private readonly captures = new Map<string, number>();
  private readonly flights: Flight[] = [];
  private readonly ran = new Map<number, InputRow[]>();
  private readonly inputs = participantInputs();
  private epoch = 1;
  private delay: number;
  private epochStart = 1;
  private sent = 0;
  private callback = 0;
  private rollbacks = 0;
  private deepest = 0;
  private firstLate = -1;
  private held = 0;
  private futureHeld = 0;
  private firstHold = -1;
  private confirmedSum = 0;
  private confirmedFrames = 0;

  constructor(private readonly plan: Plan, private readonly out: string[]) {
    this.next = lcg(plan.seed);
    this.delay = plan.delay;
    out.push(`scenario ${plan.name} seed=${plan.seed} delay=${plan.delay} window=${plan.window} mask=${plan.mask} local=${plan.local}`);
    if (!beginShadowEpoch(this.schedule, this.epoch, this.delay, plan.window, plan.mask)) throw new Error(`${plan.name}: epoch 1 refused`);
  }

  play(): void {
    for (this.callback = 1; this.callback <= this.plan.callbacks; this.callback++) {
      this.changeEpoch();
      this.send();
      this.deliver();
      if (this.plan.faults && floorMod(this.callback, 40) === 0) this.inject();
      this.correct();
      this.speculate();
      this.confirm();
      if (floorMod(this.callback, LOG_EVERY) === 0) this.log();
    }
    this.summarize();
  }

  private offer(sender: number, packet: InputPacket, wire: boolean): void {
    const receipt = wire ? receivePacket(this.schedule, sender, encodePacket(packet)) : acceptPacket(this.schedule, sender, packet);
    bump(this.receipts, receipt);
    if (receipt !== "accepted") this.out.push(`c${this.callback} s${sender} e${packet.epoch} f${packet.firstFrame} ${receipt}`);
  }

  private capture(label: string, result: number): void {
    bump(this.captures, `${label}:${result}`);
    if (label !== "local" || (result !== 0 && result !== 1)) this.out.push(`c${this.callback} capture ${label} ${result}`);
  }

  private changeEpoch(): void {
    const change = this.plan.switchAt;
    if (change === undefined || this.callback !== change.callback) return;
    this.epoch++;
    this.delay = change.delay;
    const begun = beginShadowEpoch(this.schedule, this.epoch, this.delay, this.plan.window, change.mask);
    this.out.push(`c${this.callback} epoch ${this.epoch} delay=${this.delay} mask=${change.mask} begun=${begun}`);
    this.epochStart = this.callback;
    this.ran.clear();
  }

  private send(): void {
    const { plan, epoch, delay } = this;
    const mask = participantMask(this.schedule);
    for (let sender = 0; sender < PARTICIPANT_CAPACITY; sender++) {
      if (!participantActive(mask, sender)) continue;
      const first = Math.max(1, this.callback - this.epochStart + delay);
      const arrival = this.callback + at(plan.lag, sender) + (plan.jitter === 0 ? 0 : floorMod(this.next(), plan.jitter + 1));
      const packet = packetOf(plan.seed, sender, epoch, first, delay);
      this.flights.push({ order: this.sent++, arrival, sender, packet, wire: true });
      if (plan.faults || plan.jitter > 0) {
        if (floorMod(this.next(), 7) === 0) this.flights.push({ order: this.sent++, arrival: arrival + 3, sender, packet, wire: true });
        if (plan.faults && floorMod(this.next(), 23) === 0) {
          const changed = { epoch, firstFrame: first, rows: [packet.rows[0] ?? emptyInput(), differentRow(packet.rows[1] ?? emptyInput())] };
          this.flights.push({ order: this.sent++, arrival: arrival + 1, sender, packet: changed, wire: true });
        }
      }
    }
  }

  private deliver(): void {
    this.flights.sort((a, b) => a.arrival !== b.arrival ? a.arrival - b.arrival : a.order - b.order);
    while (this.flights.length > 0 && (this.flights[0]?.arrival ?? Number.MAX_SAFE_INTEGER) <= this.callback) {
      const flight = this.flights.shift();
      if (flight !== undefined) this.offer(flight.sender, flight.packet, flight.wire);
    }
  }

  private inject(): void {
    const { plan, epoch, delay, schedule } = this;
    const known = knownFrame(schedule);
    const sender = floorMod(plan.local + 1, PARTICIPANT_CAPACITY);
    const sample = rowOf(plan.seed, sender, known + 1, delay);
    const from = (first: number, packetEpoch: number = epoch) => packetOf(plan.seed, sender, packetEpoch, first, delay);
    this.offer(sender, from(known + FUTURE_LIMIT - 1), false);
    this.offer(sender, from(known + FUTURE_LIMIT), false);
    this.offer(sender, from(known + FUTURE_LIMIT + 1), false);
    this.offer(sender, from(1), false);
    this.offer(sender, from(known + 1, epoch - 1), false);
    this.offer(7, from(known + 1), false);
    this.offer(sender, { epoch, firstFrame: known + 1, rows: [sample, sample, sample] }, false);
    bump(this.receipts, receivePacket(schedule, sender, "!!"));
    const target = nextCaptureTarget(schedule) ?? 0;
    const assigned = rowOf(plan.seed, plan.local, target, delay);
    this.capture("at-assigned", captureLocalAt(schedule, epoch, target, assigned));
    this.capture("at-conflict", captureLocalAt(schedule, epoch, target, differentRow(assigned)));
    this.capture("at-history", captureLocalAt(schedule, epoch, 1, sample));
    this.capture("at-ahead", captureLocalAt(schedule, epoch, schedule.nextConfirmed + FUTURE_LIMIT, sample));
    this.capture("at-epoch", captureLocalAt(schedule, epoch + 5, target, sample));
  }

  private mispredicted(frame: number): boolean {
    const used = this.ran.get(frame);
    if (used === undefined) return false;
    for (let sender = 0; sender < PARTICIPANT_CAPACITY; sender++) {
      const accepted = acceptedInput(this.schedule, sender, frame);
      const predicted = used[sender];
      if (sender !== this.plan.local && accepted !== undefined && predicted !== undefined && !sameInput(accepted, predicted)) return true;
    }
    return false;
  }

  private correct(): void {
    const { schedule, epoch } = this;
    let lowest = Number.MAX_SAFE_INTEGER;
    for (let sender = 0; sender < PARTICIPANT_CAPACITY; sender++) {
      const taken = lateFrom(schedule, sender);
      if (sender !== this.plan.local && taken < lowest) lowest = taken;
    }
    for (let frame = lowest; frame < schedule.nextSpeculative; frame++) {
      if (!this.mispredicted(frame)) continue;
      const depth = schedule.nextSpeculative - frame;
      if (!rewindSpeculative(schedule, epoch, frame)) return;
      this.rollbacks++;
      if (depth > this.deepest) this.deepest = depth;
      if (this.firstLate < 0) this.firstLate = frame;
      this.out.push(`c${this.callback} rollback from=${frame} depth=${depth}`);
      for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) rememberResolvedInput(schedule, slot, acceptedInput(schedule, slot, frame - 1) ?? emptyInput());
      return;
    }
  }

  private speculate(): void {
    const { plan, epoch, delay, schedule } = this;
    for (let ranFrames = 0; ranFrames < CATCH_UP; ranFrames++) {
      const target = nextCaptureTarget(schedule);
      if (target !== undefined) this.capture("local", captureLocal(schedule, epoch, rowOf(plan.seed, plan.local, target, delay)));
      const frame = schedule.nextSpeculative;
      if (resolveSpeculative(schedule, epoch, plan.local, this.inputs) === undefined) {
        if (windowHalted(schedule, plan.local)) this.hold(frame);
        return;
      }
      this.ran.set(frame, this.inputs.map((row) => ({ ...row })));
      completeSpeculative(schedule, epoch, frame);
    }
  }

  private hold(frame: number): void {
    this.held++;
    if (this.firstHold < 0) this.firstHold = this.callback;
    if (frame + 1 + this.delay - (this.schedule.nextConfirmed - 1) > FUTURE_LIMIT) this.futureHeld++;
  }

  private confirm(): void {
    const { schedule, epoch } = this;
    while (readConfirmed(schedule, epoch, this.inputs)) {
      const frame = schedule.nextConfirmed;
      for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
        const row = at(this.inputs, slot);
        this.confirmedSum = floorMod(this.confirmedSum * 31 + row.held * 3 + row.axisX + 200 + slot, 1000003);
      }
      completeConfirmed(schedule, epoch, frame);
      this.confirmedFrames++;
    }
  }

  private log(): void {
    const { schedule } = this;
    this.out.push(`c${this.callback} K=${knownFrame(schedule)} spec=${schedule.nextSpeculative} conf=${schedule.nextConfirmed} confirmed=${this.confirmedFrames} sum=${this.confirmedSum} awaited=${awaitedSlots(schedule)} remote=${remoteAccepted(schedule, this.plan.local)} packets=${schedule.acceptedPackets}`);
  }

  private summarize(): void {
    this.out.push(`receipts ${counts(this.receipts)}`);
    this.out.push(`captures ${counts(this.captures)}`);
    this.out.push(`rollbacks=${this.rollbacks} deepest=${this.deepest} firstLate=${this.firstLate} held=${this.held} futureHeld=${this.futureHeld} firstHold=${this.firstHold} limit=${REPLAY_MAX_CORRECTION_FRAMES}`);
  }
}

export function netcodeGoldenRecord(): string[] {
  const out: string[] = [];
  for (const plan of PLANS) new Run(plan, out).play();
  return out;
}
