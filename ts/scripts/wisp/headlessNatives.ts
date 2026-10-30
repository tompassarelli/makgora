import type { IntentionalNoops } from "wisp/src/headless/client";

declare const SetCameraPosition: (x: number, y: number) => void;


export const SMASHCRAFT_NOOPS: IntentionalNoops = {
  SetGameSpeed: "headless frames advance one per simulated callback; there is no game clock to slow",
  SetMapFlag: "the only flag the map sets locks the game speed, which headless clients do not model",
  GetPlayableMapRect: "stage initialization only uses this rectangle to obtain the declared zero-centered map origin",
  GetGameSpeed: "only the local session-rates log reads the game speed; headless clients have no lobby speed setting",
  GetRectCenter: "stage initialization uses the declared zero-centered map origin supplied by location getters",
  RemoveLocation: "the temporary stage-center location holds no state after initialization",
  BlzHideOriginFrames: "the headless UI contains only map-created frames; Warcraft's origin UI is not rendered",
  BlzEnableCursor: "headless clients have no operating-system cursor; the painted hand frame is captured instead",
  BlzSetMousePos: "headless clients have no operating-system pointer; the focused Start Match label is captured instead",
  BlzEnableSelections: "the journey drives the map's scripted fighter controls and never Warcraft selection",
  EnableUserControl: "the journey drives scripted input without an operating-system window",
  SetPlayerColor: "the map gives each participant player its own slot's colour, so an effect's recorded player is its colour",
  FogEnable: "visibility is decided by the map's stage and effect state; terrain fog of war is not simulated",
  FogMaskEnable: "visibility is decided by the map's stage and effect state; terrain fog mask is not simulated",
  BlzSetSpecialEffectAnimationBlendTime: "quick-match records selected clips and times without Warcraft animation blending",
  GetSoundFileDuration: "cue presence and start frames are inspected; audio decoding and duration are not simulated",
  SetSoundDistances: "item cue starts and world positions are inspected; engine audio attenuation is not simulated",
  SetSoundDistanceCutoff: "item cue starts and world positions are inspected; engine audio attenuation is not simulated",
  SetSoundDuration: "cue presence and start frames are inspected; audio completion is not simulated",
  SetSkyModel: "the sky is scenery outside quick-match's gameplay and scene assertions",
  SetDayNightModels: "quick-match uses map scene state without Warcraft's day-night lighting",
  SetTerrainFogEx: "quick-match does not assert engine terrain fog appearance",
  BlzSetMinShadowCastingPointLightCount: "quick-match does not assert engine point-light shadows",
  CameraSetSmoothingFactor: "headless captures the camera target directly without engine interpolation",
  SetTimeOfDay: "the map's deterministic frame clock drives gameplay; engine lighting time is unused",
  SetTimeOfDayScale: "the map's deterministic frame clock drives gameplay; engine lighting time is unused",
  BlzSetUnitName: "fighter labels come from map frames; engine unit hover names are not inspected",
  SetUnitBlendTime: "quick-match records body clips without Warcraft animation blending",
  BlzSetUnitRealField: "this map only sets engine selection scale; scripted fighter hit regions do not use it",
  SetUnitInvulnerable: "the map's fighting simulation owns damage; Warcraft unit damage is not used",
  SetUnitPathing: "the map's fighting simulation owns motion and collision; Warcraft pathing is not used",
  UnitAddAbility: "Crow Form and Locust only configure engine fighter-body presentation; combat is scripted",
  UnitRemoveAbility: "removing Crow Form only configures engine fighter-body presentation; combat is scripted",
  PauseUnit: "the map moves and animates paused fighter bodies through native setters; unit AI is not used",
  SetCameraBounds: "scripted camera positions define headless captures; engine scrolling bounds are unused",
  TriggerRegisterPlayerEvent: "quick-match has fixed connected clients and no player-leave event",
  EndThematicMusic: "quick-match inspects explicit sound cues; background music playback is not simulated",
  StopMusic: "quick-match inspects explicit sound cues; background music playback is not simulated",
  ClearMapMusic: "quick-match inspects explicit sound cues; background music playlists are not simulated",
  PlayMusic: "quick-match inspects explicit sound cues; background music playback is not simulated",
  VolumeGroupSetVolume: "silencing the results burst's model sound is local mixing; headless checks do not mix audio",
  VolumeGroupReset: "restoring mixer volumes at match start is local mixing; headless checks do not mix audio",
  SetCineFilterTexture: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  SetCineFilterBlendMode: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  SetCineFilterTexMapFlags: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  SetCineFilterStartUV: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  SetCineFilterEndUV: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  SetCineFilterStartColor: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  SetCineFilterEndColor: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  SetCineFilterDuration: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  DisplayCineFilter: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  CreateQuest: "the F9 help entries are Warcraft's quest log; tests read their logged titles and descriptions",
  QuestSetIconPath: "the F9 help entry icons are Warcraft quest-log art that headless checks do not render",
  QuestSetRequired: "the F9 help entries only sort into the quest log's two columns, which headless checks do not render",
  QuestSetDiscovered: "the F9 help entries are always shown in Warcraft's quest log, which headless checks do not render",
  QuestSetCompleted: "the F9 help entries are never completed; the quest log is not rendered headless",
};

export interface QuestEntry {
  title: string;
  description: string;
}

const questLogs = new WeakMap<object, Map<unknown, QuestEntry>>();

export function questLog(client: object): readonly QuestEntry[] {
  return [...(questLogs.get(client)?.values() ?? [])];
}

function questEntry(client: unknown, entry: unknown): QuestEntry | undefined {
  if (typeof client !== "object" || client === null) return undefined;
  const log = questLogs.get(client) ?? new Map<unknown, QuestEntry>();
  questLogs.set(client, log);
  const found = log.get(entry) ?? { title: "", description: "" };
  log.set(entry, found);
  return found;
}

export const smashcraftNativeBehavior = (client?: unknown) => ({
  QuestSetTitle: (entry: unknown, title: string) => { const found = questEntry(client, entry); if (found !== undefined) found.title = title; },
  QuestSetDescription: (entry: unknown, description: string) => { const found = questEntry(client, entry); if (found !== undefined) found.description = description; },
  PanCameraToTimed: (x: number, y: number) => SetCameraPosition(x, y),
  BlzConvertColor: (a: number, r: number, g: number, b: number) => {
    const argb = ((a * 256 + r) * 256 + g) * 256 + b;
    return argb >= 2147483648 ? argb - 4294967296 : argb;
  },

  GetLocationX: () => 0,
  GetLocationY: () => 0,
  GetLocationZ: () => 0,
});
