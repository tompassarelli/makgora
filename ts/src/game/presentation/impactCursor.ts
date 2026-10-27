export interface ImpactPresentationCursor {
  lastFrame: number | undefined;
}

export function createImpactPresentationCursor(): ImpactPresentationCursor {
  return { lastFrame: undefined };
}

export function resetImpactPresentationCursor(cursor: ImpactPresentationCursor): void {
  cursor.lastFrame = undefined;
}

export function consumeImpactFrame(cursor: ImpactPresentationCursor, frame: number): boolean {
  if (cursor.lastFrame !== undefined && frame <= cursor.lastFrame) return false;
  cursor.lastFrame = frame;
  return true;
}
