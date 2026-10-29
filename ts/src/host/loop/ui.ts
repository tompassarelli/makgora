

import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots, isParticipantSlot } from "../../game/input/participants";
import { CombatEffects } from "../../game/render/combatEffects";
import { CriticalStrikeText } from "../../game/render/criticalStrikeText";
import { FighterPoolPresentation } from "../../game/render/fighterPool";
import { costumeFor } from "../../game/lobby/lobbyState";
import { AgencyMarker } from "../../game/render/agencyMarker";
import { FighterAgencyForecast } from "../../game/presentation/fighterAgency";
import { FrostEffects } from "../../game/render/frostEffects";
import { ElementEffects } from "../../game/render/elementEffects";
import { SpecialCueEffects } from "../../game/render/specialCueEffects";
import { MeterCueEffects } from "../../game/render/meterCueEffects";
import { PlacedObjectEffects } from "../../game/render/placedObjectEffects";
import { MatchPresentation } from "../../game/render/matchPresentation";
import { modelSoundPresentation } from "../../game/render/modelSoundPresentation";
import type { ModelSoundSink } from "../../game/render/modelSounds";
import { ProjectilePresentation } from "../../game/render/projectilePresentation";
import { ShieldPresentation } from "../../game/render/shieldPresentation";
import { SpecialEffects } from "../../game/render/specialEffects";
import { Character } from "../../game/sim/codes";
import { fighterAt, isActive } from "../../game/sim/roster";
import type { MenuControls } from "../../game/ui/frames";
import { sourceVersion } from "../../game/shell/sourceVersion";
import { FighterHud, MatchClock } from "../../game/ui/matchHud";
import { TrainingReadout } from "../../game/ui/trainingReadout";
import { ChatPanel } from "wisp/src/ui/chatPanel";
import { CHAT_STYLE } from "../../game/ui/nativeChat";
import { HitAreaPresentation } from "../../game/render/hitAreaPresentation";
import { TerrorPresentation } from "../../game/render/terrorPresentation";
import { EscapeMeter } from "../../game/ui/escapeMeter";
import { OffscreenBubble } from "../../game/ui/offscreenBubble";
import { FighterMarker } from "../../game/ui/fighterMarker";
import { MeterBar } from "../../game/ui/meterBar";
import { meterPlacement } from "../../game/ui/plateLayout";
import { ButtonClicks, gameUi } from "../../game/ui/frames";
import { ResultsBanner } from "../../game/ui/resultsBanner";
import type { SelectionActions } from "../../game/ui/selectionActions";
import { SelectionPanel } from "../../game/ui/selectionUi";
import { type SettingsActions, SettingsPanel } from "../../game/ui/settingsUi";
import { type StageActions, StagePanel } from "../../game/ui/stageUi";
import type { ShellState } from "./state";
import { bindPrototype } from "../../platform/rebind";
import { ItemPresentation } from "../../game/render/itemPresentation";
import { AuraPresentation } from "../../game/render/auraPresentation";
import { OrbPresentation } from "../../game/render/orbPresentation";
import { ParasolPresentation } from "../../game/render/parasolPresentation";
import { HookChainPresentation } from "../../game/render/hookChainPresentation";
import { GoldSackPresentation } from "../../game/render/goldSackPresentation";
import { ShurikenGlowPresentation } from "../../game/render/shurikenGlowPresentation";
import { SpherePresentation } from "../../game/render/spherePresentation";
import { FlightPresentation } from "../../game/render/flightPresentation";
import { fighterOrbit } from "../../game/presentation/sphereOrbit";
import { fighterFlight } from "../../game/presentation/flightLook";
import { BodyFlash } from "../../game/render/bodyFlash";
import { MeterGlow } from "../../game/render/meterGlow";
import { type FighterDraw, createFighterDraw } from "../../game/presentation/fighterDraw";
import { ClassicPresentation } from "../../game/render/classicPresentation";
import { PauseMenu } from "../../game/ui/pauseMenu";


interface FighterRenderers {
  readonly character: Character;
  readonly shield: ShieldPresentation;
  readonly projectiles: ProjectilePresentation;

  readonly cues?: SpecialCueEffects | undefined;
  readonly meter?: MeterCueEffects | undefined;
  readonly pool: FighterPoolPresentation | undefined;
  readonly agency: AgencyMarker;
  readonly flash: BodyFlash;
  readonly glow: MeterGlow;
  readonly draw: FighterDraw;
  readonly goldSack: GoldSackPresentation | undefined;
  readonly shurikenGlow: ShurikenGlowPresentation | undefined;
  readonly parasol: ParasolPresentation | undefined;
  readonly hookChain: HookChainPresentation | undefined;
  readonly spheres: SpherePresentation | undefined;
  readonly flight: FlightPresentation | undefined;

  readonly hitAreas: HitAreaPresentation | undefined;
  readonly terror: TerrorPresentation;
}

export interface UiObjects {
  pause: PauseMenu;
  items: ItemPresentation;
  auras: AuraPresentation;
  orbs: OrbPresentation;
  readonly clock: MatchClock;
  readonly training: TrainingReadout;
  readonly huds: Slots<FighterHud>;
  readonly bubbles: Slots<OffscreenBubble>;
  markers: Slots<FighterMarker>;
  readonly escapeMeters: Slots<EscapeMeter>;

  meterBars: Slots<MeterBars>;
  readonly selections: Slots<SelectionPanel>;
  readonly settings: Slots<SettingsPanel>;
  readonly stage: StagePanel;
  readonly combat: CombatEffects;
  readonly criticals: CriticalStrikeText;
  readonly frost: FrostEffects;
  readonly placed: PlacedObjectEffects;
  readonly special: SpecialEffects;
  readonly fighters: Slots<FighterRenderers | undefined>;
  sounds: ModelSoundSink;

  match: MatchPresentation;
  results: ResultsBanner;
  chat: ChatPanel;

  elements: ElementEffects;

  classic?: ClassicPresentation;
}


export interface PanelActions {
  readonly selection: SelectionActions;
  readonly stage: StageActions;
  readonly settings: SettingsActions;
}

export function views(s: Readonly<ShellState>): UiObjects {
  const { ui } = s;
  if (ui === undefined) throw new Error("shell UI used before it was created");
  return ui;
}

const each = <T>(create: (slot: ParticipantSlot) => T): Slots<T> => [create(0), create(1), create(2), create(3)];

export interface MeterBars {
  readonly hud: MeterBar;
}

const createMeterBars = (slot: ParticipantSlot): MeterBars => ({
  hud: new MeterBar("Hud", slot, gameUi(), 1300 + slot * 20),
});

function menuControls(s: Readonly<ShellState>): MenuControls {
  return s.build.input.kind === "journal" && s.build.input.ingress === "editbox" ? "journal" : "keyboard";
}

// Create shared panels, HUD plates and effect pools in the same order on every client.
export function createUi(s: ShellState, actions: PanelActions, selectPause: (choice: number, clicker: player) => void): UiObjects {
  const controls = menuControls(s);
  let combat: CombatEffects;
  const results = new ResultsBanner();
  const ui: UiObjects = {
    results,
    chat: new ChatPanel(CHAT_STYLE),
    pause: new PauseMenu(selectPause),
    items: new ItemPresentation(s.origin),
    auras: new AuraPresentation(s.origin),
    orbs: new OrbPresentation(s.origin),
    clock: new MatchClock(),
    training: new TrainingReadout(),
    huds: each(slot => new FighterHud(slot, 4)),
    bubbles: each(slot => new OffscreenBubble(slot)),
    markers: each(slot => new FighterMarker(slot)),
    escapeMeters: each(slot => new EscapeMeter(slot)),
    meterBars: each(createMeterBars),
    stage: new StagePanel(actions.stage, controls),
    selections: each(slot => new SelectionPanel(actions.selection, slot, controls, sourceVersion())),
    settings: each(slot => new SettingsPanel(s.participants[slot].bindings, actions.settings, slot)),
    combat: combat = new CombatEffects(s.origin),
    criticals: new CriticalStrikeText(s.origin),
    frost: new FrostEffects(s.origin),
    placed: new PlacedObjectEffects(s.origin),
    special: new SpecialEffects(s.origin),
    fighters: [undefined, undefined, undefined, undefined],
    sounds: modelSoundPresentation(s.origin, combat.sounds),
    match: new MatchPresentation(s.origin, results),
    elements: new ElementEffects(s.origin),
    classic: new ClassicPresentation(s.origin),
  };
  combat.costumeOf = (slot) => (isParticipantSlot(slot) ? costumeFor(s.game, slot) : 0);
  s.ui = ui;
  return ui;
}

function endFighterRenderers(renderers: FighterRenderers | undefined): void {
  renderers?.shield.destroy();
  renderers?.projectiles.destroy();
  renderers?.cues?.destroy();
  renderers?.meter?.destroy();
  renderers?.pool?.destroy();
  renderers?.agency.destroy();
  renderers?.flash.destroy();
  renderers?.glow.destroy();
  renderers?.goldSack?.destroy();
  renderers?.shurikenGlow?.destroy();
  renderers?.parasol?.destroy();
  renderers?.hookChain?.destroy();
  renderers?.spheres?.destroy();
  renderers?.flight?.destroy();
  renderers?.hitAreas?.destroy();
  renderers?.terror.destroy();
}





function sharedPlay(): boolean {
  let humans = 0;
  for (const slot of PARTICIPANT_SLOTS) {
    const player = Player(slot);
    if (GetPlayerController(player) === MAP_CONTROL_USER && GetPlayerSlotState(player) === PLAYER_SLOT_STATE_PLAYING) humans++;
  }
  return humans > 1;
}

function opponentCharacters(s: ShellState, slot: ParticipantSlot): Character[] {
  const characters: Character[] = [];
  for (const other of PARTICIPANT_SLOTS) if (other !== slot && isActive(s.world, other)) characters.push(fighterAt(s.world, other).character);
  return characters;
}

export function beginFighterRenderers(s: ShellState, slot: ParticipantSlot, character: Character, pooled: boolean): boolean {
  const ui = views(s);
  endFighterRenderers(ui.fighters[slot]);
  const pool = pooled ? new FighterPoolPresentation(character, slot, s.origin, costumeFor(s.game, slot)) : undefined;
  ui.placed.prepareFighter(slot, character);
  const shared = sharedPlay();
  const orbit = fighterOrbit(character), flight = fighterFlight(character);
  ui.fighters[slot] = { character, shield: new ShieldPresentation(slot, s.origin), projectiles: new ProjectilePresentation(character, s.origin, opponentCharacters(s, slot)), cues: new SpecialCueEffects(character, s.origin, shared), meter: new MeterCueEffects(character, s.origin, shared), pool, agency: new AgencyMarker(s.origin), flash: new BodyFlash(character, s.origin), glow: new MeterGlow(character, s.origin), draw: createFighterDraw(),
    goldSack: character === Character.peon ? new GoldSackPresentation(s.origin) : undefined,
    shurikenGlow: character === Character.akama ? new ShurikenGlowPresentation(s.origin) : undefined,
    parasol: character === Character.chen ? new ParasolPresentation(s.origin) : undefined,
    hookChain: character === Character.butcher ? new HookChainPresentation(s.origin) : undefined,
    spheres: orbit === undefined ? undefined : new SpherePresentation(orbit, s.origin),
    flight: flight === undefined ? undefined : new FlightPresentation(flight, s.origin),
    hitAreas: s.game.training && s.game.trainer.showHitAreas ? new HitAreaPresentation(s.origin) : undefined,
    terror: new TerrorPresentation(s.origin),
  };
  return pool?.admitted() === true;
}

export function endFighter(s: ShellState, slot: ParticipantSlot): void {
  const ui = views(s);
  endFighterRenderers(ui.fighters[slot]);
  ui.fighters[slot] = undefined;
}


export function layoutHuds(s: ShellState): void {
  const ui = views(s);
  const active = PARTICIPANT_SLOTS.filter(slot => isActive(s.world, slot));
  active.forEach((slot, position) => {
    ui.huds[slot].layout(position, active.length);
    ui.meterBars[slot].hud.place(meterPlacement(position, active.length));
  });
}


export function recreateUi(s: ShellState, actions: PanelActions, selectPause: (choice: number, clicker: player) => void): void {
  const ui = s.ui;
  if (ui === undefined) return;
  if (ui.pause === undefined) ui.pause = new PauseMenu(selectPause);
  else {
    bindPrototype(ui.pause, PauseMenu.prototype);
    ui.pause.bindActions(selectPause);
  }
  const retainedItems: { readonly items?: ItemPresentation } = ui;
  if (retainedItems.items === undefined) ui.items = new ItemPresentation(s.origin);
  else bindPrototype(ui.items, ItemPresentation.prototype);
  const retainedAuras: { readonly auras?: AuraPresentation } = ui;
  if (retainedAuras.auras === undefined) ui.auras = new AuraPresentation(s.origin);
  else bindPrototype(ui.auras, AuraPresentation.prototype);
  const retainedOrbs: { readonly orbs?: OrbPresentation } = ui;
  if (retainedOrbs.orbs === undefined) ui.orbs = new OrbPresentation(s.origin);
  else bindPrototype(ui.orbs, OrbPresentation.prototype);
  const retainedMarkers: { readonly markers?: Slots<FighterMarker> } = ui;
  if (retainedMarkers.markers === undefined) ui.markers = each(slot => new FighterMarker(slot));
  else for (const slot of PARTICIPANT_SLOTS) bindPrototype(ui.markers[slot], FighterMarker.prototype);
  bindPrototype(ui.clock, MatchClock.prototype);
  bindPrototype(ui.training, TrainingReadout.prototype);
  const retainedChat: { readonly chat?: ChatPanel } = ui;
  if (retainedChat.chat === undefined) ui.chat = new ChatPanel(CHAT_STYLE);
  else bindPrototype(ui.chat, ChatPanel.prototype);
  for (const slot of PARTICIPANT_SLOTS) {
    bindPrototype(ui.huds[slot], FighterHud.prototype);
    bindPrototype(ui.bubbles[slot], OffscreenBubble.prototype);
    bindPrototype(ui.escapeMeters[slot], EscapeMeter.prototype);
    bindPrototype(ui.selections[slot], SelectionPanel.prototype);
    if (!ui.selections[slot].hasCpuSettingsFrames()) {
      ui.selections[slot].destroy();
      ui.selections[slot] = new SelectionPanel(actions.selection, slot, menuControls(s), sourceVersion());
    } else ui.selections[slot].bindActions(actions.selection);
    bindPrototype(ui.settings[slot], SettingsPanel.prototype);
    const retainedSettings: { readonly root?: framehandle } = ui.settings[slot];
    if (retainedSettings.root === undefined) ui.settings[slot] = new SettingsPanel(s.participants[slot].bindings, actions.settings, slot);
    else ui.settings[slot].bindActions(actions.settings);
  }
  bindPrototype(ui.stage, StagePanel.prototype);
  ui.stage.bindActions(actions.stage);
  bindPrototype(ui.combat, CombatEffects.prototype);
  bindPrototype(ui.frost, FrostEffects.prototype);
  bindPrototype(ui.placed, PlacedObjectEffects.prototype);
  ui.placed.bindNestedCode();
  bindPrototype(ui.special, SpecialEffects.prototype);
  ui.special.bindNestedCode();
  ui.sounds = modelSoundPresentation(s.origin, ui.combat.sounds);
  const retainedBars: { readonly meterBars?: Slots<MeterBars> } = ui;
  if (retainedBars.meterBars === undefined) ui.meterBars = each(createMeterBars);
  else for (const slot of PARTICIPANT_SLOTS) {
    bindPrototype(ui.meterBars[slot].hud, MeterBar.prototype);
  }

  const retained: { readonly match?: MatchPresentation } = ui;
  const retainedResults: { readonly results?: ResultsBanner } = ui;
  if (retainedResults.results === undefined) ui.results = new ResultsBanner();
  else {
    bindPrototype(ui.results, ResultsBanner.prototype);
    bindPrototype(ui.results.clicks, ButtonClicks.prototype);
  }
  if (retained.match === undefined) ui.match = new MatchPresentation(s.origin, ui.results);
  else bindPrototype(ui.match, MatchPresentation.prototype);

  const retainedElements: { readonly elements?: { readonly hitCues?: readonly effect[] } } = ui;
  if (retainedElements.elements === undefined) ui.elements = new ElementEffects(s.origin);
  else if (retainedElements.elements.hitCues === undefined) {
    ui.elements.destroy();
    ui.elements = new ElementEffects(s.origin);
  } else bindPrototype(ui.elements, ElementEffects.prototype);
  if (ui.classic === undefined) ui.classic = new ClassicPresentation(s.origin);
  else bindPrototype(ui.classic, ClassicPresentation.prototype);
  for (const slot of PARTICIPANT_SLOTS) {
    const renderers = ui.fighters[slot];
    if (renderers === undefined) continue;
    bindPrototype(renderers.shield, ShieldPresentation.prototype);
    bindPrototype(renderers.projectiles, ProjectilePresentation.prototype);
    if (renderers.cues !== undefined) bindPrototype(renderers.cues, SpecialCueEffects.prototype);
    if (renderers.meter !== undefined) {
      bindPrototype(renderers.meter, MeterCueEffects.prototype);
      renderers.meter.rebindModels(bindPrototype);
    }
    if (renderers.pool !== undefined) bindPrototype(renderers.pool, FighterPoolPresentation.prototype);
    bindPrototype(renderers.agency, AgencyMarker.prototype);
    bindPrototype(renderers.flash, BodyFlash.prototype);
    bindPrototype(renderers.glow, MeterGlow.prototype);
    if (renderers.goldSack !== undefined) bindPrototype(renderers.goldSack, GoldSackPresentation.prototype);
    if (renderers.shurikenGlow !== undefined) bindPrototype(renderers.shurikenGlow, ShurikenGlowPresentation.prototype);
    if (renderers.parasol !== undefined) bindPrototype(renderers.parasol, ParasolPresentation.prototype);
    if (renderers.hookChain !== undefined) bindPrototype(renderers.hookChain, HookChainPresentation.prototype);
    if (renderers.spheres !== undefined) bindPrototype(renderers.spheres, SpherePresentation.prototype);
    if (renderers.flight !== undefined) bindPrototype(renderers.flight, FlightPresentation.prototype);
    bindPrototype(renderers.agency.forecast, FighterAgencyForecast.prototype);
    if (renderers.hitAreas !== undefined) bindPrototype(renderers.hitAreas, HitAreaPresentation.prototype);
    bindPrototype(renderers.terror, TerrorPresentation.prototype);
  }
}

export function settingsOpen(s: Readonly<ShellState>, slot: ParticipantSlot): boolean {
  return views(s).settings[slot].isOpen();
}


export function clearMatchEffects(s: ShellState): void {
  const ui = views(s);
  ui.frost.clear();
  ui.criticals.clear();
  ui.placed.clear();
  ui.elements.clear();
  ui.special.clear();
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.projectiles.clear();
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.cues?.clear();
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.meter?.clear();
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.goldSack?.hide();
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.shurikenGlow?.hide();
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.parasol?.hide();
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.hookChain?.hide();
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.spheres?.hide();
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.flight?.hide();
  ui.classic?.endMatch();
}

export function pauseEffects(s: ShellState, paused: boolean): void {
  const ui = views(s);
  ui.combat.setPaused(paused);
  ui.special.setPaused(paused);
  ui.elements.setPaused(paused);
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.projectiles.setPaused(paused);
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.cues?.setPaused(paused);
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.meter?.setPaused(paused);
}
