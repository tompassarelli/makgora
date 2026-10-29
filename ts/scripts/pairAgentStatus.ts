import { Effect, Schema } from "effect";
import { agentSocket } from "wisp/scripts/wisp/lan/pool";

export class PairStatusFailure extends Schema.TaggedError<PairStatusFailure, { readonly brand: unique symbol }>()("PairStatusFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}

export const pairAgentStatus = (pair: number) => Effect.tryPromise({
  try: () => fetch("http://pair/status", { unix: agentSocket(pair) }),
  catch: cause => new PairStatusFailure({ problem: `pair ${pair}'s agent: ${String(cause)}` }),
}).pipe(
  Effect.flatMap(response => response.ok
    ? Effect.tryPromise({ try: () => response.text(), catch: cause => new PairStatusFailure({ problem: `pair ${pair}'s agent: ${String(cause)}` }) })
    : Effect.fail(new PairStatusFailure({ problem: `pair ${pair}'s agent: status ${response.status}` }))),
);
