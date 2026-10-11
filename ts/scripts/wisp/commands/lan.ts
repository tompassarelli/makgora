import { type Command } from "wisp/scripts/wisp/command";
import { lan as frameworkLan } from "wisp/scripts/wisp/commands/lan";
import { lanSoak } from "./lanSoak";

export const lan: Command = (args) => args[0] === "soak" ? lanSoak(args.slice(1)) : frameworkLan(args);
