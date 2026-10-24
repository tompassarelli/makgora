import type { MapBuild } from "../../game/session/build";
import { PLAYABLE_BUILD } from "../../game/session/currentBuild";
import { install as installGame, startBuild } from "../../platform/main";
import { armVoiceCheck } from "../../platform/voiceCheck";

const VOICE_CHECK_BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "voice-check" };

export function install(this: void): void {
  installGame(VOICE_CHECK_BUILD);
}

export function start(this: void): void {
  armVoiceCheck();
  startBuild(VOICE_CHECK_BUILD);
}
