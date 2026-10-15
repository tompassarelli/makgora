import { expect, test } from "bun:test";
import { Effect } from "effect";
import { autolandLands, prePush } from "../scripts/prePush";
import { FARM_TEST, readWorkflow, suiteGaps, type Workflow } from "../scripts/suiteParity";

const farm = readWorkflow(".github/workflows/farm-test.yml");
const autoland = readWorkflow(".github/workflows/autoland.yml");
const inlined = (dropped: readonly string[]): Workflow => ({
  ...autoland,
  env: { ...autoland.env, ...farm.env },
  jobs: Object.fromEntries([
    ...Object.entries(autoland.jobs).filter(([, job]) => job.uses !== FARM_TEST),
    ...Object.entries(farm.jobs).filter(([name]) => !dropped.includes(name)).map(([name, job]) => [`suite-${name}`, job]),
  ]),
});

test("Autoland's suite runs every farm-test job with the same inputs, and dropping any one job or narrowing the call is a gap [k2 property]", () => {
  expect(suiteGaps(farm, autoland)).toEqual([]);
  expect(suiteGaps(farm, inlined([]))).toEqual([]);
  for (const name of Object.keys(farm.jobs)) expect(suiteGaps(farm, inlined([name]))).toEqual([`Autoland's suite lacks farm-test job ${name}`]);
  const narrowed: Workflow = { ...autoland, jobs: Object.fromEntries(Object.entries(autoland.jobs).map(([name, job]) => [name, job.uses === FARM_TEST ? { ...job, with: { ...job.with, only: "bun" } } : job])) };
  expect(suiteGaps(farm, narrowed)).toEqual(Object.entries(autoland.jobs).filter(([, job]) => job.uses === FARM_TEST).map(([name]) => `Autoland's ${name} job passes farm-test.yml the undeclared input only`));
});

test("a main push Autoland lands waits for no farm run, and a direct main push still runs the farm gate [k5 boundary pre-push-farm-gate]", async () => {
  expect(autolandLands("autoland", ["ts/scripts/prePush.ts"])).toBe(true);
  expect(autolandLands("autoland", ["ts/scripts/prePush.ts", ".github/workflows/autoland.yml"])).toBe(false);
  expect(autolandLands("", ["ts/scripts/prePush.ts"])).toBe(false);
  const head = (await Bun.$`git rev-parse HEAD`.quiet().text()).trim();
  const gated = async (queue: string): Promise<string[]> => {
    const heads: string[] = [];
    await Effect.runPromise(prePush(`HEAD ${head} refs/heads/main ${head}\n`, { gate: (sha) => Effect.sync(() => void heads.push(sha)), queue: Effect.succeed(queue) }));
    return heads;
  };
  expect(await gated("autoland")).toEqual([]);
  expect(await gated("")).toEqual([head]);
});
