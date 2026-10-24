import type { model as mdx } from "war3-model";
import { author, Kit, lieFrame, reuse, swing, zero, type AuthorOptions, type Beat, type Beats, type Clip } from "./lichking-authoring";

const beats = (keys: Readonly<Record<number, Beat>>): Beats => new Map(Object.entries(keys).map(([frame, beat]) => [Number(frame), beat]));

const GUARD: Beat = { handR: [22, -30, 88], aim: 20 };
const WIDE: Beat = { footR: [30, -16, 1], footL: [-24, 14, 1] };
const TUCK: Beat = { footR: [20, -16, 40], footL: [-6, 14, 34] };
const FALL: Beat = { step: [0, 0], lean: 6, handR: [24, -32, 92], aim: -10, handL: [-10, 30, 104], footR: [16, -16, 16], footL: [-14, 14, 8] };
const AIR: AuthorOptions = { baseFrom: "Fall", plant: false };

function normals(kit: Kit): Clip[] {
    return [
        reuse(kit, "Attack Jab", "Attack - 1", zero(6), 21),
        reuse(kit, "Attack Jab 2", "Attack - 2", zero(7), 25),
        author(kit, "Attack Jab 3", swing(zero(9), 3, 34, {
            wind: { step: [-6, -4], lean: -10, twist: 25, handR: [-18, -34, 98], aim: 5, handL: [24, 20, 100] },
            strike: { step: [12, -6], lean: 18, twist: -15, handR: [44, -26, 92], aim: -2, handL: [-24, 26, 92], footR: [52, -16, 1] },
            follow: { step: [10, -4], lean: 12, handR: [36, -26, 92], aim: 0, footR: [46, -16, 1] },
            settle: [26, { step: [4, 0], lean: 4, handR: [20, -30, 90], aim: 10 }],
        })),
        author(kit, "Forward Tilt", swing(zero(11), 4, 38, {
            wind: { step: [-6, -2], lean: -14, twist: 20, handR: [-6, -30, 132], aim: 120, handL: [20, 16, 100] },
            strike: { step: [26, -8], lean: 24, twist: -10, handR: [42, -28, 96], aim: 5, handL: [-20, 24, 92], footR: [46, -16, 1] },
            follow: { step: [14, -10], lean: 22, handR: [38, -28, 70], aim: -40, footR: [42, -16, 1] },
            settle: [30, { step: [4, -2], lean: 6, handR: [22, -30, 86], aim: 10 }],
        })),
        author(kit, "Up Tilt", swing(zero(10), 5, 37, {
            wind: { step: [2, -8], lean: 10, handR: [30, -30, 74], aim: -20 },
            strike: { step: [0, 4], lean: -10, handR: [8, -28, 138], aim: 92, handL: [-10, 24, 120] },
            follow: { step: [-4, 0], lean: -18, handR: [-18, -28, 124], aim: 160 },
            settle: [29, { lean: -4, handR: [6, -30, 96], aim: 60 }],
        })),
        author(kit, "Down Tilt", beats({
            0: {}, [zero(9) - 3]: { step: [0, -22], lean: 16, handR: [6, -30, 70], aim: 30 },
            [zero(9)]: { step: [6, -32], lean: 30, handR: [40, -28, 46], aim: -12, footR: [40, -16, 1] },
            [zero(10)]: { step: [6, -32], lean: 30, twist: -20, handR: [34, -28, 44], aim: -10, footR: [40, -16, 1] },
            [zero(11)]: { step: [-2, -32], lean: 18, twist: -70, handR: [-30, -20, 48], aim: -170, footR: [40, -16, 1] },
            [zero(12)]: { step: [-4, -32], lean: 16, twist: -80, handR: [-34, -18, 48], aim: -172, footR: [40, -16, 1] },
            24: { step: [0, -18], lean: 10, handR: [10, -30, 70], aim: 20 }, 34: {},
        })),
        author(kit, "Dash Attack", swing(zero(12), 4, 45, {
            wind: { step: [-10, -8], lean: -8, twist: 30, handR: [-24, -34, 92], aim: 4, handL: [26, 20, 98] },
            strike: { step: [30, -14], lean: 30, twist: -15, handR: [48, -26, 86], aim: -4, handL: [-28, 26, 96], footR: [64, -16, 1], footL: [-36, 14, 1] },
            follow: { step: [26, -12], lean: 24, handR: [42, -26, 84], aim: -6, footR: [60, -16, 1], footL: [-34, 14, 1] },
            settle: [34, { step: [8, -2], lean: 6, handR: [22, -30, 88], aim: 10 }],
        })),
    ];
}

const FSMASH_WIND: Beat = { step: [-10, -6], lean: -20, twist: 10, handR: [-4, -28, 140], aim: 135, handL: [-2, -10, 140], ...WIDE };
const FSMASH_HIT: Beat = { step: [24, -18], lean: 34, handR: [48, -26, 92], aim: -5, handL: [40, -12, 94], footR: [58, -16, 1], footL: [-30, 14, 1] };
const USMASH_WIND: Beat = { step: [0, -24], lean: 12, handR: [20, -30, 64], aim: -60, handL: [14, 24, 64] };
const USMASH_HIT: Beat = { step: [0, 8], lean: -6, handR: [4, -26, 146], aim: 90, handL: [-2, 30, 146] };
const DSMASH_WIND: Beat = { step: [0, -6], lean: -16, handR: [10, -26, 146], aim: 100, handL: [8, -8, 144] };
const DSMASH_HIT: Beat = { step: [14, -34], lean: 38, handR: [42, -24, 52], aim: -28, handL: [38, -10, 54], footR: [44, -16, 1], footL: [-36, 14, 1] };

function smashes(kit: Kit): Clip[] {
    return [
        author(kit, "Forward Smash", swing(zero(22), 4, 63, {
            wind: FSMASH_WIND, strike: FSMASH_HIT, follow: { ...FSMASH_HIT, lean: 30, handR: [44, -26, 64], aim: -45, handL: [36, -12, 66] },
            windAt: 12, settle: [48, { step: [6, -4], lean: 8, handR: [22, -30, 86], aim: 10 }],
        })),
        author(kit, "Up Smash", swing(zero(18), 8, 63, {
            wind: USMASH_WIND, strike: USMASH_HIT, follow: { ...USMASH_HIT, step: [0, -6], handR: [12, -28, 110], aim: 60, handL: [4, 30, 120] },
            windAt: 10, settle: [50, { handR: [20, -30, 96], aim: 40 }],
        })),
        author(kit, "Down Smash", swing(zero(17), 6, 62, {
            wind: DSMASH_WIND, strike: DSMASH_HIT, follow: { ...DSMASH_HIT, step: [10, -30], lean: 32 },
            windAt: 11, settle: [48, { step: [4, -8], lean: 10, handR: [22, -30, 84], aim: 10 }],
        })),
        author(kit, "Smash Charge", beats({ 0: FSMASH_WIND, 8: { ...FSMASH_WIND, lean: -22, step: [-11, -7] }, 16: FSMASH_WIND }), { looping: true }),
    ];
}

const CROUCH: Beat = { step: [0, -30], lean: 22, handR: [30, -30, 52], aim: -8, handL: [24, 20, 60] };
const SHIELD: Beat = { step: [0, -12], lean: 6, handR: [30, -24, 94], aim: 88, handL: [26, -6, 100], ...WIDE };
const AIR_DODGE: Beat = { ...FALL, ...TUCK, lean: 30, handR: [8, -30, 84], aim: 70, handL: [14, 24, 90] };

function movement(kit: Kit): Clip[] {
    return [
        author(kit, "Crouch", beats({ 0: CROUCH, 30: { ...CROUCH, step: [0, -32] }, 60: CROUCH }), { looping: true }),
        author(kit, "Fall", beats({ 0: FALL, 30: { ...FALL, handL: [-14, 32, 110], footR: [18, -16, 20] }, 60: FALL }), { plant: false, looping: true }),
        author(kit, "Jump", beats({
            0: { step: [0, -18], lean: 14, ...GUARD }, 5: { step: [0, 4], lean: -6, handR: [20, -30, 100], aim: 30 },
            12: { ...TUCK, lean: 4, handR: [22, -30, 96], aim: 10 }, 24: FALL,
        }), { plant: false }),
        author(kit, "Double Jump", beats({
            0: { ...FALL, ...TUCK }, 6: { ...TUCK, spin: 90, handR: [20, -30, 90], aim: 0 },
            14: { ...TUCK, spin: 220, handR: [20, -30, 90], aim: 0 }, 22: { ...TUCK, spin: 360, handR: [22, -30, 92], aim: 0 },
            30: { ...FALL, spin: 360 },
        }), { plant: false }),
        author(kit, "Landing", beats({
            0: { step: [0, -26], lean: 18, handR: [30, -30, 60], aim: -20, handL: [20, 24, 64] }, 6: { step: [0, -20], lean: 12, handR: [26, -30, 70], aim: -10 }, 16: {},
        })),
        author(kit, "Fall Special", beats({
            0: { ...FALL, lean: 16, handR: [10, -32, 70], aim: -70, handL: [0, 30, 74] },
            30: { ...FALL, lean: 20, handR: [8, -32, 66], aim: -75, handL: [-2, 30, 70] }, 60: { ...FALL, lean: 16, handR: [10, -32, 70], aim: -70, handL: [0, 30, 74] },
        }), { plant: false, looping: true }),
        author(kit, "Shield", beats({ 0: SHIELD, 30: { ...SHIELD, step: [0, -13] }, 60: SHIELD }), { looping: true }),
        author(kit, "Damage Shield", beats({ 0: SHIELD, 4: { ...SHIELD, step: [-8, -14], lean: -6 }, 24: SHIELD })),
        author(kit, "Spot Dodge", beats({
            0: {}, 4: { step: [-10, -24], lean: -18, handR: [0, -30, 90], aim: 80 }, 14: { step: [-10, -24], lean: -18, handR: [0, -30, 90], aim: 80 }, 22: {},
        })),
        author(kit, "Roll Forward", beats({
            0: {}, 6: { step: [0, -30], lean: 40, spin: 30, handR: [10, -30, 70], aim: -60 },
            18: { step: [0, -30], lean: 40, spin: 30, handR: [10, -30, 70], aim: -60 }, 31: {},
        })),
        author(kit, "Roll Backward", beats({
            0: {}, 6: { step: [0, -28], lean: -26, spin: -20, handR: [10, -30, 90], aim: 70 },
            18: { step: [0, -28], lean: -26, spin: -20, handR: [10, -30, 90], aim: 70 }, 31: {},
        })),
        author(kit, "Air Dodge", beats({ 0: FALL, 6: AIR_DODGE, 34: AIR_DODGE, 49: FALL }), { plant: false }),
    ];
}

const NAIR_FRONT: Beat = { ...TUCK, twist: -10, handR: [40, -26, 94], aim: 0, handL: [-26, 26, 96] };
const NAIR_BACK: Beat = { ...TUCK, twist: 40, handR: [-34, -20, 94], aim: 180, handL: [24, 26, 96] };

function aerials(kit: Kit): Clip[] {
    return [
        author(kit, "Aerial Neutral", beats({
            0: FALL, [zero(10) - 3]: { ...TUCK, twist: 30, handR: [-10, -32, 100], aim: 160 },
            [zero(10)]: NAIR_FRONT, [zero(13)]: { ...NAIR_FRONT, handR: [30, -26, 110], aim: 60 },
            [zero(14)]: NAIR_BACK, [zero(17)]: { ...NAIR_BACK, aim: 200 }, 28: { ...FALL, handR: [10, -30, 96], aim: 120 }, 41: FALL,
        }), AIR),
        author(kit, "Aerial Forward", swing(zero(14), 4, 47, {
            start: FALL, wind: { ...TUCK, lean: -16, handR: [-2, -28, 140], aim: 115 },
            strike: { ...TUCK, lean: 26, handR: [44, -26, 90], aim: -15, handL: [-14, 26, 100] },
            follow: { ...TUCK, lean: 22, handR: [32, -26, 60], aim: -70 }, windAt: 8,
        }), AIR),
        author(kit, "Aerial Back", swing(zero(11), 4, 40, {
            start: FALL, wind: { ...TUCK, twist: -30, handR: [30, -28, 104], aim: 30 },
            strike: { ...TUCK, lean: -20, twist: 50, handR: [-34, -20, 100], aim: 182, handL: [24, 26, 96] },
            follow: { ...TUCK, lean: -14, twist: 40, handR: [-30, -22, 84], aim: 210 },
        }), AIR),
        author(kit, "Aerial Up", swing(zero(10), 5, 39, {
            start: FALL, wind: { ...TUCK, handR: [30, -28, 84], aim: -10 },
            strike: { ...TUCK, lean: -14, handR: [10, -26, 140], aim: 92, handL: [-10, 26, 120] },
            follow: { ...TUCK, lean: -18, handR: [-16, -26, 128], aim: 150 },
        }), AIR),
        author(kit, "Aerial Down", swing(zero(18), 5, 55, {
            start: FALL, wind: { ...TUCK, lean: -8, handR: [14, -24, 140], aim: 92, handL: [12, -6, 138] },
            strike: { footR: [10, -16, 30], footL: [-10, 14, 26], lean: 10, handR: [16, -22, 76], aim: -90, handL: [14, -8, 80] },
            follow: { footR: [10, -16, 28], footL: [-10, 14, 24], lean: 8, handR: [16, -22, 78], aim: -88, handL: [14, -8, 82] },
            windAt: 10, followAt: zero(22) + 10,
        }), AIR),
    ];
}

const GRAB_HIT: Beat = { step: [18, -12], lean: 26, twist: 20, handL: [56, 16, 96], handR: [10, -30, 90], aim: 12 };
const HOLD: Beat = { step: [6, -4], lean: 10, handL: [40, 14, 104], handR: [-4, -32, 92], aim: 70 };
const HARVEST: Beat = { step: [8, -20], lean: 26, handL: [44, 14, 58], handR: [20, -28, 110], aim: -40 };
const GRABBED: Beat = { step: [-4, 0], lean: -18, handR: [6, -32, 74], aim: -70, handL: [14, 26, 112], ...TUCK };

function grabs(kit: Kit): Clip[] {
    return [
        author(kit, "Grab", swing(zero(9), 2, 40, {
            wind: { lean: -4, handL: [4, 26, 104], handR: [-6, -32, 96], aim: 85 }, strike: GRAB_HIT,
            follow: { ...GRAB_HIT, handL: [40, 16, 92], aim: 30 }, settle: [28, { handL: [16, 20, 96], handR: [6, -32, 90], aim: 50 }],
        })),
        author(kit, "Grab Hold", beats({ 0: HOLD, 30: { ...HOLD, handL: [40, 14, 106] }, 60: HOLD }), { looping: true }),
        author(kit, "Pummel", beats({
            0: HOLD, 52: { ...HOLD, twist: 25, handR: [-14, -34, 110], aim: 120 }, 59: { ...HOLD, twist: -10, handR: [30, -26, 100], aim: 40 }, 68: HOLD,
        })),
        author(kit, "Throw Forward", swing(zero(15), 1, 38, {
            start: HOLD, wind: { ...HOLD, twist: 30, handL: [24, 18, 100], handR: [-20, -32, 120], aim: 120 },
            strike: { step: [20, -10], lean: 26, handL: [50, 14, 100], handR: [46, -26, 96], aim: 0, footR: [50, -16, 1] },
            follow: { step: [14, -8], lean: 18, handL: [34, 16, 96], handR: [40, -26, 80], aim: -30 },
        })),
        author(kit, "Throw Back", swing(zero(18), 1, 46, {
            start: HOLD, wind: { ...HOLD, twist: -40, handL: [30, 14, 110] },
            strike: { step: [-14, -6], lean: -16, twist: 70, handL: [-40, 18, 100], handR: [-30, -22, 96], aim: 180 },
            follow: { step: [-10, -4], lean: -10, twist: 50, handL: [-30, 18, 96], handR: [-24, -24, 90], aim: 200 },
        })),
        author(kit, "Throw Up", swing(zero(16), 1, 30, {
            start: HOLD, wind: { ...HOLD, step: [4, -20], handL: [34, 14, 80] },
            strike: { step: [0, 6], lean: -10, handL: [12, 16, 150], handR: [6, -26, 140], aim: 90 },
            follow: { step: [0, 2], lean: -6, handL: [10, 18, 130], handR: [10, -26, 120], aim: 80 }, windAt: 10, followAt: 24,
        })),
        author(kit, "Throw Down", swing(zero(24), 1, 50, {
            start: HOLD, wind: { ...HOLD, step: [6, -10], handL: [42, 14, 76], handR: [0, -28, 128], aim: 60 },
            strike: { ...HARVEST, handR: [40, -26, 72], aim: -45 }, follow: { ...HARVEST, handR: [30, -28, 96], aim: -20 }, windAt: 12, followAt: 36,
        })),
        author(kit, "Grabbed", beats({ 0: GRABBED, 30: { ...GRABBED, lean: -20 }, 60: GRABBED }), { plant: false, looping: true }),
    ];
}

const TUMBLE: Beat = { handR: [0, -34, 104], aim: 150, handL: [-4, 32, 110], footR: [14, -16, 30], footL: [-18, 14, 24] };

function damage(kit: Kit): Clip[] {
    const lie = lieFrame(kit);
    const floor: AuthorOptions = { baseFrom: "Death", baseFrame: kit.action("Death").first + lie, plant: false };
    const rising: AuthorOptions = { ...floor, standingFrom: ["Stand Ready", 0] };
    return [
        author(kit, "Damage Ground", beats({ 0: {}, 3: { step: [-8, -6], lean: -22, twist: -15, handR: [6, -32, 80], aim: -40, handL: [-10, 30, 110] }, 24: {} })),
        author(kit, "Damage Air", beats({ 0: FALL, 3: { ...FALL, lean: -26, handR: [6, -32, 80], aim: -40, handL: [-10, 30, 116], ...TUCK }, 24: FALL }), { plant: false }),
        author(kit, "Damage Tumble", beats({ 0: { ...TUMBLE, spin: 0 }, 12: { ...TUMBLE, spin: -180 }, 24: { ...TUMBLE, spin: -360 } }), { plant: false, looping: true }),
        reuse(kit, "Knockdown", "Death", 20, 26, { hit: lie }),
        author(kit, "Down Damage", beats({ 0: {}, 3: { step: [0, 4] }, 13: {} }), floor),
        author(kit, "Get Up", beats({ 0: { rise: 0 }, 10: { rise: 0.25, step: [0, 4] }, 22: { rise: 0.85 }, 30: { rise: 1 } }), rising),
        author(kit, "Get Up Attack", beats({
            0: { rise: 0 }, 10: { rise: 0.3, handR: [-10, -30, 80], aim: 170 },
            16: { rise: 0.45, step: [24, 0], handR: [40, -26, 70], aim: 0 }, 18: { rise: 0.45, step: [24, 0], handR: [40, -26, 68], aim: -4 },
            28: { rise: 0.7, step: [10, 0], handR: [30, -28, 80], aim: 10 }, 49: { rise: 1 },
        }), rising),
    ];
}

const HANG: Beat = { step: [10, -30], lean: 6, handL: [17, 20, 130], handR: [4, -32, 74], aim: -80, footR: [0, -16, 6], footL: [-14, 14, 4] };
const PULL: Beat = { ...HANG, step: [14, -14], handL: [14, 20, 112] };
const LOOSE: AuthorOptions = { plant: false };

function ledges(kit: Kit): Clip[] {
    return [
        author(kit, "Ledge Hang", beats({ 0: HANG, 30: { ...HANG, step: [-30, -98] }, 60: HANG }), { plant: false, looping: true }),
        author(kit, "Ledge Climb", beats({ 0: HANG, 8: PULL, 16: { step: [0, -14], lean: 20, handR: [20, -30, 70], aim: -20 }, 25: {} }), LOOSE),
        author(kit, "Ledge Roll", beats({
            0: HANG, 8: PULL, 16: { step: [0, -30], lean: 40, spin: 40, handR: [10, -30, 70], aim: -60 },
            28: { step: [0, -26], lean: 30, spin: 30, handR: [10, -30, 72], aim: -50 }, 36: {},
        }), LOOSE),
        author(kit, "Ledge Attack", beats({
            0: HANG, 8: PULL, 13: { step: [-4, -18], lean: -6, twist: 25, handR: [-10, -32, 100], aim: 150 },
            16: { step: [14, -16], lean: 22, handR: [44, -26, 88], aim: 0, footR: [44, -16, 1] },
            18: { step: [14, -16], lean: 22, handR: [42, -26, 84], aim: -10, footR: [44, -16, 1] },
            28: { step: [6, -6], lean: 8, handR: [24, -30, 86], aim: 10 }, 40: {},
        }), LOOSE),
        author(kit, "Wall Jump", beats({
            0: { ...FALL, ...TUCK, lean: 20, handL: [-34, 26, 100] }, 5: { ...TUCK, lean: 26, handL: [-40, 26, 96], step: [-6, 0] },
            14: { ...FALL, lean: -10, handR: [30, -28, 104], aim: 30 }, 45: FALL,
        }), LOOSE),
        author(kit, "Wall Tech", beats({ 0: { ...TUMBLE }, 5: { ...TUCK, lean: 24, handL: [-40, 26, 96], step: [-6, 0] }, 31: FALL }), LOOSE),
    ];
}

const DEFILE_WIND: Beat = { step: [-6, 0], lean: -10, twist: -16, handR: [24, -32, 160], handL: [28, 16, 146], aim: 90 };
const DEFILE_CAST: Beat = { step: [10, -8], lean: 6, twist: 8, handR: [62, -28, 150], handL: [48, 12, 140], aim: -90, footL: [42, 14, 1] };
const RISE: Beat = { lean: -8, handR: [6, -26, 148], aim: 92, handL: [24, 30, 132], footR: [4, -16, 6], footL: [-4, 14, 6] };

function specials(kit: Kit): Clip[] {
    return [
        reuse(kit, "Special Neutral", "Spell Throw", zero(29), 56),
        author(kit, "Special Down", beats({
            0: {}, 9: DEFILE_WIND, 14: DEFILE_WIND, [zero(20)]: DEFILE_CAST, 25: DEFILE_CAST,
            33: { step: [6, -10], lean: 16, handR: [34, -30, 114], handL: [32, 20, 106], aim: -65 }, 46: {}, 50: {},
        }), { copyOf: "Spell Channel" }),
        author(kit, "Special Side", swing(zero(26), 4, 52, {
            wind: { step: [-6, 0], lean: -12, twist: -20, handL: [-6, 26, 140], handR: [-6, -32, 92], aim: 70 },
            strike: { step: [12, -6], lean: 18, twist: 20, handL: [50, 14, 112], handR: [-10, -32, 90], aim: 60, footL: [40, 14, 1] },
            follow: { step: [14, -6], lean: 22, twist: 22, handL: [62, 12, 100], handR: [-8, -32, 90], aim: 60, footL: [40, 14, 1] },
        })),
        author(kit, "Special Up", beats({
            0: {}, 5: { step: [0, -24], lean: 14, handR: [20, -30, 64], aim: -40, handL: [16, 24, 70] },
            [zero(8)]: RISE, 18: { ...RISE, twist: -25, aim: 96 }, 24: { ...RISE, twist: 25, aim: 88 }, [zero(30)]: RISE,
            38: { ...FALL, lean: 10, handR: [20, -30, 100], aim: 40 }, 46: FALL,
        }), LOOSE),
    ];
}

const TECH_BRACE: Beat = { step: [0, -42], lean: 38, handR: [14, -30, 64], aim: -30, handL: [42, 20, 24], ...WIDE };

function transitions(kit: Kit): Clip[] {
    const lie = kit.action("Death").first + lieFrame(kit);
    return [
        author(kit, "Turn", beats({ 0: { step: [0, -10], lean: -14, twist: 24, ...GUARD }, 4: { step: [0, -18], lean: 10, twist: -24, ...GUARD }, 8: {} })),
        author(kit, "Stop", beats({ 0: { step: [0, -8], lean: 24, ...GUARD }, 3: { step: [-6, -16], lean: -16, ...GUARD }, 8: {} })),
        author(kit, "Jump Squat", beats({ 0: {}, 3: { step: [0, -18], lean: 14, ...GUARD } })),
        author(kit, "Tech", beats({ 0: TECH_BRACE, 6: { ...TECH_BRACE, step: [0, -34] }, 15: { step: [0, -18], lean: 18, ...GUARD }, 26: {} })),
        ...([["Tech Forward", 1], ["Tech Backward", -1]] as const).map(([name, sign]) => author(kit, name, beats({
            0: TECH_BRACE,
            8: { step: [0, -36], lean: sign * 32, spin: sign * 24, handR: [10, -30, 78], aim: sign * -50, handL: [12, 24, 64] },
            24: { step: [0, -28], lean: sign * 24, spin: sign * 18, ...GUARD },
            40: {},
        }))),
        ...([["Get Up Roll Forward", 1], ["Get Up Roll Backward", -1]] as const).map(([name, sign]) => author(kit, name, beats({
            0: { rise: 0 },
            7: { rise: 0.3, step: [0, 6], lean: sign * 12 },
            16: { rise: 0.7, step: [0, -14], lean: sign * 32, spin: sign * 20, handR: [12, -30, 78], aim: sign * -40, handL: [24, 24, 42] },
            26: { rise: 1, step: [0, -20], lean: sign * 18, ...GUARD },
            35: { rise: 1 },
        }), { baseFrom: "Death", baseFrame: lie, standingFrom: ["Stand Ready", 0], plant: false })),
    ];
}

export function lichKingClips(source: mdx.Model): Clip[] {
    const kit = new Kit(source);
    return [normals, smashes, movement, aerials, grabs, damage, ledges, specials, transitions].flatMap((group) => group(kit));
}
