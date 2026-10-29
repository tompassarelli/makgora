import { GITHUB_PAGE, communityUrl } from "./community";

export const CREDITS_TITLE = "Credits";

export const CREDITS_MARKDOWN: readonly string[] = [
  "Design & Programming: Tom Passarelli (Tompas)",
  "Animation & Stages: Tom Passarelli (Tompas)",
  "Music: Tom Passarelli (with Google Lyria)",
  "Lich King model: [Kwaliti](https://www.hiveworkshop.com/members/kwaliti.136001/), from [Hive Workshop](https://www.hiveworkshop.com/threads/the-lich-king.154837/), used with credit as the author permits ([Kwaliti's usage statement](https://www.hiveworkshop.com/profile-posts/951524/))",
  "Thrall model: [Warchief Thrall Dismounted](https://www.hiveworkshop.com/threads/warchief-thrall-dismounted-re-classic.332006/) by johnwar, from Hive Workshop, built on Ujimasa Hojo's Grom Hellscream; every move reanimated for Smashcraft",
  "Tyrande model: [Tyrande Whisperwind (Re-Classic)](https://www.hiveworkshop.com/threads/tyrande-whisperwind-re-classic-pack.348819/) by johnwar, from Hive Workshop, built on Ujimasa Hojo's Archer, Dark Ranger and Sylvanas models and kangyun's Tyrande, used with kangyun's permission; every move reanimated for Smashcraft",
  "Naxxramas wall model: [Undead Walls Pack](https://www.hiveworkshop.com/threads/undead-walls-pack.369286/) by Kuzakani, from Hive Workshop, used with credit",
  "Cursors, wordmark & stage-select art: Smashcraft originals (the pinching-hand cursor made with AI assistance)",
  "Murloc sound: World of Warcraft, Blizzard Entertainment",
  `Source: [GitHub - tompassarelli/smashcraft](${communityUrl(GITHUB_PAGE)}) (MIT License), written in TypeScript and compiled to Warcraft III's Lua.`,
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
