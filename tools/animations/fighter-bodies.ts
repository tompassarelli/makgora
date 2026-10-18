import { model as mdx } from '../../ts/scripts/clipNodes';
import { canonicalMotion, classicSkeleton, type FighterRig } from './canonical-rig';
import { timelineBody } from './timeline-body';
import { flashableSequences } from './white-flash-keys';
import { thinKeys } from '../../ts/scripts/keyThin';
import { encodeVerified, parseSource } from './original-clips';
import type { Character } from '../../ts/src/game/sim/codes';
import { clipNames } from './clip-names';
import { fighterRules } from './fighter-rules';

/** The sequence indices the body plays: the fighter's production clips and its results-screen victory pose. */
export function playedMoves(character: Character, motion: mdx.Model): readonly number[] {
    const victory = clipNames(motion.Sequences).get(fighterRules(character).victory);
    const played = new Set(flashableSequences(character, motion.Sequences).map(sequence => motion.Sequences.indexOf(sequence)));
    if (victory !== undefined) played.add(victory);
    return [...played].sort((a, b) => a - b);
}
const selected = (model: mdx.Model, indices: readonly number[]) => model.Sequences.filter((_, index) => indices.includes(index));

/** One fighter's Classic timeline body, generated from its canonical motion through the Classic mapping; `thinnedMotion` is that motion already through thinKeys, which ignores node names. */
export function classicBody(motion: mdx.Model, rig: FighterRig, played: readonly number[], thinnedMotion?: mdx.Model): ArrayBuffer {
    const thinned = thinnedMotion === undefined ? thinKeys(classicSkeleton(motion, rig)).model : classicSkeleton(thinnedMotion, rig);
    return encodeVerified(timelineBody(thinned, selected(thinned, played)));
}

/** Today's canonical motion source: the authored Classic model, mapped onto the rig. */
export const authoredMotion = (authored: ArrayBuffer, rig: FighterRig) => canonicalMotion(parseSource(authored), rig);
