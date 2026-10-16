declare module "meshoptimizer" {
  export const MeshoptSimplifier: {
    ready: Promise<void>;
    simplify(
      indices: Uint32Array,
      vertexPositions: Float32Array,
      vertexPositionsStride: number,
      targetIndexCount: number,
      targetError: number,
      flags?: ("LockBorder" | "Sparse" | "ErrorAbsolute" | "Prune")[],
    ): [Uint32Array, number];
  };
}
