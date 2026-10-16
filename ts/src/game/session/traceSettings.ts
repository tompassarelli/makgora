import { RESPONSE_TRACE_CALLBACKS } from "../core/gameFiles";
import { parseDecimal } from "../netcode/journal/decimal";
import type { MapBuild } from "./build";

export function traceSetup(command: string): { readonly command: string; readonly callbacks: number | undefined } {
  const marker = command.lastIndexOf(" |trace ");
  if (marker < 0) return { command, callbacks: undefined };
  const callbacks = parseDecimal(command.substring(marker + 8));
  if (callbacks === undefined || callbacks < 1) return { command, callbacks: undefined };
  return { command: command.substring(0, marker), callbacks };
}

export function traceCallbacks(build: Readonly<MapBuild>, requested: number | undefined): number {
  if (requested !== undefined) return requested;
  if (build.responseProbe) return RESPONSE_TRACE_CALLBACKS;
  if (build.inputProfile === "native-driver") return 1200;
  return build.scenario === "shield-break" || build.scenario === "ledge" ? 600 : 300;
}
