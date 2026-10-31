import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { ITEM_HEIGHT, itemWarningFrames } from "../match/centreItem";
import { type MatchState, Phase } from "../lobby/lobbyState";
import { Character, ItemKind, SpecialAction } from "../sim/codes";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { mainDeckZAt } from "../sim/stage";
import { AvatarView, avatarView } from "../presentation/ultimateVoice";
import { AVATAR_ALPHA, AVATAR_COLOR, AVATAR_MODEL, AVATAR_SECONDS, ITEM_MODELS, type ItemColor, itemBlinkOff, itemColor, itemTelegraphAlpha, itemTelegraphScale } from "../presentation/itemLook";
import { hideEffect, type WorldOrigin } from "./effects";
import { createEffect, setEffectAlpha, setEffectAnimation, setEffectColor, setEffectPosition, setEffectScale, setEffectTime, setEffectTimeScale, setEffectYaw } from "wisp/game/effects";


const BURST_FRAMES = 45;
const HEAVY_SHELL: ItemColor = { red: 200, green: 205, blue: 225 };
const AVATAR_CAST_COLOR: ItemColor = { red: 255, green: 255, blue: 255 };
const SPIN_PER_FRAME = f32(0.05);

interface Burst {
  readonly model: effect;
  start: number;
  shown: boolean;
}

interface Carrier {
  readonly ring: effect;
  readonly trail: effect;
  readonly shell: effect;
  readonly avatar: effect | undefined;
  readonly pickup: Burst;
  readonly end: Burst;
  buffFrames: number;
  kind: number;
  shown: boolean;
  avatarBuff: boolean;
  avatarShown: boolean;
}

function create(path: string, origin: Readonly<WorldOrigin>): effect {
  const model = createEffect(path, origin.x, origin.y);
  hideEffect(model, origin);
  return model;
}

const paint = (model: effect, color: ItemColor) => setEffectColor(model, color.red, color.green, color.blue);

export class ItemPresentation {
  private readonly speedPickup: effect;
  private readonly heavyPickup: effect;
  private readonly glow: effect;
  private readonly telegraph: effect;
  private readonly spawn: Burst;
  private readonly carriers: readonly Carrier[];
  private shownKind: number = ItemKind.none;
  private shownStage = -1;
  private telegraphShown = false;
  private spawnSerial = 0;
  private pickupSerial = 0;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    this.speedPickup = create(ITEM_MODELS.speedPickup, origin);
    this.heavyPickup = create(ITEM_MODELS.heavyPickup, origin);
    this.glow = create(ITEM_MODELS.glow, origin);
    this.telegraph = create(ITEM_MODELS.glow, origin);
    this.spawn = { model: create(ITEM_MODELS.burst, origin), start: 0, shown: false };
    this.carriers = PARTICIPANT_SLOTS.map(() => ({
      ring: create(ITEM_MODELS.glow, origin),
      trail: create(ITEM_MODELS.speedTrail, origin),
      shell: create(ITEM_MODELS.heavyPickup, origin),
      avatar: create(AVATAR_MODEL, origin),
      pickup: { model: create(ITEM_MODELS.burst, origin), start: 0, shown: false },
      end: { model: create(ITEM_MODELS.end, origin), start: 0, shown: false },
      buffFrames: 0,
      kind: ItemKind.none,
      shown: false,
      avatarBuff: false,
      avatarShown: false,
    }));
  }

  private place(model: effect, x: number, z: number, scale: number): void {
    setEffectPosition(model, this.origin.x + x, this.origin.y, this.origin.z + z);
    setEffectScale(model, scale);
  }

  private fire(burst: Burst, frame: number, x: number, z: number, scale: number, color: ItemColor): void {
    this.place(burst.model, x, z, scale);
    paint(burst.model, color);
    setEffectTime(burst.model, 0.0);
    burst.start = frame;
    burst.shown = true;
  }

  private settle(burst: Burst, frame: number, playing: boolean): void {
    if (burst.shown && (!playing || frame - burst.start > BURST_FRAMES || frame < burst.start)) {
      hideEffect(burst.model, this.origin);
      burst.shown = false;
    }
  }

  present(game: Readonly<MatchState>, world: Readonly<Roster>): void {
    const playing = game.phase === Phase.match;
    const { items, matchFrame: frame } = game;
    const deck = mainDeckZAt(game.stageChoice, 0.0);
    const kind = playing ? items.kind : ItemKind.none;
    const left = playing ? itemWarningFrames(items, frame) : undefined;
    if (left !== undefined) {
      this.place(this.telegraph, 0.0, deck + 2.0, itemTelegraphScale(left));
      paint(this.telegraph, itemColor(items.nextKind));
      setEffectAlpha(this.telegraph, itemTelegraphAlpha(left));
      this.telegraphShown = true;
    } else if (this.telegraphShown) {
      hideEffect(this.telegraph, this.origin);
      this.telegraphShown = false;
    }
    if (kind !== this.shownKind || game.stageChoice !== this.shownStage) {
      hideEffect(this.speedPickup, this.origin);
      hideEffect(this.heavyPickup, this.origin);
      if (kind === ItemKind.none) hideEffect(this.glow, this.origin);
      else {
        this.place(this.glow, 0.0, deck + 2.0, f32(0.7));
        paint(this.glow, itemColor(kind));
      }
    }
    if (kind === ItemKind.speed) this.place(this.speedPickup, 0.0, deck + ITEM_HEIGHT - 20.0, f32(0.32));
    else if (kind === ItemKind.heavy) this.place(this.heavyPickup, 0.0, deck + ITEM_HEIGHT - 10.0, f32(0.75));
    const pickup = kind === ItemKind.speed ? this.speedPickup : kind === ItemKind.heavy ? this.heavyPickup : undefined;
    if (pickup !== undefined) {
      paint(pickup, itemColor(kind));
      setEffectYaw(pickup, f32(frame * SPIN_PER_FRAME));
    }
    if (playing && items.spawnSerial !== this.spawnSerial && kind !== ItemKind.none) this.fire(this.spawn, frame, 0.0, deck + 10.0, f32(0.6), itemColor(kind));
    this.settle(this.spawn, frame, playing);
    this.spawnSerial = items.spawnSerial;
    this.shownKind = kind;
    this.shownStage = game.stageChoice;
    const picked = playing && items.pickupSerial !== this.pickupSerial ? items.lastTaker : -1;
    this.pickupSerial = items.pickupSerial;
    for (const slot of PARTICIPANT_SLOTS) {
      const carrier = this.carriers[slot];
      if (carrier === undefined) continue;
      const fighter = playing && isActive(world, slot) ? fighterAt(world, slot) : undefined;
      const buffFrames = fighter === undefined || fighter.status.out ? 0 : fighter.status.buffFrames;
      const buff = fighter?.status.buff ?? ItemKind.none;
      const x = fighter?.motion.x ?? 0.0;
      const z = fighter?.motion.z ?? 0.0;
      if (picked === slot && buffFrames > 0) this.fire(carrier.pickup, frame, x, z + 40.0, f32(0.4), itemColor(buff));
      if (fighter !== undefined && carrier.buffFrames > 0 && carrier.buffFrames <= 3 && buffFrames === 0 && !fighter.status.out) this.fire(carrier.end, frame, x, z + 30.0, f32(0.9), itemColor(carrier.kind));
      this.settle(carrier.pickup, frame, playing);
      this.settle(carrier.end, frame, playing);
      if (buffFrames <= 0 || buff !== ItemKind.heavy || picked === slot) carrier.avatarBuff = false;
      else if (fighter?.character === Character.mountainKing && fighter.special.action === SpecialAction.heroUltimate) carrier.avatarBuff = true;
      if (buffFrames > 0) {
        const color = itemColor(buff);
        const fade = itemBlinkOff(buffFrames) ? 70 : 255;
        this.place(carrier.ring, x, z + 3.0, f32(0.95));
        paint(carrier.ring, color);
        setEffectAlpha(carrier.ring, fade);
        if (buff === ItemKind.speed) {
          this.place(carrier.trail, x, z, f32(0.8));
          paint(carrier.trail, color);
          setEffectAlpha(carrier.trail, fade);
        } else hideEffect(carrier.trail, this.origin);
        if (buff === ItemKind.heavy && !carrier.avatarBuff) {
          this.place(carrier.shell, x, z + 10.0, 1.0);
          paint(carrier.shell, HEAVY_SHELL);
          setEffectAlpha(carrier.shell, fade);
          setEffectYaw(carrier.shell, f32(frame * SPIN_PER_FRAME));
        } else hideEffect(carrier.shell, this.origin);
        carrier.shown = true;
      } else if (carrier.shown) {
        hideEffect(carrier.ring, this.origin);
        hideEffect(carrier.trail, this.origin);
        hideEffect(carrier.shell, this.origin);
        carrier.shown = false;
      }
      const view = fighter === undefined || fighter.status.out ? AvatarView.hidden : avatarView(fighter.character, fighter.special.action, fighter.special.frame, carrier.avatarBuff && buffFrames > 0);
      if (view !== AvatarView.hidden && carrier.avatar !== undefined) {
        this.place(carrier.avatar, x, z, 1.0);
        setEffectYaw(carrier.avatar, fighter !== undefined && fighter.facing < 0 ? f32(3.14159274) : 0.0);
        if (!carrier.avatarShown) {
          setEffectAnimation(carrier.avatar, "spell");
          setEffectTime(carrier.avatar, AVATAR_SECONDS);
        }
        if (view === AvatarView.held) {
          setEffectTime(carrier.avatar, AVATAR_SECONDS);
          setEffectTimeScale(carrier.avatar, 0.0);
          paint(carrier.avatar, AVATAR_COLOR);
          setEffectAlpha(carrier.avatar, itemBlinkOff(buffFrames) ? idiv(AVATAR_ALPHA, 2) : AVATAR_ALPHA);
        } else {
          setEffectTimeScale(carrier.avatar, 1.0);
          paint(carrier.avatar, AVATAR_CAST_COLOR);
          setEffectAlpha(carrier.avatar, 255);
        }
        carrier.avatarShown = true;
      } else if (carrier.avatar !== undefined && carrier.avatarShown) {
        hideEffect(carrier.avatar, this.origin);
        carrier.avatarShown = false;
      }
      carrier.buffFrames = buffFrames;
      if (buffFrames > 0) carrier.kind = buff;
    }
  }
}
