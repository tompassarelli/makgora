export type Point = readonly [number, number, number];

/** One arm's joint pivots in world space, and its elbow's hinge axis as carried by the upper arm from the stand pose. */
export interface ArmPose { readonly shoulder: Point; readonly elbow: Point; readonly hand: Point; readonly hinge: Point }
export interface BodyPose { readonly pelvis: Point; readonly arms: readonly [ArmPose, ArmPose] }
export interface PoseSample { readonly frame: number; readonly pose: BodyPose }
/** `excess` is how far past its limit a finding lies, in degrees or percentage points, so a search can descend toward a whole body. */
export interface AnatomyFinding { readonly frame: number; readonly side: 0 | 1; readonly joint: 'shoulder' | 'elbow' | 'hand'; readonly rule: string; readonly value: number; readonly excess: number }

export const ELBOW_FLEX_DEGREES = [-10, 155] as const;
export const ELBOW_OFF_HINGE_DEGREES = 65;
export const BONE_LENGTH_SHARE = 0.08;
export const TORSO_RADIUS_SHARE = 0.3;

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: Point) => Math.hypot(...a);
const unit = (a: Point): Point => { const n = length(a); return [a[0] / n, a[1] / n, a[2] / n]; };
const degrees = (radians: number) => radians * 180 / Math.PI;

/** Elbow flexion about its hinge, in degrees: positive bends the way the stand pose bends, negative bends backward. */
export function elbowFlex(arm: ArmPose): number {
    const upper = unit(sub(arm.elbow, arm.shoulder)), fore = unit(sub(arm.hand, arm.elbow));
    return degrees(Math.atan2(dot(cross(upper, fore), unit(arm.hinge)), dot(upper, fore)));
}

/** How far the forearm leaves the elbow's hinge plane, in degrees. */
export function offHinge(arm: ArmPose): number {
    return degrees(Math.asin(Math.min(1, Math.abs(dot(unit(sub(arm.hand, arm.elbow)), unit(arm.hinge))))));
}

const midpoint = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

function segmentDistance(p: Point, a: Point, b: Point): number {
    const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
    return length(sub(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]));
}

/** The limits are set so every stock Blizzard victory clip in the roster passes (#496). Every way a sampled clip bends a body past what one can: each elbow a hinge within its human range, bone lengths held, and elbows and hands kept outside the torso, the pelvis-to-shoulders line. A `margin` tightens the elbow limits by that many degrees and the torso's by that many percentage points. */
export function anatomyFindings(rest: BodyPose, samples: readonly PoseSample[], margin = 0): AnatomyFinding[] {
    const findings: AnatomyFinding[] = [];
    const [backward, folded, offLimit, lengthLimit, torsoLimit] = [ELBOW_FLEX_DEGREES[0] + margin, ELBOW_FLEX_DEGREES[1] - margin, ELBOW_OFF_HINGE_DEGREES - margin, BONE_LENGTH_SHARE, TORSO_RADIUS_SHARE + margin / 100];
    const span = length(sub(rest.arms[0].shoulder, rest.arms[1].shoulder));
    for (const { frame, pose } of samples) for (const side of [0, 1] as const) {
        const arm = pose.arms[side], at = rest.arms[side];
        const add = (joint: AnatomyFinding['joint'], rule: string, value: number, excess: number) => findings.push({ frame, side, joint, rule, value: Math.round(value * 100) / 100, excess });
        const flex = elbowFlex(arm);
        if (flex < backward) add('elbow', 'bends backward', flex, backward - flex);
        if (flex > folded) add('elbow', 'folds past its range', flex, flex - folded);
        const off = offHinge(arm);
        if (off > offLimit) add('elbow', 'bends off its hinge', off, off - offLimit);
        for (const [joint, from, to, restFrom, restTo] of [['shoulder', arm.shoulder, arm.elbow, at.shoulder, at.elbow], ['elbow', arm.elbow, arm.hand, at.elbow, at.hand]] as const) {
            const share = length(sub(to, from)) / length(sub(restTo, restFrom)) - 1;
            if (Math.abs(share) > lengthLimit) add(joint, 'changes bone length', share, 100 * (Math.abs(share) - lengthLimit));
        }
        for (const joint of ['elbow', 'hand'] as const) {
            const inside = segmentDistance(arm[joint], pose.pelvis, midpoint(pose.arms[0].shoulder, pose.arms[1].shoulder)) / span;
            if (inside < torsoLimit) add(joint, 'passes through the torso', inside, 100 * (torsoLimit - inside));
        }
    }
    return findings;
}

/** The same pose with one forearm swung about its elbow hinge by `degreesBy`; a negative swing past the elbow's flexion bends it backward. */
export function swingForearm(pose: BodyPose, side: 0 | 1, degreesBy: number): BodyPose {
    const arm = pose.arms[side], k = unit(arm.hinge), v = sub(arm.hand, arm.elbow), angle = degreesBy * Math.PI / 180;
    const [c, s] = [Math.cos(angle), Math.sin(angle)], kv = cross(k, v), kk = dot(k, v);
    const hand = [0, 1, 2].map(i => arm.elbow[i]! + v[i]! * c + kv[i]! * s + k[i]! * kk * (1 - c)) as unknown as Point;
    const arms = pose.arms.map((each, at) => at === side ? { ...each, hand } : each) as unknown as readonly [ArmPose, ArmPose];
    return { ...pose, arms };
}
