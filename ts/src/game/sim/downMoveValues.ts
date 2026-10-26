import { f32 } from "wisp/src/sim/f32";


export function downSmashHit<Effect extends { readonly launchX: number }>(effect: Readonly<Effect>): Readonly<Effect> {
  return { ...effect, growth: 40.0, base: 75.0, launchX: effect.launchX < 0 ? -f32(0.906307787) : f32(0.906307787), launchZ: f32(0.422618262) };
}
