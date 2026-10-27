import { originalClipNames } from "../src/generated/clips/fighterOriginalClipInfo";
import { advanceFighterPose, createFighterPose } from "../src/game/presentation/fighterPose";
import { beginFighterAttack } from "../src/game/sim/attacks";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { createRoster, neutralControls } from "../src/game/sim/roster";
import { advanceFighter } from "../src/game/sim/step";
import { capture } from "./wisp/hurtboxView";
const ch = Character.mountainKing;
console.log(typeof originalClipNames === "function" ? "" : Object.keys(originalClipNames ?? {}).length);
for (const style of [AttackStyle.neutralAir, AttackStyle.forwardAir]) {
  const f = createFighter(ch, 0.0, 1), world = createRoster(1, [f]); f.motion.grounded = false; f.motion.z = 900.0;
  const p = createFighterPose(), input = neutralControls();
  beginFighterAttack(world, 0, style, false); advanceFighterPose(p, f, world, input, false, false, true, false);
  const rows = [capture(f, p)];
  for (let i = 0; i < 60; i++) { advanceFighter(world, 0, 0, input, 0.0); advanceFighterPose(p, f, world, input, false, false, false, false); rows.push(capture(f, p)); }
  console.log(AttackStyle[style], rows.map((r, i) => `${i}:${r.clip}@${r.seconds.toFixed(3)}${f.attack.style===style?"":""}`).join(" "));
}
