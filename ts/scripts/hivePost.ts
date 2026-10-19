import { readFileSync } from "node:fs";
import { join } from "node:path";

const inline = (text: string): string => {
  const code: string[] = [];
  return text
    .replace(/`([^`]+)`/g, (_, span: string) => `\u0000${code.push(span) - 1}\u0000`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, url: string) => `[URL="${url}"]${label}[/URL]`)
    .replace(/\*\*([^*]+)\*\*/g, "[B]$1[/B]")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1[I]$2[/I]")
    .replace(/\u0000(\d+)\u0000/g, (_, index: string) => `[I]${code[Number(index)] ?? ""}[/I]`);
};

type List = "bullet" | "numbered" | undefined;

export const hiveBbcode = (markdown: string): string => {
  const out: string[] = [];
  let list: List;
  let centered = false;
  const closeList = () => {
    if (list !== undefined) out.push("[/LIST]");
    list = undefined;
  };
  const openList = (kind: Exclude<List, undefined>) => {
    if (list === kind) return;
    closeList();
    out.push(kind === "numbered" ? "[LIST=1]" : "[LIST]");
    list = kind;
  };
  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const bullet = /^[-*] (.*)$/.exec(line);
    const numbered = /^\d+\. (.*)$/.exec(line);
    if (bullet !== null) {
      openList("bullet");
      out.push(`[*]${inline(bullet[1] ?? "")}`);
      continue;
    }
    if (numbered !== null) {
      openList("numbered");
      out.push(`[*]${inline(numbered[1] ?? "")}`);
      continue;
    }
    closeList();
    const title = /^# (.*)$/.exec(line);
    const heading = /^## (.*)$/.exec(line);
    const subheading = /^### (.*)$/.exec(line);
    if (title !== null) {
      out.push(`[CENTER][SIZE=6][B]${inline(title[1] ?? "")}[/B][/SIZE]`);
      centered = true;
    } else if (centered && line.trim() === "") {
      out.push("", "[/CENTER]", "");
      centered = false;
    } else if (heading !== null) out.push(`[SIZE=5][B]${inline(heading[1] ?? "")}[/B][/SIZE]`);
    else if (subheading !== null) out.push(`[B]${inline(subheading[1] ?? "")}[/B]`);
    else out.push(inline(line));
  }
  closeList();
  if (centered) out.push("", "[/CENTER]");
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
};

if (import.meta.main) {
  const source = process.argv[2] ?? join(import.meta.dir, "../../docs/hive-post.md");
  process.stdout.write(hiveBbcode(readFileSync(source, "utf8")));
}
