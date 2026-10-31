


import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_CAPACITY, PARTICIPANT_SLOTS } from "../input/participants";
import { MATCH_TICKS_PER_SECOND, Phase, type MatchState, costumeFor } from "../lobby/lobbyState";
import { costumeClipModel } from "../roster/costumes";
import { type Character, DuoRole } from "../sim/codes";
import { duoRole } from "../sim/fighter";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { PARTNER_COSTUME } from "../presentation/model/costume";
import { bodyModelScale } from "../presentation/fighterScale";
import { MatchCue, MENU_MUSIC, cueSound, interfaceSoundPaths, presentationSoundPaths, readyVoice, victoryAnimation, victoryMusic, warcryVoice } from "../presentation/matchAudio";
import {
  type ResultsView, clearMatchTally, confirmedFrameCues, createCueObservation, createMatchTally, createMenuCues, createMenuObservation,
  menuFrameCues, observeForCues,
} from "../presentation/matchCues";
import { mainDeckZAt } from "../sim/stage";
import { confirmedItemCues, createItemCueObservation, observeItemCues } from "../presentation/itemLook";
import { confirmedOrbCues, createOrbCueObservation, observeOrbCues } from "../presentation/orbLook";
import { orbPoint, orbWarned } from "../sim/orbs";
import { SELECTABLE_CHARACTERS } from "../roster/kits";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { createBackdrop, createText, fitToWindow, gameUi, sizeText, styleMenuPanel } from "../ui/frames";
import { MENU_FONT, MENU_STYLE, PANEL_TEXTURE } from "../ui/hudLayout";
import { hideEffect, type WorldOrigin } from "./effects";
import { SoundBank, SoundKind } from "./soundBank";
import { resultFighterPlacement } from "../presentation/arenaCamera";
import type { FighterOriginalClip } from "../../generated/clips/fighterOriginalClip";
import { originalClip, originalClipNamed } from "../../generated/clips/fighterOriginalClipInfo";
import { defeatClip, resultBodies, resultPoseAt, type ResultBody, type ResultClips } from "../presentation/resultPose";
import { createEffect, destroyEffect, setEffectAnimation, setEffectBlendTime, setEffectPosition, setEffectScale, setEffectTeamColor, setEffectTime, setEffectTimeScale, setEffectYaw, setEffectZ } from "wisp/game/effects";
import { setFrameAbsPoint, setFrameAlpha, setFrameEnabled, setFrameFont, setFrameLevel, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTexture, setFrameVisible } from "wisp/game/frames";
import { player } from "wisp/game/players";
import { preloadAsset } from "wisp/game/files";
import { clearMusic, createSound, endTheme, playMusic, playSound, playTheme, resetVolumeGroups, setSoundCutoff, setSoundDistances, setSoundDuration, setSoundPosition, setSoundVolume, setVolumeGroup, soundFileDuration, stopMusic, stopSound } from "wisp/game/sound";


export const RESULTS_DELAY_FRAMES = 90;
export const LEVEL_UP_FRAME = 12;

const FACING_CAMERA = f32(-1.5707963705062866);

const createItemSounds = (): sound[] => [MatchCue.lastStock, MatchCue.itemSpawn, MatchCue.confirm].map(cue => {
    const path = cueSound(cue);
    const sound = createSound(path, false, true, true, 10, 10, "DefaultEAXON");
    setSoundDuration(sound, soundFileDuration(path));
    setSoundVolume(sound, 127);
    setSoundDistances(sound, 1500.0, 10000.0);
    setSoundCutoff(sound, 10000.0);
    return sound;
  });

const createOrbSounds = (): sound[] => [MatchCue.itemSpawn, MatchCue.meterReady, MatchCue.confirm].map(cue => {
    const path = cueSound(cue);
    const sound = createSound(path, false, true, true, 10, 10, "DefaultEAXON");
    setSoundDuration(sound, soundFileDuration(path));
    setSoundVolume(sound, 127);
    setSoundDistances(sound, 1500.0, 10000.0);
    setSoundCutoff(sound, 10000.0);
    return sound;
  });

interface VictoryPose {
  readonly character: Character;
  readonly costume: number;
  readonly role: DuoRole;
  model: effect | undefined;
  modelPath: string | undefined;
  readonly clips: ResultClips;
}

export interface ResultsDisplay {
  show(rows: ResultsView["rows"]): void;
  hide(): void;
}

export class MatchPresentation {

  itemObservation = createItemCueObservation();
  orbObservation = createOrbCueObservation();
  readonly observation = createCueObservation();
  readonly tally = createMatchTally();
  private readonly cues: MatchCue[] = [];
  private itemSounds = createItemSounds();
  private orbSounds = createOrbSounds();
  private readonly menu = createMenuObservation();
  private readonly menuCues = createMenuCues();
  // Hover differs by client; create its handle at shared startup on every client.
  private readonly hoverSound = createSound(cueSound(MatchCue.hover), false, false, false, 10, 10, "DefaultEAXON");
  private music: string | undefined;
  private readonly voices: (sound | undefined)[] = [];
  private readonly sounds = new SoundBank();
  private readonly countdown: framehandle;
  private readonly poses: (VictoryPose | undefined)[] = [];
  private readonly partners: (number | undefined)[] = [];
  private readonly resultSounds: sound[] = [];
  private resultEffectsMuted = false;
  private resultBurst = false;
  pending: ResultsView | undefined;
  private delay = 0;

  posing: number | undefined;
  resultFrames = 0;
  private resultStage = 0;
  private resultView: ResultsView | undefined;

  constructor(private readonly origin: Readonly<WorldOrigin>, private readonly banner: ResultsDisplay) {
    setSoundDuration(this.hoverSound, soundFileDuration(cueSound(MatchCue.hover)));
    setSoundVolume(this.hoverSound, 70);
    for (const path of presentationSoundPaths(SELECTABLE_CHARACTERS, STAGE_CATALOG.map(stage => stage.id))) preloadAsset(path);
    this.sounds.prepare(SoundKind.interfaceFile, interfaceSoundPaths(SELECTABLE_CHARACTERS));
    const parent = gameUi();
    this.countdown = createText("MatchCountdown", parent, 0);
    setFrameAbsPoint(this.countdown, FRAMEPOINT_CENTER, f32(0.4), f32(0.34));
    setFrameTextAlignment(this.countdown, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
    setFrameLevel(this.countdown, 10);
    setFrameEnabled(this.countdown, false);
    setFrameVisible(this.countdown, false);
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
    setFrameVisible(this.countdown, shown && text !== "");
    if (!shown || text === "") return;
    const pop = f32(f32(1.25) - f32(Math.min(age, 12) / 48.0));
    sizeText(this.countdown, f32(f32(0.075) * pop), f32(0.4), f32(0.14));
    setFrameAlpha(this.countdown, Math.min(255, floorDiv((MATCH_TICKS_PER_SECOND - age) * 255, 24)));
    setFrameText(this.countdown, `${MENU_STYLE.gold}${text}|r`);
  }

  cue(cue: MatchCue): void {
    if (cue === MatchCue.hover) {
      stopSound(this.hoverSound, false, false);
      playSound(this.hoverSound);
      return;
    }
    this.playFile(cueSound(cue));
  }


  playMusic(path: string): void {
    if (this.music === path) return;
    this.music = path;
    endTheme();
    stopMusic(false);
    clearMusic();
    playMusic(path);
  }


  voice(slot: number, path: string): void {
    const previous = this.voices[slot];
    if (previous !== undefined) stopSound(previous, false, false);
    this.voices[slot] = this.playFile(path);
  }


  presentMenus(game: Readonly<MatchState>, hover: number | undefined): void {
    if (game.phase === Phase.stageMenu && this.menu.phase === Phase.characterMenu) {
      for (const slot of PARTICIPANT_SLOTS) {
        const voice = this.voices[slot];
        if (voice !== undefined) stopSound(voice, false, false);
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
      resetVolumeGroups();
      this.resultEffectsMuted = false;
    }
    this.preparePoses(game, world);
    this.resultStage = game.stageChoice;
    clearMatchTally(this.tally);
    observeForCues(this.observation, game, world);
    this.itemSounds ??= createItemSounds();
    observeItemCues(this.itemObservation ??= createItemCueObservation(), game.items, game.matchFrame);
    this.orbSounds ??= createOrbSounds();
    observeOrbCues(this.orbObservation ??= createOrbCueObservation(), game.orbs, orbWarned(game));
    this.playMusic(stageMusic);
  }


  observe(game: Readonly<MatchState>, world: Readonly<Roster>): void {
    observeForCues(this.observation, game, world);
    this.itemSounds ??= createItemSounds();
    observeItemCues(this.itemObservation ??= createItemCueObservation(), game.items, game.matchFrame);
    this.orbSounds ??= createOrbSounds();
    observeOrbCues(this.orbObservation ??= createOrbCueObservation(), game.orbs, orbWarned(game));
  }


  presentConfirmed(game: Readonly<MatchState>, world: Readonly<Roster>): readonly MatchCue[] {
    confirmedFrameCues(this.observation, game, world, this.tally, this.cues);
    const itemCues = confirmedItemCues(this.itemObservation, game.items, game.matchFrame);
    for (let index = 0; index < this.itemSounds.length; index++) {
      if ((itemCues & (1 << index)) === 0) continue;
      const sound = at(this.itemSounds, index);
      stopSound(sound, false, false);
      setSoundPosition(sound, this.origin.x, this.origin.y, this.origin.z + mainDeckZAt(game.stageChoice, 0.0));
      playSound(sound);
    }
    const orbCues = confirmedOrbCues(this.orbObservation, game.orbs, orbWarned(game));
    const point = orbPoint(game.stageChoice);
    for (let index = 0; index < this.orbSounds.length; index++) {
      if ((orbCues & (1 << index)) === 0) continue;
      const sound = at(this.orbSounds, index);
      stopSound(sound, false, false);
      setSoundPosition(sound, this.origin.x + point.x, this.origin.y, this.origin.z + point.z);
      playSound(sound);
    }
    for (let index = 0; index < this.cues.length; index++) this.cue(at(this.cues, index));
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
      const bodies = this.resultBodies(this.resultView);
      for (const [index, row] of bodies.entries()) {
        if (!row.winner || this.resultFrames !== LEVEL_UP_FRAME) continue;
        this.resultBurst = true;
        const placement = resultFighterPlacement(this.resultStage, index, bodies.length);
        const burst = createEffect("Abilities\\Spells\\Other\\Levelup\\LevelupCaster.mdx", this.origin.x + placement.x, this.origin.y);
        setEffectZ(burst, this.origin.z + placement.z);
        destroyEffect(burst);
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
    this.banner.show(view.rows);
    this.music = undefined;
    stopMusic(true);
    const theme = victoryMusic(winner);
    if (theme !== undefined) playTheme(theme);
    if (winner === undefined) return;
    for (const path of [cueSound(MatchCue.cheer), warcryVoice(winner)]) {
      const played = this.playFile(path);
      if (played !== undefined) this.resultSounds.push(played);
    }
    this.posing = view.rows[0]?.slot;
  }


  preparePoses(game: Readonly<MatchState>, world: Readonly<Roster>): void {
    this.releasePoses();
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      const fighter = fighterAt(world, slot);
      const { character } = fighter;
      const role = duoRole(fighter);
      this.partners[slot] = role === DuoRole.leader ? world.linked[slot] : undefined;
      const winnerIndex = originalClipNamed(character, victoryAnimation(character));
      const idleIndex = originalClipNamed(character, "stand") ?? originalClipNamed(character, "stand -1")
        ?? originalClipNamed(character, "stand - 1") ?? originalClipNamed(character, "stand 1");
      const winnerClip = winnerIndex === undefined ? undefined : originalClip(character, winnerIndex);
      const idleClip = idleIndex === undefined ? undefined : originalClip(character, idleIndex);
      if (winnerClip === undefined || idleClip === undefined) continue;
      const readyIndex = originalClipNamed(character, "stand ready");
      const heldClip = readyIndex === undefined ? idleClip : originalClip(character, readyIndex) ?? idleClip;
      this.poses[slot] = { character, costume: role === DuoRole.partner ? PARTNER_COSTUME : costumeFor(game, slot), role, model: undefined, modelPath: undefined, clips: { winnerClip, repeatVictory: victoryAnimation(character).includes("victory"), heldClip, standClip: idleClip, defeatClip: defeatClip(character) } };
    }
  }

  private resultBodies(view: ResultsView): ResultBody[] {
    return resultBodies(view.rows, slot => this.partners[slot]);
  }

  private placeResultPoses(): void {
    const view = this.resultView;
    if (view === undefined) return;
    const bodies = this.resultBodies(view);
    for (const [index, row] of bodies.entries()) {
      const pose = this.poses[row.slot];
      if (pose === undefined) continue;
      const { clip, time } = resultPoseAt(pose.clips, row.winner, I2R(this.resultFrames) / 60.0);
      const modelPath = costumeClipModel(pose.character, pose.costume, clip);
      if (pose.model !== undefined && pose.modelPath !== modelPath) {
        destroyEffect(pose.model);
        pose.model = undefined;
      }
      if (pose.model === undefined) {
        pose.model = createEffect(modelPath, this.origin.x, this.origin.y);
        pose.modelPath = modelPath;
        hideEffect(pose.model, this.origin);
        setEffectTeamColor(pose.model, player(row.slot));
        setEffectBlendTime(pose.model, 0.0);
        setEffectAnimation(pose.model, "Stand");
        setEffectTimeScale(pose.model, 0.0);
      }
      const model = pose.model;
      const placement = resultFighterPlacement(this.resultStage, index, bodies.length);
      setEffectPosition(model, this.origin.x + placement.x, this.origin.y, this.origin.z + placement.z);
      setEffectYaw(model, FACING_CAMERA);
      setEffectScale(model, bodyModelScale(pose.character, pose.role));
      setEffectTime(model, time);
    }
  }

  resultsShown(): boolean {
    return this.resultView !== undefined && this.pending === undefined;
  }

  hideResults(): void {
    for (const played of this.resultSounds) stopSound(played, false, true);
    this.resultSounds.length = 0;
    if (this.resultBurst) {
      // A model's event sound outlives DestroyEffect, so the level-up burst's sound is cut through its volume groups.
      setVolumeGroup(SOUND_VOLUMEGROUP_SPELLS, 0.0);
      setVolumeGroup(SOUND_VOLUMEGROUP_COMBAT, 0.0);
      this.resultEffectsMuted = true;
    }
    this.pending = undefined;
    this.resultView = undefined;
    this.resultFrames = 0;
    this.resultBurst = false;
    this.posing = undefined;
    this.banner.hide();
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
    setFrameTexture(frames.cover, PANEL_TEXTURE, 0, true);
    fitToWindow(frames.cover);
    setFrameLevel(frames.cover, 8);
    setFrameTexture(frames.art, texture, 0, true);
    setFrameAbsPoint(frames.art, FRAMEPOINT_CENTER, f32(0.4), f32(0.35));

    setFrameSize(frames.art, f32(0.18), f32(0.18));
    setFrameLevel(frames.art, 9);
    setFrameAbsPoint(frames.name, FRAMEPOINT_TOP, f32(0.4), f32(0.24));
    setFrameSize(frames.name, f32(0.4), f32(0.06));
    setFrameFont(frames.name, MENU_FONT, f32(0.02), 0);
    setFrameTextAlignment(frames.name, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_CENTER);
    setFrameLevel(frames.name, 9);
    setFrameText(frames.name, `${name}\n|cffbbbbbbGetting the arena ready…|r`);
    for (const frame of [frames.cover, frames.art, frames.name]) {
      setFrameEnabled(frame, false);
      setFrameVisible(frame, true);
    }
  }

  hideLoading(): void {
    const frames = this.loadingFrames;
    if (frames === undefined) return;
    for (const frame of [frames.cover, frames.art, frames.name]) setFrameVisible(frame, false);
  }


  private releasePoses(): void {
    for (const slot of PARTICIPANT_SLOTS) {
      const pose = this.poses[slot];
      if (pose?.model !== undefined) {
        hideEffect(pose.model, this.origin);
        destroyEffect(pose.model);
      }
      this.poses[slot] = undefined;
      this.partners[slot] = undefined;
    }
  }

  enterMenus(): void {
    this.hideResults();
    this.playMusic(MENU_MUSIC);
  }
}
