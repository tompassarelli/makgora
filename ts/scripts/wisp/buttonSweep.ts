export const SWEEP_FRACTIONS = [0.1, 0.3, 0.5, 0.7, 0.9] as const;

export interface SweepBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SweptButton {
  readonly label: string;
  readonly visible: boolean;
  readonly box: SweepBox | undefined;
}

const LINE = /^BUTTON (\S+) visible=([01]) (?:box=none|x=(-?[\d.]+) y=(-?[\d.]+) width=([\d.]+) height=([\d.]+))$/;

export function parseButtonList(lines: readonly string[]): SweptButton[] {
  return lines.flatMap((line): SweptButton[] => {
    const match = LINE.exec(line);
    if (match === null) return [];
    const [, label = "", visible, x, y, width, height] = match;
    const box = x === undefined ? undefined : { x: Number(x), y: Number(y), width: Number(width), height: Number(height) };
    return [{ label, visible: visible === "1", box }];
  });
}

export function parseClickLog(lines: readonly string[]): string[] {
  return lines.flatMap(line => /^CLICK (\S+) n=\d+$/.exec(line)?.[1] ?? []);
}

export function sweepPoints(box: SweepBox): { readonly x: number; readonly y: number }[] {
  return SWEEP_FRACTIONS.map(fraction => ({ x: box.x + box.width * fraction, y: box.y - box.height / 2 }));
}

export interface SweepMiss {
  readonly label: string;
  readonly point: number;
  readonly problem: string;
}

export function sweepMisses(button: SweptButton, landed: readonly (string | undefined)[]): SweepMiss[] {
  return landed.flatMap((label, point): SweepMiss[] => label === button.label ? [] : [{
    label: button.label,
    point: point + 1,
    problem: label === undefined ? `${button.label} took no click at point ${point + 1} of ${landed.length}` : `${button.label} point ${point + 1} of ${landed.length} clicked ${label}`,
  }]);
}
