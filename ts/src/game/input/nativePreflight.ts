// Native clients never receive F24 (0x87) from xdotool; Scroll Lock has one native keycode and no engine binding.
export const NATIVE_PREFLIGHT_KEY = { code: 0x91, name: "Scroll_Lock" } as const;
export const inputPreflightLine = (build: string) => `SMASHCRAFT INPUT key=${NATIVE_PREFLIGHT_KEY.name} build=${build}`;
