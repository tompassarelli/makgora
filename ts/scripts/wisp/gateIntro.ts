import { Effect } from "effect";
import { AcceptFailure } from "wisp/scripts/wisp/accept";
import type { Frame } from "wisp/scripts/wisp/frameProbe";
import { capture, click, type Client, frameWords, type Region } from "wisp/scripts/warcraft/desktop";
import { PICKER_DONE } from "../../src/game/ui/settingsUi";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });

const INTRO_STEPS = 4;
const LABEL_SCALE = 2;
const CONTROLS_SCREEN = /^(recommended|smash)$/i;

export interface ScreenWord {
  readonly text: string;
  readonly y: number;
}

const promptWords = (words: readonly ScreenWord[], height: number) => words.filter(({ y }) => y <= height * 0.12).map(({ text }) => text.toLowerCase());

export const startPromptReady = (words: readonly ScreenWord[], height: number): boolean => {
  const prompt = promptWords(words, height);
  return prompt.includes("start") && prompt.includes("click");
};

export const controlsShowing = (words: readonly ScreenWord[]): boolean =>
  words.some(({ text }, index) => CONTROLS_SCREEN.test(text) || (/^press$/i.test(text) && /^done\b/i.test(words[index + 1]?.text ?? "")));

export const tutorialPromptShowing = (words: readonly ScreenWord[]): boolean => words.some(({ text }) => text === "Not");

export const fighterSelectShowing = (words: readonly ScreenWord[]): boolean => !controlsShowing(words) && !tutorialPromptShowing(words);

export const enlarge = ({ width, height, rgb }: Frame): Frame => {
  const out = new Uint8Array(width * height * 3 * LABEL_SCALE * LABEL_SCALE);
  for (let y = 0; y < height * LABEL_SCALE; y++) {
    for (let x = 0; x < width * LABEL_SCALE; x++) {
      const from = ((y / LABEL_SCALE | 0) * width + (x / LABEL_SCALE | 0)) * 3;
      out.set(rgb.subarray(from, from + 3), (y * width * LABEL_SCALE + x) * 3);
    }
  }
  return { width: width * LABEL_SCALE, height: height * LABEL_SCALE, rgb: out };
};

const scaledWords = (client: Client, frame: Frame, scale: number) => Effect.all([frameWords(client, frame, "light"), frameWords(client, frame, "gold")]).pipe(
  Effect.map(inks => inks.flat().map(word => ({ ...word, x: Math.round(word.x / scale), y: Math.round(word.y / scale) }))),
);

export const screenWords = (client: Client, frame: Frame) =>
  Effect.all([scaledWords(client, frame, 1), scaledWords(client, enlarge(frame), LABEL_SCALE)]).pipe(Effect.map(scales => scales.flat()));

export const viewportPoint = (region: Region, x: number, y: number) => ({ x: region.x + Math.round((region.width - region.height * 4 / 3) / 2 + x * region.height / 0.6), y: region.y + Math.round(region.height - y * region.height / 0.6) });

export const reachFighterSelect = (client: Client, region: Region) => Effect.gen(function*() {
  const done = viewportPoint(region, PICKER_DONE.x + PICKER_DONE.width / 2, PICKER_DONE.y - PICKER_DONE.height / 2);
  for (let step = 0; step <= INTRO_STEPS; step++) {
    const frame = yield* capture(client, region).pipe(Effect.mapError(fail("fighter select capture")));
    const words = yield* screenWords(client, frame).pipe(Effect.mapError(fail("fighter select intro")));
    if (fighterSelectShowing(words)) return;
    if (step === INTRO_STEPS) return yield* new AcceptFailure({ operation: "fighter select intro", problem: `${client.name} shows ${controlsShowing(words) ? "its Controls screen" : "its Tutorial prompt"} after ${INTRO_STEPS} dismissals` });
    const notNow = words.find(word => word.text === "Not");
    const target = controlsShowing(words) ? done : notNow === undefined ? undefined : { x: region.x + notNow.x, y: region.y + notNow.y };
    if (target !== undefined) yield* click(client, target.x, target.y).pipe(Effect.mapError(fail("fighter select intro")));
    yield* Effect.sleep("500 millis");
  }
});
