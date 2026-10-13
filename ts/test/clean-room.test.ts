import { expect, test } from "bun:test";
import { REACH_RULES, reachProblems } from "../scripts/cleanRoom";

const REFUSED: readonly [string, string][] = [
  ["a process-memory API or path", "const n = process_vm_readv(pid, local, remote);"],
  ["a process-memory API or path", "ptrace(PTRACE_ATTACH, pid)"],
  ["a process-memory API or path", "open(`/proc/${pid}/mem`)"],
  ["a process-memory API or path", "ReadProcessMemory(handle, address, buffer, size, 0)"],
  ["a process-memory API or path", "WriteProcessMemory(handle, address, patch, 4, 0)"],
  ["a process-memory API or path", "VirtualProtectEx(handle, page, 4096, 0x40, old)"],
  ["a process-memory API or path", "CreateRemoteThread(handle, 0, 0, start, 0, 0, 0)"],
  ["a game-binary address or offset", "- The table is a pointer at image RVA `0x2f80770`."],
  ["a game-binary address or offset", "its count at `+0x30`"],
  ["a game-binary address or offset", "crashed at instruction 0x00006FFFEE719798"],
  ["a game-binary address or offset", "const returnPatches = [0x80091dbc];"],
  ["a game-binary address or offset", "sideways rolls (800DF644/800DF678)"],
  ["a decompiled symbol name", "Shieldstun comes from ftCo_800DF1C8."],
  ["a decompiled symbol name", "that frame drifts by ftCommon_CalcSelfAccel_AccelToVelClampedFrom"],
  ["a Melee game-file name", "the push-off read from PlCo.dat"],
  ["a Melee game-file name", "values read from the GALE01 revision 2 disc"],
  ["an import of wisp-private code", "import { switchToLan } from \"~/.local/share/wisp-private/lan/switch\";"],
  ["an import of wisp-private code", "const lan = await import(\"/home/tom/.local/share/wisp-private/lan/index.ts\");"],
];

const KEPT = [
  "const rss = /^VmRSS:\\s+(\\d+)\\s+kB$/m.exec(readFileSync(`/proc/${pid}/status`, \"utf8\"));",
  "readFileSync(`/proc/${child}/cmdline`, \"utf8\")",
  "const SIGN = 0x80000000;",
  "const colour = 0xff336699;",
  "Private test tools live under ~/.local/share/wisp-private/ and never feed the implementation.",
  "We never read the game's memory or disassemble it.",
  "A ft_8 hit and FT_80 tables are ours.",
  "let hash = 0x811c9dc5;",
  "unstable_NormalPriority and stableSort_Items are library names.",
  "The 80000000 sentinel and 80123456 decimal counts are fine.",
];

test("the clean-room reach check refuses each fixture by its own rule and keeps own-process /proc reads, flags and prose [k2 property]", () => {
  expect(new Set(REFUSED.map(([name]) => name))).toEqual(new Set(REACH_RULES.map(({ name }) => name)));
  for (const [name, text] of REFUSED) {
    expect(reachProblems([{ path: "src/x.ts", line: 7, text }])).toEqual([expect.stringContaining(`src/x.ts:7 has ${name}.`)]);
    expect(reachProblems([{ path: "ts/scripts/cleanRoom.ts", line: 7, text }])).toEqual([]);
  }
  expect(reachProblems(KEPT.map((text, line) => ({ path: "docs/x.md", line, text })))).toEqual([]);
});
