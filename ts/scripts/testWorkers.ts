// How test processes run, shared by the full suite (scripts/test.ts) and
// `bun wisp dev`.

/** The hang timeout per test; cost is bounded by BUN_TEST_CEILING_FRAMES. */
export const TEST_TIMEOUT_MS = 60_000;

/**
 * Engine settings for short-lived test processes: they cannot amortize the
 * optimizing tiers' compile work for all but their hottest loops, and neither
 * a GC marker thread per core nor a concurrent collector thread repays its CPU
 * (measured on 6 CPUs: concurrent GC off cut the full suite about 7%).
 */
export const TEST_WORKER_ENV: Readonly<Record<string, string>> = {
  BUN_JSC_useFTLJIT: "false",
  BUN_JSC_numberOfDFGCompilerThreads: "1",
  BUN_JSC_thresholdForOptimizeAfterWarmUp: "16000",
  BUN_JSC_thresholdForOptimizeSoon: "16000",
  BUN_JSC_numberOfGCMarkers: "1",
  BUN_JSC_useConcurrentGC: "false",
};

/** Full matches, the all-pairs platform measurement and the combo explorer amortize the production runtime's optimizing tiers. */
const OPTIMIZED = /test\/(standalone|platform-advantage|zero-to-death)\.test\.ts$/;
export const testWorkerEnvironment = (files: readonly string[]): Readonly<Record<string, string>> =>
  files.some((file) => OPTIMIZED.test(file)) ? {} : TEST_WORKER_ENV;
