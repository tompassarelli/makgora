export const TINTABLE_FRAME_KINDS: readonly string[] = [];

const TINT_CALL = /\b(setFrameColor|BlzFrameSetVertexColor)\s*\(/;

export interface SourceLine {
  readonly path: string;
  readonly line: number;
  readonly text: string;
}

export function tintProblems(lines: readonly SourceLine[]): string[] {
  return lines.filter(({ text }) => TINT_CALL.test(text)).map(({ path, line }) => `${path}:${line} tints a frame, and Warcraft Classic ignores a frame tint on every frame kind the map creates (none are in TINTABLE_FRAME_KINDS); bake one texture per colour into selection-assets and swap the texture instead`);
}
