# Native evidence batches

From `ts/`, use `bun wisp native plan --boxes FILE.tsv --out PLAN.json`, then
`bun wisp native run PLAN.json --out EVIDENCE_DIR --dry-run --pairs 2` to inspect
assignments. Repeated `--boxes` unions queues; repeated `--row ISSUE:SCRIPT`
selects exact rows. Paths are relative to the TypeScript working directory.

The TSV columns are `issue title class look clients kind map script blockers
parity_evidence`, separated by tabs. Classes are `wisp-sufficient`,
`wisp-plus-one-native-sample`, and `native-only`; kinds are `visual` and `timing`.
An empty blocker or `none` permits execution. A script of `none` blocks it.
Directories expand sorted `.pad` files. JSON scripts are capture manifests.
`clients=pool` uses Classic offline pairs; otherwise clients names an explicit
clients JSON file for a signed-in pair. Supply one concrete look per row.

Wisp rows retain their parity evidence outside the native batches. Identical
scripts within an execution context run once with every issue attached. Visual
batches precede timing batches. By default all free pool pairs participate;
`--pairs N` limits the count, and repeated `--pair K` chooses IDs. Dry runs can
model a larger pool without starting clients. Existing pair claims are respected.

Live pad execution uses `WISP_PAD_HELPER`, or `helper` in an optional
`--executor-config FILE.json`, falling back to `build/tools/wc3-journal`.
Capture execution requires `desktop`, `capacity`, and `install` in that config;
`client` defaults to `a`. These are the existing capture batch's launcher and
installation arguments. A running service pool is attached through pair status;
attached clients remain owned by the pool service. Capture tools resolve at run
time, independently of the caller's PATH. The offline pool cannot run Definitive.

Maps already present are reused; missing maps build before use, with the next
map built while the current batch runs. Pad batches compare headless results
while other scripts run and retain their own row checkpoints. Capture batches
retain frame checkpoints. `plan-run.json` records batch start/end, assignments,
scripts, verdicts and each issue's evidence directories. Successful batches
resume when their plan identity and evidence remain present. Failed batches
re-enter the existing executors, which resume completed rows.
