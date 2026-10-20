import { join } from "node:path";

export const tsDirectory = join(import.meta.dir, "../..");
export const projectRoot = join(tsDirectory, "..");
