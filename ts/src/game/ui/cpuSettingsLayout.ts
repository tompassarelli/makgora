import { f32 } from "wisp/src/sim/f32";
import type { TextBox } from "./hudLayout";


export const CPU_SETTINGS_PANEL: TextBox = { left: f32(0.12), top: f32(0.44), width: f32(0.56), height: f32(0.34) };
export const CPU_SETTINGS_ROWS = [f32(0.377), f32(0.333)] as const;
export const CPU_SETTINGS_PREVIEW: TextBox = { left: f32(0.15), top: f32(0.287), width: f32(0.5), height: f32(0.127) };
export const CPU_SETTINGS_DONE: TextBox = { left: f32(0.33), top: f32(0.151), width: f32(0.14), height: f32(0.027) };
export const CPU_SETTINGS_PROMPT: TextBox = { left: f32(0.13), top: f32(0.119), width: f32(0.54), height: f32(0.018) };

const cpuButton = (x: number, y: number, width: number, height: number) =>
  ({ x: f32(CPU_SETTINGS_PANEL.left + x), y: f32(CPU_SETTINGS_PANEL.top - y), width, height }) as const;

export const CPU_SETTINGS_BOXES = {
  close: cpuButton(f32(0.455), f32(0.009), f32(0.075), f32(0.027)),
  opponentPrevious: cpuButton(f32(0.205), f32(0.063), f32(0.04), f32(0.027)),
  opponentNext: cpuButton(f32(0.485), f32(0.063), f32(0.04), f32(0.027)),
  difficultyPrevious: cpuButton(f32(0.205), f32(0.107), f32(0.04), f32(0.027)),
  difficultyNext: cpuButton(f32(0.485), f32(0.107), f32(0.04), f32(0.027)),
  done: cpuButton(f32(0.21), f32(0.289), f32(0.14), f32(0.027)),
} as const;
