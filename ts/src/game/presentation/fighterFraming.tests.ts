import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { createMatchCamera } from "../sim/matchCamera";
import { fighterFrame, fighterOffscreen } from "./fighterFraming";

const PITCH_SIN = 0.1736481785774231;

test("offscreen portraits require the whole fighter to leave the camera [k2 property]", () => {
  const camera = createMatchCamera();
  for (const character of Object.values(Character)) for (let sample = 0; sample < 8; sample++) {
    camera.distance = 498.0 + sample * 240.0;
    const aspect = sample < 4 ? 1.7777777910232544 : 2.370370388031006;
    const frame = fighterFrame(character);
    const z = camera.z - (frame.bottom + frame.top) / 2.0;
    const widest = (camera.distance - (z + frame.bottom - camera.z) * PITCH_SIN) * camera.tangent * aspect;
    const narrowest = (camera.distance - (z + frame.top - camera.z) * PITCH_SIN) * camera.tangent * aspect;
    for (const direction of [-1.0, 1.0]) {
      const edge = camera.x + direction * narrowest;
      assertEquals(fighterOffscreen(camera, aspect, character, edge, z), false, "partly visible body covered by portrait");
      const hidden = camera.x + direction * (widest + Math.max(-frame.left, frame.right) + 1.0);
      assertEquals(fighterOffscreen(camera, aspect, character, hidden, z), true, "hidden body missing portrait");
    }
  }
});
