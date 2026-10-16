import type { model as mdx } from "war3-model";
import { canonicalMotion, rigNode, type FighterRig } from "./canonical-rig";
import { stockBody } from "./hd-models";
import { generateHdBody, registerRig, transferMotion } from "./hd-retarget";
import { ensure, onGlobalClock, tracks } from "./original-clips";
import { slopeTangents } from "../../ts/scripts/keyThin";
import { headlessRender } from "../../ts/scripts/wisp/headlessRender";

export type DefinitiveLook = Awaited<ReturnType<typeof definitiveLook>>;

export async function definitiveLook(assets: string, rig: FighterRig, fighter: string) {
  const stockName = (rig.stockPath ?? "").replace(/^war3\.w3mod:_de\.w3mod:/, "").replaceAll("/", "\\");
  const resolved = await headlessRender({ assets, imports: [] }).resolveAsset(stockName, "definitive");
  ensure(resolved.bytes !== undefined && resolved.selected?.layer === "_de.w3mod", `${fighter}: no stock Definitive ${stockName}`);
  return { hd: stockBody(resolved.bytes.slice().buffer, rig), pairs: rig.pairs.map(([joint, bone]) => [rigNode(joint), bone] as const) };
}

export function retargetedSequences(model: mdx.Model, rig: FighterRig, look: DefinitiveLook, kept: readonly number[]): ArrayBuffer {
  const reduced = structuredClone(model);
  reduced.Sequences = reduced.Sequences.filter((_, index) => kept.includes(index));
  tracks(reduced, (track, path) => {
    const inside = track.Keys.filter((k) => reduced.Sequences.some((s) => k.Frame >= (s.Interval[0] ?? 0) && k.Frame <= (s.Interval[1] ?? 0)));
    if (!onGlobalClock(track) && inside.length > 0 && /\.(Translation|Rotation|Scaling)$/.test(path)) track.Keys = inside;
  });
  const motion = slopeTangents(canonicalMotion(reduced, rig));
  return generateHdBody(transferMotion(motion, look.hd, registerRig(motion, look.hd, look.pairs, rig), motion.Sequences, rig).model);
}
