export const TIERS_TUNED_DELAY = 2;

interface LeadHolder {
  computerLead?: number;
}

export const computerLead = (game: Readonly<LeadHolder>): number => game.computerLead ?? 0;

export function setComputerLead(game: LeadHolder, inputDelay: number): void {
  const lead = Math.max(0, TIERS_TUNED_DELAY - inputDelay);
  if (lead === 0) delete game.computerLead;
  else game.computerLead = lead;
}

export function copyComputerLead(target: LeadHolder, source: Readonly<LeadHolder>): void {
  if (source.computerLead === undefined) delete target.computerLead;
  else target.computerLead = source.computerLead;
}

export function writeComputerLead(game: Readonly<LeadHolder>, int: (name: string, value: number) => void): void {
  if (game.computerLead !== undefined) int("match.computerLead", game.computerLead);
}

interface RunLeadHolder {
  readonly active: boolean;
  readonly current: { readonly reactionLead: number } | undefined;
}

export const reactionLead = (run: Readonly<RunLeadHolder>): number => run.active ? run.current?.reactionLead ?? 0 : 0;
