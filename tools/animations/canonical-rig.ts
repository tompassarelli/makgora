import type { Character } from "../../ts/src/game/sim/codes";
import { model as mdx } from '../../ts/scripts/clipNodes';

const SIDES = ['L', 'R'] as const;
const LIMB = ['clavicle', 'shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle', 'toe'] as const;

/** The neutral humanoid rig every fighter's motion is stored on (#366). */
export const HUMANOID_JOINTS = [
    'root', 'pelvis', 'chest', 'neck', 'head',
    ...SIDES.flatMap(side => LIMB.map(joint => `${joint}.${side}` as const)),
    'weapon', 'weapon.L',
] as const;
export type HumanoidJoint = (typeof HUMANOID_JOINTS)[number];
const HUMANOID = new Set<string>(HUMANOID_JOINTS);

/** A rig joint's node name in canonical motion; the prefix keeps it apart from a source node of the same name. */
export const rigNode = (joint: string) => HUMANOID.has(joint) ? `@${joint}` : joint;

/** One fighter's Classic body mapping onto the rig: no move, sequence or frame appears in it. */
export interface FighterRig {
    readonly character: Character;
    /** Classic skeleton → rig: the Classic node that carries each humanoid joint. */
    readonly classic: Readonly<Partial<Record<HumanoidJoint, string>>>;
    readonly pain?: PainCorrection;
}

export type PainHeight = "low" | "middle" | "high";
export type PainLimb = "thigh.front" | "shin.front" | "thigh.back" | "shin.back" | "arm.weapon" | "forearm.weapon" | "arm.free" | "forearm.free";
export type PainTurn = "pelvis" | "chest" | "neck" | "head" | "wrist.weapon" | "wrist.free";
export interface PainRow {
    readonly turn?: Readonly<Partial<Record<PainTurn, number>>>;
    readonly aim?: Readonly<Partial<Record<PainLimb, number>>>;
    readonly drop?: number;
}
export interface PainCorrection {
    readonly segments?: readonly { readonly node: string; readonly child: string; readonly limb: PainLimb }[];
    readonly rows?: Readonly<Partial<Record<PainHeight, PainRow>>>;
}

function renamed(model: mdx.Model, names: ReadonlyMap<string, string>): mdx.Model {
    const copy = structuredClone(model);
    for (const node of copy.Nodes) if (node !== undefined && names.has(node.Name)) node.Name = names.get(node.Name)!;
    return copy;
}

function classicNames(model: mdx.Model, rig: FighterRig): Map<string, string> {
    const names = new Map<string, string>();
    const present = new Set(model.Nodes.flatMap(node => node === undefined ? [] : [node.Name]));
    for (const [joint, node] of Object.entries(rig.classic)) {
        if (!HUMANOID.has(joint)) throw new Error(`${joint} is not a humanoid rig joint`);
        if (node === undefined || !present.has(node)) throw new Error(`Classic skeleton has no ${node} for ${joint}`);
        if (names.has(node)) throw new Error(`Classic ${node} carries two rig joints`);
        if (model.Nodes.filter(item => item?.Name === node).length !== 1) throw new Error(`Classic ${node} names more than one node`);
        names.set(node, rigNode(joint));
    }
    for (const name of present) if (name.startsWith('@')) throw new Error(`Classic node ${name} uses the rig joint prefix`);
    return names;
}

/**
 * A fighter's canonical motion: its authored moves on the rig. Humanoid joints take their `rigNode` names, the fighter's
 * other animated nodes are its own secondary joints. Today's Classic animations are its source.
 */
export function canonicalMotion(authored: mdx.Model, rig: FighterRig): mdx.Model {
    return renamed(authored, classicNames(authored, rig));
}

/** The Classic skeleton driven by canonical motion: the Classic mapping applied in reverse. */
export function classicSkeleton(motion: mdx.Model, rig: FighterRig): mdx.Model {
    return renamed(motion, new Map(Object.entries(rig.classic).map(([joint, node]) => [rigNode(joint), node!])));
}
