export interface OverControls {
  over(x: number, y: number): boolean;
}

// Every list is asked whatever the pointer, so two clients with different mice make the same native calls.
export function overAny(x: number, y: number, lists: readonly OverControls[]): boolean {
  let over = false;
  for (const list of lists) {
    if (list.over(x, y)) over = true;
  }
  return over;
}

export const anyOpen = (...flags: readonly boolean[]): boolean => flags.includes(true);
