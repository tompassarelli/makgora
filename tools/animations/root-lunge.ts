export interface Lunge { contact: number; x?: number; z?: number; back: number; over?: number; ramp?: number; decay?: number; peak?: number; hold?: number; snap?: { frames: number; keep: number }; }
export const eased = (progress: number, ease?: number) => ease === undefined ? progress : 1 - (1 - progress) ** ease;
export const lungeAt = (lunge: Lunge, frame: number, frames: number) => {
  const over = lunge.over ?? 0.25, drive = lunge.x ?? lunge.z ?? 0, reach = Math.abs(drive), sign = Math.sign(drive);
  const windup = Math.max(1, Math.round(lunge.contact * 0.6)), peak = lunge.peak ?? lunge.contact, hold = Math.min(frames - 1, lunge.contact + (lunge.hold ?? Math.max(3, lunge.ramp ?? 0)));
  const held = reach * (1 + over), snapped = hold + (lunge.snap?.frames ?? 0), keep = lunge.snap?.keep ?? 1;
  return sign * (frame <= windup ? -lunge.back * Math.sin(frame / windup * Math.PI / 2)
    : frame <= peak ? -lunge.back + (lunge.back + reach) * Math.sqrt((frame - windup) / (peak - windup))
    : frame <= hold ? reach * (1 + over * Math.max(0, Math.min(1, (frame - lunge.contact) / (lunge.ramp ?? 1))))
    : frame <= snapped ? held * (1 - (1 - keep) * (frame - hold) / (snapped - hold))
    : held * keep * Math.max(0, 1 - (frame - snapped) / (lunge.decay ?? Math.min(20, frames - snapped))));
};
