import { assertEquals } from "wisp/src/runtime/testing";
import { CPU_PROFILES } from "./cpuProfiles";
import { calibrationFailures, collectCalibrationRow } from "./cpuCalibration";
import { sweep } from "../core/sweep";


for (const profile of CPU_PROFILES) {
  sweep(`calibration ${profile.opponent}/${profile.tier}: 100 eligible decisions, zero early reactions/reversals/replay differences [k3 measure #186]`, () => {
    const row = collectCalibrationRow(profile);
    assertEquals(calibrationFailures(row).join("; "), "");
  });
}
