
import { SELECTABLE_CHARACTERS } from "../src/game/roster/kits";
import { fighterCoverage } from "../src/game/match/botCoverage";

const [shard = 0, shards = 1] = (process.env.CPU_COVERAGE_SHARD ?? "0/1").split("/").map(Number);
if (!Number.isInteger(shard) || !Number.isInteger(shards) || shards < 1 || shard < 0 || shard >= shards) throw new Error(`CPU_COVERAGE_SHARD is INDEX/COUNT with INDEX below COUNT, such as 0/2, not ${process.env.CPU_COVERAGE_SHARD}`);
const reports = SELECTABLE_CHARACTERS.flatMap((_character, index) => (index % shards === shard ? [fighterCoverage(index)] : []));
console.log("| Fighter | Matches | Moving frames | Attacks | Kit starts/branches | Specials N/S/U/D | Defense frames | Recovery inputs | Defense probe /16 | Recovery probe /2 | Missing |");
console.log("|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---|");
for (const r of reports) console.log(`| ${r.fighter} | ${r.matches} | ${r.movement} | ${r.attacks} | ${r.kit} | ${Object.values(r.specials).join("/")} | ${r.defense} | ${r.recovery} | ${r.defenseDecisions} | ${r.recoveryDecisions} | ${r.missing.join(", ") || "none"} |`);
const inactive = reports.filter(report => report.missing.length > 0);
console.log(`${reports.length} of ${SELECTABLE_CHARACTERS.length} selectable fighters, ${reports.reduce((sum, report) => sum + report.matches, 0)} seeded Wren Expert matches, ${inactive.length} inactive fighters`);
process.exitCode = inactive.length > 0 ? 1 : 0;
