const CAMERA_SLACK_PIXELS = 60;

export const heldHeight = (heights: readonly number[], index: number, pixelsPerUnit: number) => {
  const first = heights[0] ?? 0, slack = CAMERA_SLACK_PIXELS / pixelsPerUnit, travel = (heights[index] ?? 0) - first;
  return first + Math.sign(travel) * Math.max(0, Math.abs(travel) - slack);
};
