import { type InputRow, copyInput, emptyInput } from "../input/inputRow";
import { INPUT_LAST_FRAME, type InputPacket, validPacket } from "../input/wire";

interface OutgoingPacket {
  readonly epoch: number;
  firstFrame: number;
  rows: readonly InputRow[];
}

// Preallocated: every callback queues and sends the local rows, and the packet is encoded before the next append.
export class InputBatch {
  private readonly first: InputRow = emptyInput();
  private readonly second: InputRow = emptyInput();
  private readonly single: readonly InputRow[] = [this.first];
  private readonly pair: readonly InputRow[] = [this.first, this.second];
  private readonly outgoing: OutgoingPacket;
  private count = 0;
  private firstFrame = 0;

  constructor(readonly epoch: number) {
    this.outgoing = { epoch, firstFrame: 0, rows: this.single };
  }

  append(epoch: number, frame: number, row: Readonly<InputRow>): boolean {
    if (epoch !== this.epoch || frame < 1 || frame > INPUT_LAST_FRAME || this.count === 2) return false;
    if (this.count === 1 && frame !== this.firstFrame + 1) return false;
    if (this.count === 0) this.firstFrame = frame;
    copyInput(this.count === 0 ? this.first : this.second, row);
    this.count++;
    return true;
  }

  size(): number {
    return this.count;
  }

  packet(): InputPacket | undefined {
    if (this.count === 0 || !validPacket(this.epoch, this.firstFrame, this.count)) return undefined;
    this.outgoing.firstFrame = this.firstFrame;
    this.outgoing.rows = this.count === 1 ? this.single : this.pair;
    return this.outgoing;
  }


  sent(): void {
    this.count = 0;
  }
}
