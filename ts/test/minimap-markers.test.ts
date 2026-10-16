import { expect, test } from "bun:test";
import { decodeMinimapMarkers } from "wisp/scripts/wisp/mapPreview";
import { NO_MINIMAP_MARKERS } from "../scripts/mapPreview";

test("the lobby minimap carries no start-location markers over the preview art [k2 property]", () => {
  expect(decodeMinimapMarkers(NO_MINIMAP_MARKERS)).toEqual([]);
});
