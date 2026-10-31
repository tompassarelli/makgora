



import { f32 } from "wisp/src/sim/f32";
import { BossPhase, bossClock, bossDefinition, bossMoment, bossPosition, zoneCenter, type BossDefinition, type BossMoment } from "../classic/bosses";
import { classicEnding } from "../classic/classicText";
import { BossKind } from "../classic/runState";
import { type MatchState, Phase } from "../lobby/lobbyState";
import { fighterPortrait } from "../roster/looks";
import { createBackdrop, createText, gameUi, placeTopLeft } from "../ui/frames";
import { MENU_FONT, PANEL_TEXTURE } from "../ui/hudLayout";
import { type ParkedFlags, type WorldOrigin, parkOnce } from "./effects";
import { createEffect, destroyEffect, Effect, EffectAnimation, playEffectAnimation, resetEffectMatrix, setEffectAlpha, setEffectAnimation, setEffectBlendTime, setEffectColor, setEffectMatrixScale, setEffectPosition, setEffectRoll, setEffectScale, setEffectTime, setEffectTimeScale, setEffectYaw } from "wisp/game/effects";
import { destroyFrame, Frame, setFrameEnabled, setFrameFont, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTexture, setFrameVisible, TextAlignment } from "wisp/game/frames";


const ZONE_EFFECTS = 4;
export const BOSS_TELEGRAPH_MODEL = "UI\\Feedback\\SelectionCircle\\SelectionCircle.mdx";

const MARKER_HALF = f32(38.168);
const QUARTER_TURN = f32(1.5707963);

const moment: BossMoment = { strike: -1, index: 0, phase: BossPhase.opening, frame: 0 };

export class ClassicPresentation {
  private boss: BossDefinition | undefined;
  private body: Effect | undefined;
  private tells: Effect[] = [];
  private hits: Effect[] = [];
  private readonly parked: ParkedFlags = [];
  private lastStrike = -1;
  private lastPhase: BossPhase = BossPhase.opening;
  private readonly card: Frame;
  private readonly portrait: Frame;
  private readonly speaker: Frame;
  private readonly lines: Frame;
  private readonly results: Frame;
  private cardText = "";

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    this.card = createBackdrop("ClassicEndingCard", gameUi(), 893);
    setFrameTexture(this.card, PANEL_TEXTURE, 0, true);
    placeTopLeft(this.card, f32(0.15), f32(0.47));
    setFrameSize(this.card, f32(0.5), f32(0.2));
    setFrameEnabled(this.card, false);
    this.portrait = createBackdrop("ClassicEndingPortrait", this.card, 894);
    placeTopLeft(this.portrait, f32(0.165), f32(0.455));
    setFrameSize(this.portrait, f32(0.12), f32(0.17));
    setFrameEnabled(this.portrait, false);
    const text = (name: string, context: number, top: number, height: number, size: number): Frame => {
      const frame = createText(name, this.card, context);
      placeTopLeft(frame, f32(0.3), top);
      setFrameSize(frame, f32(0.335), height);
      setFrameFont(frame, MENU_FONT, size, 0);
      setFrameTextAlignment(frame, TextAlignment.top, TextAlignment.left);
      setFrameEnabled(frame, false);
      return frame;
    };
    this.speaker = text("ClassicEndingSpeaker", 895, f32(0.455), f32(0.022), f32(0.015));
    this.lines = text("ClassicEndingLines", 896, f32(0.43), f32(0.1), f32(0.011));
    this.results = text("ClassicEndingResults", 897, f32(0.32), f32(0.04), f32(0.0095));
    setFrameVisible(this.card, false);
  }


  beginMatch(game: Readonly<MatchState>): void {
    this.endMatch();
    const boss = game.run.active ? bossDefinition(game.run.boss.kind) : undefined;
    if (boss === undefined) return;
    this.boss = boss;
    const { x, y, z } = this.origin;
    this.body = createEffect(boss.model, x, y + boss.depth);
    setEffectScale(this.body, boss.scale);
    setEffectColor(this.body, boss.tint[0], boss.tint[1], boss.tint[2]);
    setEffectYaw(this.body, -QUARTER_TURN);
    for (let index = 0; index < ZONE_EFFECTS; index++) {
      const tell = createEffect(BOSS_TELEGRAPH_MODEL, x, y);
      setEffectBlendTime(tell, 0.0);
      setEffectAnimation(tell, "Neutral Big");
      setEffectTime(tell, 0.5);
      setEffectTimeScale(tell, 0.0);
      setEffectRoll(tell, QUARTER_TURN);
      this.tells.push(tell);
      this.hits.push(createEffect(boss.hitArt, x, y));
    }
    for (let index = 0; index < ZONE_EFFECTS * 2; index++) this.parked[index] = false;
    this.lastStrike = -1;
    this.lastPhase = BossPhase.opening;
    setEffectPosition(this.body, x, y + boss.depth, z + boss.standZ);
  }


  endMatch(): void {
    if (this.body !== undefined) destroyEffect(this.body);
    for (const art of this.tells) destroyEffect(art);
    for (const art of this.hits) destroyEffect(art);
    this.body = undefined;
    this.tells = [];
    this.hits = [];
    this.boss = undefined;
  }


  present(game: Readonly<MatchState>): void {
    const { boss, body } = this;
    if (boss === undefined || body === undefined || game.phase !== Phase.match || game.run.boss.kind === BossKind.none) return;
    const clock = bossClock(game.matchFrame, game.startHold);
    const { origin } = this;

    setEffectPosition(body, origin.x + bossPosition(boss, clock).x, origin.y + boss.depth, origin.z + boss.standZ);
    const flash = game.run.boss.flash > 0;
    setEffectColor(body, flash ? 255 : boss.tint[0], flash ? 90 : boss.tint[1], flash ? 90 : boss.tint[2]);
    const now = bossMoment(boss, clock, moment);
    const strike = boss.strikes[now.index];
    if (now.strike !== this.lastStrike || now.phase !== this.lastPhase) {
      if (now.phase === BossPhase.tell) playEffectAnimation(body, EffectAnimation.spell);
      else if (now.phase === BossPhase.active) playEffectAnimation(body, EffectAnimation.attack);
      else if (now.phase === BossPhase.rest) playEffectAnimation(body, EffectAnimation.stand);
      this.lastStrike = now.strike;
      this.lastPhase = now.phase;
    }
    for (let index = 0; index < ZONE_EFFECTS; index++) {
      const zone = strike?.zones[index];
      const tell = this.tells[index];
      const hit = this.hits[index];
      if (tell === undefined || hit === undefined) continue;
      const showTell = zone !== undefined && now.strike >= 0 && now.phase === BossPhase.tell;
      const showHit = zone !== undefined && now.strike >= 0 && now.phase === BossPhase.active;
      if (showTell && strike !== undefined && zone !== undefined) {
        this.parked[index] = false;
        setEffectScale(tell, 1.0);
        resetEffectMatrix(tell);
        setEffectRoll(tell, QUARTER_TURN);
        setEffectMatrixScale(tell, f32(zone.halfWidth / MARKER_HALF), f32(f32(zone.top - zone.bottom) / f32(2.0 * MARKER_HALF)), 1.0);

        setEffectPosition(tell, origin.x + zoneCenter(strike, zone, game.run.boss.aimX), origin.y - 220.0, origin.z + f32(f32(zone.bottom + zone.top) / 2.0));
        setEffectAlpha(tell, 255);
        setEffectAnimation(tell, "Neutral Big");
        setEffectTime(tell, 0.5);
      } else parkOnce(tell, origin, this.parked, index);
      if (showHit && strike !== undefined && zone !== undefined) {
        this.parked[ZONE_EFFECTS + index] = false;
        setEffectScale(hit, f32(zone.halfWidth / 70.0));
        setEffectPosition(hit, origin.x + zoneCenter(strike, zone, game.run.boss.aimX), origin.y, origin.z + Math.max(0.0, zone.bottom));
      } else parkOnce(hit, origin, this.parked, ZONE_EFFECTS + index);
    }
  }


  updateCard(game: Readonly<MatchState>): void {
    const shown = game.phase === Phase.result && game.run.active && game.run.cleared && !game.lore;
    setFrameVisible(this.card, shown);
    if (!shown) return;
    const ending = classicEnding(game);
    const text = `${ending.speaker}|${ending.lines.join("\n")}|${ending.results}`;
    if (text === this.cardText) return;
    this.cardText = text;
    setFrameTexture(this.portrait, fighterPortrait(game.run.fighter, "Card", game.run.player), 0, true);
    setFrameText(this.speaker, `|cffffcc00${ending.speaker}|r`);
    setFrameText(this.lines, ending.lines.join("\n\n"));
    setFrameText(this.results, ending.results);
  }

  destroy(): void {
    this.endMatch();
    destroyFrame(this.card);
  }
}
