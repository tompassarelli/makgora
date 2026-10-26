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
