const positives = ["neutral-special", "side-special", "up-special", "down-special", "ultimate"];
const negatives = ["chen-stormstout:neutral-special", "murloc:side-special", "murloc:up-special", "shadow-hunter:neutral-special", "mountain-king:down-special", "thrall:down-special", "cairne-bloodhoof:neutral-special", "lich:side-special", "lich:down-special"];
const samples = [
  ...positives.map(move => ({ move: `blademaster:${move}`, role: "positive", version: "main", source: "8ec2b33db2a52f22dd88157bc6e8abf96bf9c4377e6fcf06e43b4edde39ade0b", fixture: `positives-blademaster-${move}`, manifest: "evidence/main-positives.captures.json", runs: ["evidence/positives-1/captures.json", "evidence/positives-2/captures.json"] })),
  ...negatives.map(move => ({ move, role: "negative", version: "0.0.192+art-2026-10-26", source: "180d962", fixture: `negatives-${move.replace(":", "-")}`, manifest: "evidence/v192-negatives.captures.json", runs: ["evidence/negatives-1/captures.json", "evidence/negatives-2/captures.json"] })),
];
console.log(JSON.stringify({ excluded: [], regionMargin: 24, bodyMargin: 4, samples }, null, 1));
