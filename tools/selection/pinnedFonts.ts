import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

export const fontConfig = (fonts: string, cache: string) =>
  `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">\n<fontconfig>\n  <dir>${fonts}/share/fonts</dir>\n  <cachedir>${cache}</cachedir>\n</fontconfig>\n`;

export const writeFontConfig = (file: string, fonts: string, cache: string) => writeFileSync(file, fontConfig(fonts, cache));

const ART = new Set(['.tga', '.svg']);

export function clearArt(folder: string): void {
  if (!existsSync(folder)) return void mkdirSync(folder, { recursive: true });
  const entries = readdirSync(folder, { withFileTypes: true });
  const foreign = entries.filter((entry) => !entry.isFile() || !ART.has(extname(entry.name)));
  if (foreign.length > 0) throw new Error(`${folder} holds ${foreign.map(({ name }) => name).join(', ')}, which selection art never writes; give --out a new folder or one holding only earlier selection art`);
  for (const { name } of entries) rmSync(join(folder, name));
}
