import { type Command } from "wisp/scripts/wisp/command";
import { lan as frameworkLan } from "wisp/scripts/wisp/commands/lan";
import { lanSoak } from "./lanSoak";
import { poolStart, poolStop } from "./lanPoolUnit";

export const lan: Command = (args) => {
  switch (args[0]) {
    case "soak": return lanSoak(args.slice(1));
    case "pool": return poolStart(args.slice(1));
    case "stop": return poolStop(args.slice(1));
    default: return frameworkLan(args);
  }
};
