import { Character } from "../../ts/src/game/sim/codes";
import { authorBowRigClips, ClipBook, phase, type Gesture } from "./bow-rig-clips";

const book = new ClipBook();
const DRAWN: Gesture = { bow: 85, grip: 75, elbow: 30, chest: -25, twist: -18, knee: -30 };
const LEAN = 10;
book.strike("jab", 17, 3, 4, DRAWN, { bow: -62, elbow: -12, chest: 18, knee: 8, yaw: 15, lean: LEAN });
book.strike("jab2", 20, 4, 5, { kick: 50, shin: 95, chest: -10, bow: -40 }, { kick: 85, shin: 0, chest: -18, bow: -55, grip: -40, lean: -6 });
book.strike("forwardTilt", 27, 6, 8, DRAWN, { bow: -90, elbow: -16, chest: 26, twist: 28, knee: 20, yaw: 10, lean: LEAN + 6 });
book.strike("forwardTiltUp", 27, 6, 8, { bow: 60, grip: 70, elbow: 25, chest: -18, yaw: -60 }, { bow: -120, elbow: -18, chest: 10, grip: 30, knee: 12, yaw: 25 });
book.strike("forwardTiltDown", 27, 6, 8, { bow: 70, grip: 70, elbow: 25, chest: -18, knee: -20, yaw: -60 }, { bow: -30, elbow: 18, chest: 50, knee: 45, tuck: 0.16 });
book.strike("upTilt", 25, 5, 8, { bow: 28, chest: 20, knee: 18 }, { bow: -165, elbow: -20, chest: -22, grip: -25, knee: 6 });
book.strike("downTilt", 25, 6, 8, { knee: 60, tuck: 0.2, kick: 20, shin: 70, chest: 25, bow: -40 }, { knee: 60, tuck: 0.2, kick: 45, shin: -60, chest: 30, bow: -70, grip: -60, lean: -8 });
book.strike("dashAttack", 34, 7, 11, { kick: 40, shin: 120, chest: 10, bow: -30 }, { kick: 85, shin: 115, chest: 20, lean: 18, bow: -70, grip: -80, height: 18 });
book.strike("forwardSmash", 49, 14, 16, { bow: 40, grip: -105, chest: -30, twist: -34, knee: 20 }, { bow: -85, grip: 35, elbow: -24, chest: 28, twist: 36, knee: 16, lean: LEAN }, { bow: -72, chest: 14, knee: 12 });
book.strike("upSmash", 46, 12, 15, { bow: 20, chest: 30, knee: 40, tuck: 0.12 }, { bow: -180, grip: -150, elbow: -18, chest: -26, knee: 0, height: 10 });
book.add("downSmash", 45, [phase(0), phase(8, { knee: 55, tuck: 0.18, chest: 15, bow: -60, grip: -70 }), phase(11, { kick: 85, shin: -35, knee: 35, tuck: 0.15, chest: -20, bow: -80, grip: -90 }), phase(12, { kick: 85, shin: -35, knee: 35, tuck: 0.15, chest: -20, bow: -80, grip: -90 }), phase(13, { kick: -85, shin: -35, knee: 35, tuck: 0.15, chest: 25, bow: -80, grip: -90 }), phase(14, { kick: -85, shin: -35, knee: 35, tuck: 0.15, chest: 25, bow: -80, grip: -90 }), phase(28, { knee: 30, chest: 10 }), phase(45)]);
book.add("neutralAir", 30, [phase(0), phase(2, { kick: 30, shin: 90, knee: 30, bow: -60 }), phase(4, { kick: 90, shin: 0, bow: -90, grip: -90, yaw: 0 }), phase(8, { kick: 90, shin: 0, bow: -90, grip: -90, yaw: 180 }), phase(11, { kick: 90, shin: 0, bow: -90, grip: -90, yaw: 300 }), phase(18, { knee: 30, yaw: 360 }), phase(30, { yaw: 360 })], { air: true });
book.add("forwardAir", 40, [phase(0), phase(4, DRAWN), ...[6, 9, 12, 15].flatMap((at, i) => [phase(at, { bow: -95, elbow: -16, chest: 22, twist: i % 2 === 0 ? 24 : -10, knee: 30, grip: i % 2 === 0 ? 40 : -60 }), phase(at + 2, { bow: i === 3 ? -100 : 40, elbow: 25, chest: -10, knee: 30, grip: 60 })]), phase(26, { bow: -70, chest: 10, knee: 30 }), phase(40)], { air: true });
book.strike("backAir", 27, 5, 8, { kick: 30, shin: 100, chest: 20, bow: -40 }, { kick: -95, shin: 0, chest: 30, lean: 12, bow: -70, grip: -60, knee: 20 }, {}, true);
book.strike("upAir", 28, 6, 9, { bow: -25, chest: 20, knee: 36 }, { bow: -170, elbow: -18, chest: -24, knee: 10 }, {}, true);
book.add("downAir", 36, [phase(0), phase(5, { kick: 70, shin: 110, knee: 60, chest: 25, bow: -110, grip: -120, tuck: 0.15 }), phase(8, { knee: -15, kick: 0, shin: 0, chest: -12, bow: -150, grip: -150 }), phase(11, { knee: -15, chest: -12, bow: -150, grip: -150 }), phase(22, { knee: 30, bow: -80 }), phase(36)], { air: true });
book.add("neutralSpecial", 24, [phase(0), phase(4, { bow: -80, grip: -60, chest: -8, twist: -15 }), phase(7, { bow: -88, grip: -120, elbow: -10, chest: -14, twist: -24, knee: 12 }), phase(8, { bow: -88, grip: 25, elbow: -10, chest: 8, twist: 10, knee: 8 }), phase(14, { bow: -80, grip: 15, chest: 5, knee: 8 }), phase(24)]);
book.add("sideSpecial", 30, [phase(0), phase(6, { bow: -120, grip: -110, chest: -10, head: -20, knee: 20 }), phase(12, { bow: -175, grip: -175, chest: -24, head: -35, knee: 5, height: 6 }), phase(18, { bow: -175, grip: -175, chest: -24, head: -35, knee: 5, height: 6 }), phase(24, { bow: -90, grip: -60, chest: 5 }), phase(30)]);
book.add("upSpecial", 32, [phase(0), phase(5, { chest: 30, knee: 60, bow: 20, grip: 20, tuck: 0.18 }), phase(7, { chest: -20, bow: -170, grip: -170, knee: 0, kick: 25, shin: 40 }), phase(22, { chest: -20, bow: -160, grip: -160, kick: 40, shin: 60 }), phase(32, { chest: 10, knee: 35, bow: -70, grip: -60 })], { air: true });
book.add("downSpecial", 30, [phase(0), phase(2, { bow: 20, grip: 20, chest: 20, knee: 25 }), phase(4, { bow: -95, grip: -95, elbow: -20, chest: -12, head: -15, knee: 10 }), phase(12, { bow: -95, grip: -95, elbow: -20, chest: -12, head: -15, knee: 10 }), phase(20, { bow: -50, grip: -40, chest: 0 }), phase(30)]);
book.movement();
book.grabs();
book.pain(-100, 0);

await authorBowRigClips({
  character: Character.tyrande, label: "Tyrande", script: "tyrande-clips.ts", stockSequences: 13, standIndex: 12,
  modelPath: "war3mapImported\\TyrandeDismountedSD.mdx", shippedModel: "TyrandeDismountedSD.mdx",
  clipModule: "ts/src/game/fighters/tyrande/clips.ts", constant: "TYRANDE", evidence: "tyrande-clips.json",
  stockClips: [
    "export const TYRANDE_FALLBACK_CLIP: HeroClip = { index: 12, seconds: f32(1.133) };", "export const TYRANDE_CLIPS = {",
    "  idle: TYRANDE_FALLBACK_CLIP,", "  walk: { index: 8, seconds: f32(0.833) },", "  dash: { index: 8, seconds: f32(0.833) },", "  run: { index: 8, seconds: f32(0.833) },",
    "  ko: { index: 9, seconds: f32(2.1) },", "  dizzy: { index: 1, seconds: 2.0 },",
  ],
}, book.actions, {
  doubleJump: "jump", wallJump: "jump", wallTech: "tech", fallSpecial: "fall", downDamage: "knockdown", damageTumble: "knockdown",
  damageGround: "pain11", damageAir: "pain11", damageShield: "stop", smashCharge: "shield",
  neutralSpecialAir: "neutralSpecial", sideSpecialAir: "sideSpecial", upSpecialAir: "upSpecial", downSpecialAir: "downSpecial",
});
