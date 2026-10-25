export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char !== '"') cell += char;
      else if (text[index + 1] === '"') { cell += '"'; index++; }
      else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (char !== "\r") cell += char;
  }
  if (quoted) throw new Error("CSV ends inside a quoted cell");
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

export function csvNumber(text: string, where: string): number {
  const value = /^0x[0-9a-fA-F]+$/.test(text) ? Number.parseInt(text.slice(2), 16) : Number(text);
  if (text.trim() === "" || !Number.isFinite(value)) throw new Error(`${where}: expected a number, got "${text}"`);
  return value;
}

export function slashNumbers(text: string, where: string, suffix = ""): number[] {
  if (text === "" || text === "-") return [];
  const body = suffix !== "" && text.endsWith(suffix) ? text.slice(0, -suffix.length) : text;
  return body.split(" / ").map((part) => csvNumber(part, where));
}

export function columnIndex(header: readonly string[], name: string, file: string): number {
  const index = header.indexOf(name);
  if (index < 0) throw new Error(`${file}: missing column "${name}"`);
  if (header.indexOf(name, index + 1) >= 0) throw new Error(`${file}: column "${name}" appears twice`);
  return index;
}
