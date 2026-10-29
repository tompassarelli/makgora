import { GITHUB_PAGE, communityUrl } from "./community";

export const CREDITS_TITLE = "Credits";

export const CREDITS_MARKDOWN: readonly string[] = [
  `Created by Tompas (Tom Passarelli). Code, design, animation and stage dressing are our own, written in TypeScript and compiled to Warcraft III's Lua. Source: [GitHub - tompassarelli/smashcraft](${communityUrl(GITHUB_PAGE)}) (MIT License).`,
  "The Lich King model by [Kwaliti](https://www.hiveworkshop.com/members/kwaliti.136001/), from [Hive Workshop](https://www.hiveworkshop.com/threads/the-lich-king.154837/). Used with credit as the author permits ([Kwaliti's usage statement](https://www.hiveworkshop.com/profile-posts/951524/)).",
  "Thrall is [Warchief Thrall Dismounted](https://www.hiveworkshop.com/threads/warchief-thrall-dismounted-re-classic.332006/) by johnwar, from Hive Workshop, built on Ujimasa Hojo's Grom Hellscream; we reanimated every move on it.",
  "Tyrande Dismounted SD by Retera, from [Hive Workshop](https://www.hiveworkshop.com/threads/tyrande-dismounted-sd.328533/), open source, reanimated for Smashcraft as the author allows.",
  "The menu cursors, wordmark and stage-select art are Smashcraft originals; the pinching-hand cursor was made with AI assistance.",
  "Music: Before the First Strike by Tom Passarelli, made with Google Lyria.",
  "Murloc sound from World of Warcraft, Blizzard Entertainment.",
  "Warcraft III, its unit models, icons and sounds belong to Blizzard Entertainment. Smashcraft is an independent fan project, not affiliated with or endorsed by Blizzard Entertainment or Nintendo.",
  "Melee's feel comes from public frame data: [SmashWiki](https://www.ssbwiki.com/) and [Smashboards](https://smashboards.com/).",
  "Built with Wisp, TypeScript, TypeScriptToLua, Effect, Bun and Lua 5.3.",
];

export function creditPlain(markdown: string): string {
  let plain = "";
  let rest = markdown;
  for (;;) {
    const open = rest.indexOf("[");
    const middle = open < 0 ? -1 : rest.indexOf("](", open);
    const close = middle < 0 ? -1 : rest.indexOf(")", middle);
    if (close < 0) return plain + rest;
    plain += rest.slice(0, open) + rest.slice(open + 1, middle);
    rest = rest.slice(close + 1);
  }
}

export const creditsVersionLine = (version: string): string => `Smashcraft ${version}`;

export function creditsBody(version: string): string {
  return [creditsVersionLine(version), ...CREDITS_MARKDOWN.map(line => creditPlain(line))].join("|n|n");
}

export const creditsSection = (): string => ["## Credits", ...CREDITS_MARKDOWN.map(line => `- ${line}`)].join("\n");
