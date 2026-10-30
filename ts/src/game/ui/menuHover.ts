export interface OverControls {
  over(x: number, y: number): boolean;
}

// Every list is asked whatever the pointer, so two clients with different mice make the same native calls.
export function overAny(x: number, y: number, lists: readonly OverControls[]): boolean {
  return lists.map(list => list.over(x, y)).some(Boolean);
}

export const anyOpen = (...flags: readonly boolean[]): boolean => flags.some(Boolean);
