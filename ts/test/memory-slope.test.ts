import { expect, test } from "bun:test";
import { checkMemory, checkNativeSequenceHeap, parseMemoryRun } from "../scripts/wisp/memorySoak";

test("the native sequence's 32-bit Lua companion requires post-minute-10 heap growth below the headless 1 MB per 10 minutes [k3 measure #409]", () => {
  for (const perTenMinutes of [-1024, 0, 512, 1024, 2048]) {
    const text = [0, 10, 40, 70, 100].map((minute) => `sample kind=minute minute=${minute} frame=${minute * 3600} heap-kb=${9000 + perTenMinutes * (minute - 10) / 10}`).join("\n") + "\ndone frames=360000 matches=20 problems=0";
    const verdict = checkNativeSequenceHeap(parseMemoryRun(text));
    expect(verdict.failures.length === 0).toBe(perTenMinutes < 1024);
  }
  expect(checkNativeSequenceHeap(parseMemoryRun("sample kind=minute minute=10 frame=36000 heap-kb=9000\ndone frames=36000 matches=1 problems=0")).failures.length).toBe(2);
});

const LEAKING_RUN_38710536673 = "2197:240724 5769:241504 8412:241478 9453:241557 12296:241866 15351:241913 18316:242168 20292:242043 24223:242567 27526:242700 29391:242518 31983:242482 32884:242536 34604:242847 36592:242670 39263:242723 41437:242688 44514:242619 46357:242653 47985:242658 49845:242791 51824:242598 54063:242778 55216:242636 59224:242570 63056:242773 65391:242803 68940:242538 71904:242593 75973:243222 78665:242982 79762:243023 81408:243038 83452:243298 85459:243444 87078:243324 90751:243183 92886:243237 94537:243250 96123:243200 96884:243059 99616:243126 101341:243324 103491:243167 107561:243270 109305:243349";
const FLAT_RUN_38809026255 = "1603:244638 3619:244815 5444:244747 7346:244966 9280:244971 12319:244925 14994:245236 17613:245022 21700:245015 24616:245224 26600:244890 28444:244931 30587:245005 33558:245336 35338:245172 37300:245150 40398:245009 44482:245137 48436:245169 51061:245142 52961:245004 54744:244776 55992:245052 57776:245122 60883:244959 62787:245130 65523:245190 68058:245104 71959:245239 75564:245281 78659:244944 80623:244806 82624:244923 84726:245264 87685:245284 91555:245328 94180:245161 96767:245097 98277:244968 100200:245201 102333:244992 105901:245108 107243:245077 109889:245099";

const recordedRun = (series: string) => parseMemoryRun(series.split(" ").map((pair, index) => {
  const [frame, heap] = pair.split(":");
  return `sample kind=match match=${index + 1} frame=${frame} heap-kb=${heap}`;
}).join("\n") + "\ndone frames=110000 matches=46 problems=0");

const perMatchGrowth = (series: string) => checkMemory(recordedRun(series)).failures.find((failure) => failure.startsWith("Lua heap grows") && failure.includes("per match"));

test("the per-match heap rule still fails the recorded bot-habit leak and passes the recorded flat heap, printing slope, error and n [k3 measure #168]", () => {
  expect(perMatchGrowth(LEAKING_RUN_38710536673)).toBe("Lua heap grows 25.84 ± 3.14 KB per match after warm-up (n=32)");
  expect(perMatchGrowth(FLAT_RUN_38809026255)).toBeUndefined();
  expect(checkMemory(recordedRun(FLAT_RUN_38809026255)).lines.some((line) => line.includes("slope 1.57 ± 3.05 KB per match over n=29 matches"))).toBe(true);
});
