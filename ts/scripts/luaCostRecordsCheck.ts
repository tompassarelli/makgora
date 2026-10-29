import { relative, resolve } from "node:path";
import { LUA_COST_RECORDS, staleLuaShards } from "./testCost";

const stale = staleLuaShards(LUA_COST_RECORDS, resolve(import.meta.dir, ".."));
for (const path of stale) console.error(`${relative(resolve(import.meta.dir, "../.."), path)}: its test file is gone or its rows name another file; delete or move the shard with the test`);
if (stale.length > 0) process.exit(1);
