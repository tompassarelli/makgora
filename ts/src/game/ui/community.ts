export const COMMUNITY_TITLE = "Community";

export const GITHUB_PAGE = "github.com/tompassarelli/smashcraft";
export const DISCORD_INVITE = "discord.gg/JQGZs2UJR";

export const communityUrl = (page: string): string => `https://${page}`;

export const COMMUNITY_PURPOSE = "This is where to find games, report bugs and contribute.";

export const communityBody = (): string => [`GitHub: ${GITHUB_PAGE}`, `Discord: ${DISCORD_INVITE}`, COMMUNITY_PURPOSE].join("|n|n");

export const discordInviteLine = (): string => `Join the [Discord](${communityUrl(DISCORD_INVITE)}) if you'd like to play games sometime and/or contribute.`;
