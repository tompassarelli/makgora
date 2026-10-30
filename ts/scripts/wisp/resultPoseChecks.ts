import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";
import { loserPoseChecks } from "./loserPoseChecks";
import { winnerPoseChecks } from "./winnerPoseChecks";

export const resultPoseChecks = (pass: readonly Rule[]): readonly NativeCheck[] => [...loserPoseChecks(pass), ...winnerPoseChecks(pass)];
