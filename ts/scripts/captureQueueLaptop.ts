import { Effect } from "effect";
import { CaptureQueueFailure } from "./captureQueue";
import { type Pull } from "./captureQueuePull";
import { quote } from "./captureQueueRemote";

const fail = (problem: string) => new CaptureQueueFailure({ problem });

export const LAPTOP_PLACEMENT = "laptop";
const POLL_SECONDS = 5;
const REMOTE_CHECKOUT = "code/smashcraft/main";

/** The job command the laptop's runner takes: it pulls `job` from its origin and runs the batch on the laptop's pair, from the laptop's own checkout. */
export const pullCommand = (job: Pull): readonly string[] => [
  "sh", "-c", `cd "$HOME"/${quote(process.env.SMASHCRAFT_REMOTE_CHECKOUT ?? REMOTE_CHECKOUT)}/ts && exec bun scripts/captureQueuePull.ts "$@"`, "pull",
  "--origin", job.origin, "--origin-store", job.originStore, "--key", job.key, "--plan", job.plan, "--manifest", job.manifest, "--out", job.out,
  "--work", job.work, "--pair", String(job.pair), "--client", job.client, "--minutes", String(job.minutes),
];

export type JobEnd = { readonly ended: false } | { readonly ended: true; readonly state: string; readonly host: string | null };

/** Where job `id` stands in the ledger's `queue --json` listing; a job the listing lacks has ended unseen. */
export const jobEnd = (listing: string, id: string): JobEnd => {
  const row = (JSON.parse(listing) as readonly { readonly id: number; readonly state: string; readonly host: string | null }[]).find(job => String(job.id) === id);
  if (row === undefined) return { ended: true, state: "missing", host: null };
  return ["queued", "requeued", "taken"].includes(row.state) ? { ended: false } : { ended: true, state: row.state, host: row.host };
};

const threads = (what: string, args: readonly string[]) => Effect.tryPromise({
  try: async () => {
    const child = Bun.spawn(["threads", ...args], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    const [out, problem, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (code !== 0) throw new Error(problem.trim() || `exited ${code}`);
    return out.trim();
  },
  catch: cause => fail(`${what}: ${cause instanceof Error ? cause.message : String(cause)}`),
});

/** Queues the capture for the laptop's runner, which takes it only while the laptop is available, and returns once the job is done; a job dropped from the queue when this wait is interrupted before the runner took it. */
export const queueOnLaptop = (host: string, job: Pull, log: (row: Record<string, unknown>) => Effect.Effect<void>) => Effect.gen(function*() {
  const id = yield* threads(`queue the capture for ${host}`, ["queue", "add", LAPTOP_PLACEMENT, "-", "--", ...pullCommand(job)]);
  yield* log({ step: "queue", group: job.work, host, job: id, key: job.key });
  const wait = Effect.gen(function*() {
    while (true) {
      const end = jobEnd(yield* threads("read the job queue", ["queue", "--json"]), id);
      if (end.ended) return end;
      yield* Effect.sleep(`${POLL_SECONDS} seconds`);
    }
  });
  const end = yield* wait.pipe(Effect.onInterrupt(() => threads("drop the queued capture", ["queue", "drop", id, "capture", "wait", "ended"]).pipe(Effect.ignore)));
  if (end.state !== "done") return yield* fail(`capture job ${id} ${end.state} on ${end.host ?? host}; see that host's laptop-runner log for queue-${id}`);
});
