import type { model as mdx } from 'war3-model';

export const channels = ['Translation', 'Rotation', 'Scaling'] as const;
export type Channel = typeof channels[number];


export function transforms(model: mdx.Model, visit: (track: mdx.AnimVector, node: mdx.Node, channel: Channel) => void): void {
    for (const node of [...model.Bones, ...model.Helpers, ...model.Attachments, ...model.CollisionShapes]) for (const channel of channels) {
        const animated = node[channel];
        if (typeof animated !== 'object' || animated === null || !('Keys' in animated)) continue;
        if (animated.GlobalSeqId != null && animated.GlobalSeqId !== -1 && animated.GlobalSeqId !== 0xffffffff) continue;
        visit(animated, node, channel);
    }
}

export const keyTracks = (model: mdx.Model): mdx.AnimVector[] => { const tracks: mdx.AnimVector[] = []; transforms(model, track => { tracks.push(track); }); return tracks; };
