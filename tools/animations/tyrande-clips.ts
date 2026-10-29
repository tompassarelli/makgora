import { Character } from "../../ts/src/game/sim/codes";
import { authorBowRigClips, ClipBook, phase, type Gesture } from "./bow-rig-clips";

const book = new ClipBook();
const SHOULDER = [8, 77] as const, CHEST = [-3, 69] as const, HIPS = [0, 55] as const, ARM = 31, BOW = 76, REST_ARM = 107, REST_BOW = -1;
const degrees = (x: number, z: number) => Math.atan2(x, z) * 180 / Math.PI;
const turn = ([x, z]: readonly [number, number], [px, pz]: readonly [number, number], by: number): [number, number] => { const r = by * Math.PI / 180; return [px + (x - px) * Math.cos(r) + (z - pz) * Math.sin(r), pz - (x - px) * Math.sin(r) + (z - pz) * Math.cos(r)]; };
function aimAt({ tip: [tx, tz], high = false, ...g }: Gesture & { readonly tip: readonly [number, number]; readonly high?: boolean }): Gesture {
  const [sx, sz] = turn(turn(SHOULDER, CHEST, g.chest ?? 0), HIPS, g.lean ?? 0), dx = tx - sx, dz = tz - (sz + (g.height ?? 0)), d = Math.hypot(dx, dz);
  const along = Math.max(-ARM, Math.min(ARM, (ARM * ARM - BOW * BOW + d * d) / (2 * d))), across = Math.sqrt(ARM * ARM - along * along) * (high ? 1 : -1);
  const hx = (along * dx - across * dz) / d, hz = (along * dz + across * dx) / d, reach = degrees(hx, hz), aim = degrees(dx - hx, dz - hz);
  const bow = reach - REST_ARM - (g.chest ?? 0) - (g.lean ?? 0);
  return { ...g, bow, wrist: aim - REST_BOW - reach + REST_ARM };
}
const LEAN = 16;
book.strike("jab", 17, 3, 4, aimAt({ grip: 60, chest: -20, knee: 20, tip: [-30, 140], high: true }), aimAt({ grip: 40, chest: 15, knee: 25, lean: 12, tip: [80, 72] }));
book.strike("jab2", 20, 3, 5, aimAt({ grip: 40, chest: 25, knee: 25, tip: [70, 10] }), aimAt({ grip: -40, chest: -5, knee: 15, lean: 8, tip: [88, 72] }));
book.strike("forwardTilt", 27, 5, 8, aimAt({ grip: 75, chest: -25, knee: 15, tip: [-40, 130], high: true }), aimAt({ chest: 20, knee: 22, lean: LEAN, tip: [100, 70] }));
book.strike("forwardTiltUp", 27, 6, 8, aimAt({ grip: 50, chest: 20, knee: 10, tip: [80, 10] }), aimAt({ chest: -14, head: -15, grip: 20, knee: 8, lean: 4, tip: [88, 126] }));
book.strike("forwardTiltDown", 27, 6, 8, aimAt({ grip: 70, chest: -15, knee: -10, tip: [20, 150], high: true }), aimAt({ chest: 40, knee: 45, tuck: 0.15, tip: [92, 16] }));
book.add("upTilt", 25, [phase(0), phase(3, aimAt({ chest: 15, knee: 25, tip: [80, 20] })), phase(5, aimAt({ grip: -170, chest: -15, head: -25, height: 6, tip: [40, 150], high: true })), phase(8, aimAt({ grip: -200, chest: -30, head: -35, height: 8, tip: [-30, 140], high: true })), phase(16, aimAt({ chest: -5, tip: [-20, 140], high: true })), phase(25)]);
book.strike("downTilt", 25, 6, 8, { knee: 60, tuck: 0.2, kick: 20, shin: 70, chest: 25, bow: -40 }, { knee: 60, tuck: 0.2, kick: 45, shin: -60, chest: 30, bow: -70, grip: -60, lean: -8 });
book.strike("dashAttack", 34, 7, 11, { kick: 40, shin: 120, chest: 10, bow: -30 }, { kick: 85, shin: 115, chest: 20, lean: 18, bow: -70, grip: -80, height: 18 });
book.strike("forwardSmash", 49, 13, 16, aimAt({ grip: -110, chest: -40, knee: 35, lean: -14, tuck: 0.1, tip: [-60, 120], high: true }), aimAt({ grip: 40, chest: 30, knee: 30, lean: 22, tip: [115, 68] }), aimAt({ chest: 14, knee: 12, lean: 8, tip: [100, 40] }));
book.add("upSmash", 46, [phase(0), phase(9, aimAt({ knee: 70, tuck: 0.22, chest: 35, grip: 40, tip: [80, 10] })), phase(12, aimAt({ grip: -150, chest: -20, head: -25, height: 22, tip: [30, 172], high: true })), phase(15, aimAt({ grip: -200, chest: -35, head: -35, height: 28, tip: [-40, 145], high: true })), phase(26, aimAt({ grip: -100, knee: 20, height: 6, tip: [-20, 140], high: true })), phase(46)]);
book.add("downSmash", 45, [phase(0), phase(8, { knee: 55, tuck: 0.18, chest: 15, bow: -40, grip: -20, elbow: 70 }), phase(11, { kick: 85, shin: -35, knee: 35, tuck: 0.15, chest: -25, lean: -10, bow: -40, grip: -20, elbow: 70 }), phase(12, { kick: 85, shin: -35, knee: 35, tuck: 0.15, chest: -25, lean: -10, bow: -40, grip: -20, elbow: 70 }), phase(13, { kick: 85, shin: -35, knee: 35, tuck: 0.15, chest: -25, lean: -10, bow: -40, grip: -20, elbow: 70, yaw: 180 }), phase(14, { kick: 85, shin: -35, knee: 35, tuck: 0.15, chest: -25, lean: -10, bow: -40, grip: -20, elbow: 70, yaw: 180 }), phase(28, { knee: 30, chest: 10, bow: -40 }), phase(45)]);
book.add("neutralAir", 30, [phase(0), phase(2, { kick: 40, shin: 100, kickR: -20, knee: 30, bow: -100, grip: -100 }), phase(4, { kick: 95, kickR: -95, shin: -10, bow: -175, grip: -175, chest: -15, lean: -5 }), phase(11, { kick: 95, kickR: -95, shin: -10, bow: -175, grip: -175, chest: -15, lean: -5 }), phase(18, { knee: 30, bow: -90 }), phase(30)], { air: true });
book.add("forwardAir", 40, [phase(0), phase(4, aimAt({ chest: -20, knee: 40, tip: [-30, 130], high: true })), ...[6, 9, 12, 15].flatMap((at, i) => [phase(at, aimAt({ chest: 25, knee: 45, grip: -60, lean: 12, tip: [85, 52] })), phase(at + 2, aimAt(i === 3 ? { chest: 25, knee: 45, grip: -60, lean: 12, tip: [85, 52] } : { chest: -10, knee: 45, grip: 40, tip: [60, 120], high: true }))]), phase(26, aimAt({ chest: 10, knee: 30, tip: [60, 120], high: true })), phase(40)], { air: true });
book.strike("backAir", 27, 5, 8, { kick: 60, shin: 120, knee: 40, chest: -5 }, { kick: -110, shin: -10, chest: 30, lean: 15, bow: -45, grip: -45 }, {}, true);
book.add("upAir", 28, [phase(0), phase(3, aimAt({ chest: 30, knee: 45, head: 10, tip: [80, 30] })), phase(6, aimAt({ chest: -15, head: -30, knee: 20, tip: [40, 145], high: true })), phase(9, aimAt({ chest: -35, head: -40, knee: 10, kickR: 30, tip: [-40, 140], high: true })), phase(18, aimAt({ knee: 35, tip: [-20, 140], high: true })), phase(28)], { air: true });
book.add("downAir", 36, [phase(0), phase(5, { bow: -200, grip: -190, chest: -25, head: -20, knee: 60, tuck: 0.1 }), phase(8, { bow: -15, grip: -15, chest: 40, lean: 15, knee: 50, head: 10 }), phase(11, { bow: -15, grip: -15, chest: 40, lean: 15, knee: 50, head: 10 }), phase(22, { knee: 30, bow: -80 }), phase(36)], { air: true });
book.add("neutralSpecial", 24, [phase(0), phase(4, { bow: -80, grip: -60, chest: -8, twist: -15 }), phase(7, { bow: -88, grip: -120, elbow: -10, chest: -14, twist: -24, knee: 12 }), phase(8, { bow: -88, grip: 25, elbow: -10, chest: 8, twist: 10, knee: 8 }), phase(14, { bow: -80, grip: 15, chest: 5, knee: 8 }), phase(24)]);
book.add("sideSpecial", 30, [phase(0), phase(6, { bow: -120, grip: -110, chest: -10, head: -20, knee: 20 }), phase(12, { bow: -175, grip: -175, chest: -24, head: -35, knee: 5, height: 6 }), phase(18, { bow: -175, grip: -175, chest: -24, head: -35, knee: 5, height: 6 }), phase(24, { bow: -90, grip: -60, chest: 5 }), phase(30)]);
book.add("upSpecial", 32, [phase(0), phase(5, { chest: 30, knee: 60, bow: 20, grip: 20, tuck: 0.18 }), phase(7, { chest: -20, bow: -170, grip: -170, knee: 0, kick: 25, shin: 40 }), phase(22, { chest: -20, bow: -160, grip: -160, kick: 40, shin: 60 }), phase(32, { chest: 10, knee: 35, bow: -70, grip: -60 })], { air: true });
book.add("downSpecial", 30, [phase(0), phase(2, { bow: 10, grip: 10, chest: 15, knee: 35, tuck: 0.08 }), phase(4, { bow: -70, grip: -95, elbow: 0, chest: -10, lean: -8, knee: 35, tuck: 0.06, head: -5 }), phase(12, { bow: -70, grip: -95, elbow: 0, chest: -10, lean: -8, knee: 35, tuck: 0.06, head: -5 }), phase(20, { bow: -40, grip: -30, chest: 0, knee: 10 }), phase(30)]);
book.movement();
book.grabs();
book.pain(-100, 0, [60, 70, -45]);

await authorBowRigClips({
  character: Character.tyrande, label: "Tyrande", script: "tyrande-clips.ts", stockSequences: 17, standIndex: 12, sidePlane: true, bodyFloor: true,
  modelPath: "war3mapImported\\TyrandeDismountedV2.mdx", shippedModel: "TyrandeDismountedV2.mdx",
  clipModule: "ts/src/game/fighters/tyrande/clips.ts", constant: "TYRANDE", evidence: "tyrande-clips.json",
  stockClips: [
    "export const TYRANDE_FALLBACK_CLIP: HeroClip = { index: 12, seconds: f32(1.133) };", "export const TYRANDE_CLIPS = {",
    "  idle: TYRANDE_FALLBACK_CLIP,", "  walk: { index: 8, seconds: f32(0.833) },", "  dash: { index: 8, seconds: f32(0.833) },", "  run: { index: 8, seconds: f32(0.833) },",
    "  ko: { index: 4, seconds: f32(3.233) },", "  dizzy: { index: 1, seconds: 2.0 },",
  ],
}, book.actions, {
  doubleJump: "jump", wallJump: "jump", wallTech: "tech", fallSpecial: "fall", downDamage: "knockdown", damageTumble: "knockdown",
  damageGround: "pain11", damageAir: "pain11", damageShield: "stop", smashCharge: "shield",
  neutralSpecialAir: "neutralSpecial", sideSpecialAir: "sideSpecial", upSpecialAir: "upSpecial", downSpecialAir: "downSpecial",
});
