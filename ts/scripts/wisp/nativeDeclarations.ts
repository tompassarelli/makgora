import { dirname, join } from "node:path";
import { readNativeDeclarations } from "wisp/scripts/wisp/headless";

declare const PLAYER_COMMIT: string | undefined;

/** Wisp's native declarations: from its source tree, or from beside the executable in a packaged player, which carries no source tree. */
export const nativeDeclarations = () => typeof PLAYER_COMMIT === "string" ? readNativeDeclarations(join(dirname(process.execPath), "warcraft.d.ts")) : readNativeDeclarations();
