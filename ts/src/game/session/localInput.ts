import { InputBatch } from "../netcode/inputBatch";
import { pendingRow } from "wisp/src/netcode/shadowSchedule";
import { type InputSchedule } from "../netcode/inputSchedule";


export function queueLocalRows(batch: InputBatch, schedule: InputSchedule, epoch: number, firstFrame: number): number | false {
  const before = batch.size();
  while (batch.size() < 2) {
    const frame = firstFrame + batch.size();
    const row = pendingRow(schedule, epoch, frame);
    if (row === undefined) break;
    if (!batch.append(epoch, frame, row)) return false;
  }
  return batch.size() - before;
}
