export const devCommandsOf = (text: string | undefined): readonly string[] =>
  (text ?? "").split(";").map(command => command.trim()).filter(command => command !== "");

export function devQuery(query: URLSearchParams, commands: readonly string[]): void {
  if (commands.length > 0) query.set("dev", commands.join(";"));
}
