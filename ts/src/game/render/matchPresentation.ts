


import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_CAPACITY, PARTICIPANT_SLOTS } from "../input/participants";
import { MATCH_TICKS_PER_SECOND, Phase, type MatchState } from "../lobby/lobbyState";
import type { Character } from "../sim/codes";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { characterModelScale } from "../presentation/modelScale";
import { MatchCue, MENU_MUSIC, cueSound, interfaceSoundPaths, presentationSoundPaths, readyVoice, victoryAnimation, victoryMusic, warcryVoice } from "../presentation/matchAudio";
import {
  type ResultsView, clearMatchTally, confirmedFrameCues, createCueObservation, createMatchTally, createMenuCues, createMenuObservation,
  menuFrameCues, observeForCues,
} from "../presentation/matchCues";
import { mainDeckZAt } from "../sim/stage";
import { confirmedItemCues, createItemCueObservation, observeItemCues } from "../presentation/itemLook";
import { confirmedDropCues, createDropCueObservation, observeDropCues } from "../presentation/dropLook";
import { meterDropPoint } from "../match/meterDrops";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { coverScreen, createBackdrop, createText, gameUi, sizeText, styleMenuPanel } from "../ui/frames";
import { MENU_FONT, MENU_STYLE, PANEL_TEXTURE } from "../ui/hudLayout";
import { hideEffect, type WorldOrigin } from "./effects";
import { SoundBank, SoundKind } from "./soundBank";
import { resultFighterPlacement } from "../presentation/arenaCamera";
import type { FighterOriginalClip } from "../../generated/clips/fighterOriginalClip";
import { originalClip, originalClipNamed } from "../../generated/clips/fighterOriginalClipInfo";


export const RESULTS_DELAY_FRAMES = 90;

const FACING_CAMERA = f32(-1.5707963705062866);

const createItemSounds = (): sound[] => [MatchCue.lastStock, MatchCue.itemSpawn, MatchCue.confirm].map(cue => {
    const path = cueSound(cue);
    const sound = CreateSound(path, false, true, true, 10, 10, "DefaultEAXON");
    SetSoundDuration(sound, GetSoundFileDuration(path));
    SetSoundVolume(sound, 127);
    SetSoundDistances(sound, 1500.0, 10000.0);
    SetSoundDistanceCutoff(sound, 10000.0);
    return sound;
  });

const createDropSounds = (): sound[] => [MatchCue.itemSpawn, MatchCue.meterReady, MatchCue.confirm].map(cue => {
    const path = cueSound(cue);
    const sound = CreateSound(path, false, true, true, 10, 10, "DefaultEAXON");
    SetSoundDuration(sound, GetSoundFileDuration(path));
    SetSoundVolume(sound, 127);
    SetSoundDistances(sound, 1500.0, 10000.0);
    SetSoundDistanceCutoff(sound, 10000.0);
    return sound;
  });

interface VictoryPose {
  readonly character: Character;
  model: effect | undefined;
  modelPath: string | undefined;
  readonly winnerClip: FighterOriginalClip;
  readonly repeatVictory: boolean;
  readonly heldClip: FighterOriginalClip;
  readonly idleClip: FighterOriginalClip;
  readonly burstFrame: number;
}

export class MatchPresentation {

  itemObservation = createItemCueObservation();
  dropObservation = createDropCueObservation();
  readonly observation = createCueObservation();
  readonly tally = createMatchTally();
  private readonly cues: MatchCue[] = [];
  private readonly cueSerials: number[] = [];
  private itemSounds = createItemSounds();
  private dropSounds = createDropSounds();
  private readonly menu = createMenuObservation();
  private readonly menuCues = createMenuCues();
  // Hover differs by client; create its handle at shared startup on every client.
  private readonly hoverSound = CreateSound(cueSound(MatchCue.hover), false, false, false, 10, 10, "DefaultEAXON");
  private music: string | undefined;
  private readonly voices: (sound | undefined)[] = [];
  private readonly sounds = new SoundBank();
  private readonly panel: framehandle;
  private readonly backing: framehandle;
  private readonly help: framehandle;
  private readonly helpScale: number;
  private readonly title: framehandle;
  private readonly countdown: framehandle;
  private readonly lines: readonly framehandle[];
  private readonly poses: (VictoryPose | undefined)[] = [];
  private readonly resultSounds: sound[] = [];
  private resultEffectsMuted = false;
  private resultBurst = false;
  private pending: ResultsView | undefined;
  private delay = 0;

  posing: number | undefined;
  resultFrames = 0;
  private resultStage = 0;
  private resultView: ResultsView | undefined;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    SetSoundDuration(this.hoverSound, GetSoundFileDuration(cueSound(MatchCue.hover)));
    SetSoundVolume(this.hoverSound, 70);
    for (const path of presentationSoundPaths(SELECTABLE_CHARACTERS, STAGE_CATALOG.map(stage => stage.id))) Preload(path);
    this.sounds.prepare(SoundKind.interfaceFile, interfaceSoundPaths(SELECTABLE_CHARACTERS));
    const parent = gameUi();
    this.countdown = createText("MatchCountdown", parent, 0);
    BlzFrameSetAbsPoint(this.countdown, FRAMEPOINT_CENTER, f32(0.4), f32(0.34));
    BlzFrameSetTextAlignment(this.countdown, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
    BlzFrameSetLevel(this.countdown, 10);
    BlzFrameSetEnable(this.countdown, false);
    BlzFrameSetVisible(this.countdown, false);
    this.panel = createBackdrop("MatchResultsPanel", parent, 0);
    BlzFrameSetAbsPoint(this.panel, FRAMEPOINT_TOPRIGHT, f32(0.79), f32(0.52));
    BlzFrameSetSize(this.panel, f32(0.36), f32(0.13) + PARTICIPANT_CAPACITY * f32(0.04));
    BlzFrameSetEnable(this.panel, false);
    this.backing = styleMenuPanel(this.panel, "MatchResultsPanel");
    this.title = createText("MatchResultsTitle", this.panel, 0);
    const titleScale = sizeText(this.title, MENU_STYLE.titleSize, f32(0.33), f32(0.03));
    BlzFrameSetPoint(this.title, FRAMEPOINT_TOP, this.panel, FRAMEPOINT_TOP, 0.0, f32(f32(-0.012) / titleScale));
    BlzFrameSetTextAlignment(this.title, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_CENTER);
    const lines: framehandle[] = [];
    for (let index = 0; index < PARTICIPANT_CAPACITY; index++) {
      const line = createText(`MatchResultsLine${I2S(index)}`, this.panel, 0);
      const scale = sizeText(line, MENU_STYLE.bodySize, f32(f32(0.336) - 2 * MENU_STYLE.bodyInset), f32(0.036));
      BlzFrameSetPoint(line, FRAMEPOINT_TOPLEFT, this.backing, FRAMEPOINT_TOPLEFT, f32(MENU_STYLE.bodyInset / scale), f32(f32(f32(-0.04) - index * f32(0.04)) / scale));
      BlzFrameSetTextAlignment(line, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT);
      lines.push(line);
    }
    this.lines = lines;
    this.help = createText("MatchResultsHelp", this.panel, 0);
    this.helpScale = sizeText(this.help, MENU_STYLE.bodySize, f32(f32(0.336) - 2 * MENU_STYLE.bodyInset), f32(0.06));
    BlzFrameSetTextAlignment(this.help, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT);
    BlzFrameSetEnable(this.help, false);
    BlzFrameSetVisible(this.panel, false);
  }

  private playFile(path: string): sound | undefined {
    return this.sounds.play(SoundKind.interfaceFile, path, 127);
  }

  presentCountdown(game: Readonly<MatchState>, shown: boolean): void {
    let text = "";
    let age = 0;
    if (game.phase === Phase.result && game.rematchCountdown > 0) {
      text = I2S(floorDiv(game.rematchCountdown + MATCH_TICKS_PER_SECOND - 1, MATCH_TICKS_PER_SECOND));
      age = floorMod(-game.rematchCountdown, MATCH_TICKS_PER_SECOND);
    } else if (game.phase === Phase.match && game.startHold > 0 && game.matchFrame > 0) {
      if (game.matchFrame <= game.startHold) {
        text = I2S(floorDiv(game.startHold - game.matchFrame + MATCH_TICKS_PER_SECOND, MATCH_TICKS_PER_SECOND));
        age = floorMod(game.matchFrame - 1, MATCH_TICKS_PER_SECOND);
      } else if (game.matchFrame <= game.startHold + MATCH_TICKS_PER_SECOND) {
        text = "GO!";
        age = game.matchFrame - game.startHold - 1;
      }
    }
    BlzFrameSetVisible(this.countdown, shown && text !== "");
    if (!shown || text === "") return;
    const pop = f32(f32(1.25) - f32(Math.min(age, 12) / 48.0));
    sizeText(this.countdown, f32(f32(0.075) * pop), f32(0.4), f32(0.14));
    BlzFrameSetAlpha(this.countdown, Math.min(255, floorDiv((MATCH_TICKS_PER_SECOND - age) * 255, 24)));
    BlzFrameSetText(this.countdown, `${MENU_STYLE.gold}${text}|r`);
  }

  cue(cue: MatchCue, serial = 0): void {
    if (cue === MatchCue.hover) {
      StopSound(this.hoverSound, false, false);
      StartSound(this.hoverSound);
      return;
    }
    this.playFile(cueSound(cue, serial));
  }


  playMusic(path: string): void {
    if (this.music === path) return;
    this.music = path;
    EndThematicMusic();
    StopMusic(false);
    ClearMapMusic();
    PlayMusic(path);
  }


  voice(slot: number, path: string): void {
    const previous = this.voices[slot];
    if (previous !== undefined) StopSound(previous, false, false);
    this.voices[slot] = this.playFile(path);
  }


  presentMenus(game: Readonly<MatchState>, hover: number | undefined): void {
    if (game.phase === Phase.stageMenu && this.menu.phase === Phase.characterMenu) {
      for (const slot of PARTICIPANT_SLOTS) {
        const voice = this.voices[slot];
        if (voice !== undefined) StopSound(voice, false, false);
        this.voices[slot] = undefined;
      }
    }
    menuFrameCues(this.menu, game, hover, this.menuCues);
    const { hover: hovered, confirm, fighters } = this.menuCues;
    if (hovered) this.cue(MatchCue.hover);
    if (confirm || fighters.length > 0) this.cue(MatchCue.confirm);
    for (const slot of fighters) this.voice(slot, readyVoice(game.characterChoices[slot]));
  }


  beginMatch(stageMusic: string, game: Readonly<MatchState>, world: Readonly<Roster>): void {
    this.hideResults();
    if (this.resultEffectsMuted) {
      VolumeGroupReset();
      this.resultEffectsMuted = false;
    }
    this.preparePoses(world);
    this.resultStage = game.stageChoice;
    clearMatchTally(this.tally);
    observeForCues(this.observation, game, world);
    this.itemSounds ??= createItemSounds();
    observeItemCues(this.itemObservation ??= createItemCueObservation(), game.items, game.matchFrame);
    this.dropSounds ??= createDropSounds();
    observeDropCues(this.dropObservation ??= createDropCueObservation(), game.drops, game.matchFrame);
    this.playMusic(stageMusic);
  }


  observe(game: Readonly<MatchState>, world: Readonly<Roster>): void {
    observeForCues(this.observation, game, world);
    this.itemSounds ??= createItemSounds();
    observeItemCues(this.itemObservation ??= createItemCueObservation(), game.items, game.matchFrame);
    this.dropSounds ??= createDropSounds();
    observeDropCues(this.dropObservation ??= createDropCueObservation(), game.drops, game.matchFrame);
  }


  presentConfirmed(game: Readonly<MatchState>, world: Readonly<Roster>): readonly MatchCue[] {
    confirmedFrameCues(this.observation, game, world, this.tally, this.cues, this.cueSerials);
    const itemCues = confirmedItemCues(this.itemObservation, game.items, game.matchFrame);
    for (let index = 0; index < this.itemSounds.length; index++) {
      if ((itemCues & (1 << index)) === 0) continue;
      const sound = at(this.itemSounds, index);
      StopSound(sound, false, false);
      SetSoundPosition(sound, this.origin.x, this.origin.y, this.origin.z + mainDeckZAt(game.stageChoice, 0.0));
      StartSound(sound);
    }
    const dropCues = confirmedDropCues(this.dropObservation, game.drops, game.matchFrame);
    for (let index = 0; index < this.dropSounds.length; index++) {
      if ((dropCues & (1 << index)) === 0) continue;
      const sound = at(this.dropSounds, index);
      const point = meterDropPoint(game.stageChoice, Math.max(0, index === 0 ? game.drops.nextPoint : game.drops.point));
      StopSound(sound, false, false);
      SetSoundPosition(sound, this.origin.x + point.x, this.origin.y, this.origin.z + point.z);
      StartSound(sound);
    }
    for (let index = 0; index < this.cues.length; index++) this.cue(at(this.cues, index), at(this.cueSerials, index));
    return this.cues;
  }


  beginResults(view: ResultsView, delay: number): void {
    this.pending = view;
    this.resultView = view;
    this.resultFrames = 0;
    this.delay = delay;
    this.placeResultPoses();
  }


  tick(): boolean {
    if (this.resultView !== undefined) {
      this.resultFrames++;
      this.placeResultPoses();
      for (const [index, row] of this.resultView.rows.entries()) {
        if (!row.winner || this.poses[row.slot]?.burstFrame !== this.resultFrames) continue;
        this.resultBurst = true;
        const placement = resultFighterPlacement(this.resultStage, index, this.resultView.rows.length);
        const burst = AddSpecialEffect("Abilities\\Spells\\Other\\Levelup\\LevelupCaster.mdx", this.origin.x + placement.x, this.origin.y);
        BlzSetSpecialEffectZ(burst, this.origin.z + placement.z);
        DestroyEffect(burst);
      }
    }
    if (this.pending === undefined) return false;
    if (this.delay > 0) {
      this.delay--;
      return false;
    }
    const view = this.pending;
    this.pending = undefined;
    this.showResults(view);
    return true;
  }

  private showResults(view: ResultsView): void {
    const { winner } = view;
    BlzFrameSetText(this.title, `${MENU_STYLE.gold}${winner === undefined ? "No contest" : "Results"}|r`);
    BlzFrameSetSize(this.panel, f32(0.36), f32(f32(0.13) + view.rows.length * f32(0.04)));
    BlzFrameSetPoint(this.help, FRAMEPOINT_TOPLEFT, this.backing, FRAMEPOINT_TOPLEFT, f32(MENU_STYLE.bodyInset / this.helpScale), f32(f32(f32(-0.04) - view.rows.length * f32(0.04)) / this.helpScale));
    for (let index = 0; index < this.lines.length; index++) {
      const row = view.rows[index];
      BlzFrameSetVisible(at(this.lines, index), row !== undefined);
      BlzFrameSetText(at(this.lines, index), row === undefined ? "" : `${row.winner ? MENU_STYLE.gold : MENU_STYLE.text}${row.text}|r`);
    }
    BlzFrameSetVisible(this.panel, true);
    this.music = undefined;
    StopMusic(true);
    const theme = victoryMusic(winner);
    if (theme !== undefined) PlayThematicMusic(theme);
    if (winner === undefined) return;
    for (const path of [cueSound(MatchCue.cheer), warcryVoice(winner)]) {
      const played = this.playFile(path);
      if (played !== undefined) this.resultSounds.push(played);
    }
    this.posing = view.rows[0]?.slot;
  }

  showResultHelp(text: string): void {
    BlzFrameSetText(this.help, `${MENU_STYLE.text}${text.replace(". Press", ".\nPress")}|r`);
  }

  preparePoses(world: Readonly<Roster>): void {
    this.releasePoses();
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      const character = fighterAt(world, slot).character;
      const winnerIndex = originalClipNamed(character, victoryAnimation(character));
      const idleIndex = originalClipNamed(character, "stand") ?? originalClipNamed(character, "stand -1")
        ?? originalClipNamed(character, "stand - 1") ?? originalClipNamed(character, "stand 1");
      const winnerClip = winnerIndex === undefined ? undefined : originalClip(character, winnerIndex);
      const idleClip = idleIndex === undefined ? undefined : originalClip(character, idleIndex);
      if (winnerClip === undefined || idleClip === undefined) continue;
      const readyIndex = originalClipNamed(character, "stand ready");
      const heldClip = readyIndex === undefined ? idleClip : originalClip(character, readyIndex) ?? idleClip;
      this.poses[slot] = { character, model: undefined, modelPath: undefined, winnerClip, repeatVictory: victoryAnimation(character).includes("victory"), heldClip, idleClip,
        burstFrame: R2I((winnerClip.endSeconds - winnerClip.startSeconds) * 60.0 + 0.5) };
    }
  }

  private placeResultPoses(): void {
    const view = this.resultView;
    if (view === undefined) return;
    for (const [index, row] of view.rows.entries()) {
      const pose = this.poses[row.slot];
      if (pose === undefined) continue;
      const winning = row.winner;
      let seconds = I2R(this.resultFrames) / 60.0;
      const holding = winning && !pose.repeatVictory && seconds >= pose.winnerClip.endSeconds - pose.winnerClip.startSeconds;
      const clip = winning ? holding ? pose.heldClip : pose.winnerClip : pose.idleClip;
      if (pose.model !== undefined && pose.modelPath !== clip.modelPath) {
        DestroyEffect(pose.model);
        pose.model = undefined;
      }
      if (pose.model === undefined) {
        pose.model = AddSpecialEffect(clip.modelPath, this.origin.x, this.origin.y);
        pose.modelPath = clip.modelPath;
        hideEffect(pose.model, this.origin);
        BlzSetSpecialEffectColorByPlayer(pose.model, Player(row.slot));
        BlzSetSpecialEffectAnimationBlendTime(pose.model, 0.0);
        BlzSetSpecialEffectAnimation(pose.model, "Stand");
        BlzSetSpecialEffectTimeScale(pose.model, 0.0);
      }
      const model = pose.model;
      const placement = resultFighterPlacement(this.resultStage, index, view.rows.length);
      BlzSetSpecialEffectPosition(model, this.origin.x + placement.x, this.origin.y, this.origin.z + placement.z);
      BlzSetSpecialEffectYaw(model, FACING_CAMERA);
      BlzSetSpecialEffectScale(model, characterModelScale(pose.character));
      const duration = clip.endSeconds - clip.startSeconds;
      if (holding || duration <= 0.0) seconds = 0.0;
      else if (!winning || pose.repeatVictory) seconds -= I2R(R2I(seconds / duration)) * duration;
      BlzSetSpecialEffectTime(model, (clip.timeline === true ? clip.startSeconds : 0.0) + seconds);
    }
  }

  resultsShown(): boolean {
    return this.resultView !== undefined && this.pending === undefined;
  }

  hideResults(): void {
    for (const played of this.resultSounds) StopSound(played, false, true);
    this.resultSounds.length = 0;
    if (this.resultBurst) {
      // A model's event sound outlives DestroyEffect, so the level-up burst's sound is cut through its volume groups.
      VolumeGroupSetVolume(SOUND_VOLUMEGROUP_SPELLS, 0.0);
      VolumeGroupSetVolume(SOUND_VOLUMEGROUP_COMBAT, 0.0);
      this.resultEffectsMuted = true;
    }
    this.pending = undefined;
    this.resultView = undefined;
    this.resultFrames = 0;
    this.resultBurst = false;
    this.posing = undefined;
    BlzFrameSetVisible(this.panel, false);
    this.releasePoses();
  }


  private loadingFrames: { readonly cover: framehandle; readonly art: framehandle; readonly name: framehandle } | undefined;


  showLoading(name: string, texture: string): void {
    const parent = gameUi();
    const frames = (this.loadingFrames ??= {
      cover: createBackdrop("StageLoadingCover", parent, 0),
      art: createBackdrop("StageLoadingArt", parent, 0),
      name: createText("StageLoadingName", parent, 0),
    });
    BlzFrameSetTexture(frames.cover, PANEL_TEXTURE, 0, true);
    coverScreen(frames.cover);
    BlzFrameSetLevel(frames.cover, 8);
    BlzFrameSetTexture(frames.art, texture, 0, true);
    BlzFrameSetAbsPoint(frames.art, FRAMEPOINT_CENTER, f32(0.4), f32(0.35));

    BlzFrameSetSize(frames.art, f32(0.18), f32(0.18));
    BlzFrameSetLevel(frames.art, 9);
    BlzFrameSetAbsPoint(frames.name, FRAMEPOINT_TOP, f32(0.4), f32(0.24));
    BlzFrameSetSize(frames.name, f32(0.4), f32(0.06));
    BlzFrameSetFont(frames.name, MENU_FONT, f32(0.02), 0);
    BlzFrameSetTextAlignment(frames.name, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_CENTER);
    BlzFrameSetLevel(frames.name, 9);
    BlzFrameSetText(frames.name, `${name}\n|cffbbbbbbGetting the arena ready…|r`);
    for (const frame of [frames.cover, frames.art, frames.name]) {
      BlzFrameSetEnable(frame, false);
      BlzFrameSetVisible(frame, true);
    }
  }

  hideLoading(): void {
    const frames = this.loadingFrames;
    if (frames === undefined) return;
    for (const frame of [frames.cover, frames.art, frames.name]) BlzFrameSetVisible(frame, false);
  }


  private releasePoses(): void {
    for (const slot of PARTICIPANT_SLOTS) {
      const pose = this.poses[slot];
      if (pose?.model !== undefined) {
        hideEffect(pose.model, this.origin);
        DestroyEffect(pose.model);
      }
      this.poses[slot] = undefined;
    }
  }

  enterMenus(): void {
    this.hideResults();
    this.playMusic(MENU_MUSIC);
  }
}
