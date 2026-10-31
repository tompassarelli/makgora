
import { runFrameCostBenchmark } from "../../game/replay/frameCostBenchmark";
import { frameCostFile } from "../../game/core/gameFiles";
import { createTimer, startTimer } from "wisp/game/clock";
import { debugMessage } from "wisp/game/frames";
import { localPlayer, playerSlot } from "wisp/game/players";
import { addFileLine, clearFileLines, endFile, startFile } from "wisp/game/files";
import { formatInt, formatRealWidth } from "wisp/game/text";

declare const os: { readonly clock: (this: void) => number };

export function start(source: string): void {
  startTimer(createTimer(), 2.0, false, () => {
    const result = runFrameCostBenchmark(() => os.clock());
    if (result === undefined) throw new Error("frame-cost TypeScript workload failed");
    clearFileLines();
    startFile();
    addFileLine(`SOURCE ${source}`);
    addFileLine(`frames=${formatInt(result.frames)}`);
    addFileLine(`total_seconds=${formatRealWidth(result.totalSeconds, 16, 9)}`);
    addFileLine(`mean_seconds=${formatRealWidth(result.meanSecondsPerFrame, 16, 9)}`);
    addFileLine(`initial_checksum=${result.initialChecksum}`);
    addFileLine(`final_checksum=${result.finalChecksum}`);
    for (let offset = 0; offset < result.finalState.length; offset += 200) {
      addFileLine(`state=${result.finalState.slice(offset, offset + 200)}`);
    }
    endFile(frameCostFile(source, playerSlot(localPlayer()), "typescript"));
    debugMessage(`Benchmark: ${formatInt(result.frames)} frames, ${formatRealWidth(result.totalSeconds, 12, 6)} seconds`);
  });
}
