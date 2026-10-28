export interface PoseClip {
  animation: string;
  clipIndex: number | undefined;
  clipName: string;
  clipTime: number;
  selectionSerial: number;
}

export function selectFighterClipIndex(pose: PoseClip, index: number): void {
  pose.clipIndex = index;
  pose.clipName = "";
  pose.clipTime = 0.0;
  pose.selectionSerial++;
}

export function selectFighterClipName(pose: PoseClip, name: string): void {
  pose.clipIndex = undefined;
  pose.clipName = name;
  pose.clipTime = 0.0;
  pose.selectionSerial++;
}
