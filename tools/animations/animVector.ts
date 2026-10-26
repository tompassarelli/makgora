export const NO_GLOBAL_SEQ = null as unknown as number | undefined;
export const floatVector = (vector: ArrayLike<number>): Float32Array<ArrayBuffer> => new Float32Array(vector);
export type KeyVector = import('war3-model').model.AnimKeyframe['Vector'];
export const NO_INDEX = null as unknown as number | undefined;
type AnimKeyframe = import('war3-model').model.AnimKeyframe;
/** A node track with no key in Stand draws its default there (identity rotation, no offset, unit scale), so a clip can return to that, not to another sequence's first key. */
export function unkeyedRest(key: AnimKeyframe | undefined, path: string): AnimKeyframe | undefined {
  const kind = /^\.(?:Bones|Helpers)\.\d+\.(Rotation|Translation|Scaling)$/.exec(path)?.[1];
  if (key === undefined || kind === undefined) return key;
  return { ...key, Vector: new Float32Array(kind === "Rotation" ? [0, 0, 0, 1] : kind === "Scaling" ? [1, 1, 1] : [0, 0, 0]) };
}
export function blend(from: ArrayLike<number>, to: ArrayLike<number>, weight: number): Float32Array<ArrayBuffer> {
  let dot = 0; for (let i = 0; i < 4; i++) dot += from[i]! * to[i]!;
  const sign = dot < 0 ? -1 : 1;
  const vector = Array.from({ length: 4 }, (_, i) => from[i]! * (1 - weight) + sign * to[i]! * weight);
  const length = Math.hypot(...vector); return new Float32Array(vector.map(v => v / length));
}
