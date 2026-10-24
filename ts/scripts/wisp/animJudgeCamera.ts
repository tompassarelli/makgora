const CAMERA_SLACK_PIXELS = 50;

export const heldHeight = (heights: readonly number[], index: number, pixelsPerUnit: number) => {
  const slack = CAMERA_SLACK_PIXELS / pixelsPerUnit, at = heights[index] ?? 0;
  const middle = (Math.min(...heights, at) + Math.max(...heights, at)) / 2;
  return Math.min(at + slack, Math.max(at - slack, middle));
};
