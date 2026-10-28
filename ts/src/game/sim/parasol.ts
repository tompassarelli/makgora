import { ParasolState } from "./codes";

export const PARASOL_FALL = 0.30000001192092896;

interface ParasolBody {
  readonly special: { parasol: ParasolState; fall: boolean };
  readonly motion: { readonly grounded: boolean; fastFalling: boolean };
  readonly jump: { remaining: number };
  readonly launch: { readonly hitstun: number };
  readonly attack: { readonly style: unknown };
}

export function openParasol(f: ParasolBody, opens: boolean): boolean {
  if (!opens || f.motion.grounded) return false;
  f.special.parasol = ParasolState.open;
  f.jump.remaining = 0;
  return true;
}

export function parasolFall(f: Readonly<ParasolBody>): number {
  return f.special.parasol === ParasolState.open && f.launch.hitstun <= 0 && f.attack.style === undefined ? PARASOL_FALL : 1.0;
}

export function reopenParasol(f: ParasolBody, upHeld: boolean): void {
  if (!upHeld || f.motion.grounded || f.special.parasol !== ParasolState.closed) return;
  f.special.parasol = ParasolState.open;
  f.motion.fastFalling = false;
}

export function closeParasol(f: ParasolBody, downHeld: boolean): void {
  if (downHeld && f.special.parasol === ParasolState.open) f.special.parasol = ParasolState.closed;
}

export function parasolBlocksActions(f: Readonly<ParasolBody>): boolean {
  return f.special.parasol !== ParasolState.none;
}

export function spendParasol(f: ParasolBody): void {
  if (f.special.parasol === ParasolState.open || f.special.parasol === ParasolState.closed) f.special.parasol = ParasolState.spent;
}

export function endParasolAerial(f: ParasolBody): void {
  if (f.special.parasol !== ParasolState.spent) return;
  f.special.parasol = ParasolState.none;
  if (!f.motion.grounded) f.special.fall = true;
}
