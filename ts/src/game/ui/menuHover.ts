export interface OverControls {
  over(x: number, y: number): boolean;
}

// Every list is asked whatever the pointer, so two clients with different mice make the same native calls.
export function overAny(x: number, y: number, first: OverControls, second: OverControls, third: OverControls, fourth: OverControls, fifth: OverControls): boolean {
  const a = first.over(x, y), b = second.over(x, y), c = third.over(x, y), d = fourth.over(x, y), e = fifth.over(x, y);
  return a || b || c || d || e;
}

export const anyOpen = (first: boolean, second: boolean, third: boolean): boolean => first || second || third;
