import { originalClip } from "../src/generated/clips/fighterOriginalClipInfo";
import { characterClips, clipFor } from "../src/game/presentation/fighterClips";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/sim/heroes/registry";

const SAMPLES = 30;
const SLACK = 0.001;

const refused: string[] = [];
for (const character of SELECTABLE_CHARACTERS) {
  const name = fighterSlug(character);
  for (const [pose, clip] of Object.entries(characterClips(character))) {
    if (clip !== undefined && originalClip(character, clip.index) === undefined) refused.push(`${name} ${pose}: no sequence ${clip.index} in its model`);
  }
  const jump = clipFor(character, "doubleJump");
  const sequence = originalClip(character, jump.index);
  if (sequence === undefined) continue;
  for (let sample = 0; sample <= SAMPLES; sample++) {
    const time = sequence.startSeconds + jump.seconds * sample / SAMPLES;
    if (time < sequence.startSeconds - SLACK || time > sequence.endSeconds + SLACK) {
      refused.push(`${name} doubleJump: ${time.toFixed(3)} s lies outside sequence ${jump.index} (${sequence.startSeconds.toFixed(3)}-${sequence.endSeconds.toFixed(3)} s)`);
      break;
    }
  }
}
if (refused.length > 0) {
  console.error(`clip bindings point outside their fighter's model; regenerate the clip that dropped them (docs/commands/animation.md):\n${refused.join("\n")}`);
  process.exit(1);
}
