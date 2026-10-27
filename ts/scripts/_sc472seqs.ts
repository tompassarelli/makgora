import { parseModelMDX } from "./mdxCodec";
const m = parseModelMDX(await Bun.file(process.argv[2]!).arrayBuffer());
m.Sequences.forEach((s, i) => console.log(i, s.Name, s.Interval[0], s.Interval[1]));
