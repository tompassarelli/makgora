import { assertEquals, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character } from "../sim/codes";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { VERIFIED_STOCK_SOUNDS } from "../assets/stockSoundInfo";
import { HitElement } from "../sim/hitRegions";
import { moveSound, playHit, playPerform, playShieldHit, soundFiles, soundedMoves } from "./moveSounds";

test("every move has weak, strong and shield audio and every configured sound exists in the installed game [k4 reference native]", () => {
  const missing: string[] = [];
  for (const character of SELECTABLE_CHARACTERS) {
    for (const move of soundedMoves(character)) {
      const row = moveSound(character, move);
      const name = `${fighterName(character)} ${move}`;
      if (row === undefined) {
        missing.push(`${name}: no sounds`);
        continue;
      }
      for (const [slot, layers] of [["perform", row.perform], ["hit", row.hit], ["strong", row.strong], ["shield", row.shield]] as const) {
        if (slot !== "perform" && layers.length === 0) missing.push(`${name}: no ${slot}`);
        for (const layer of [...layers, ...(row.voice === undefined ? [] : [row.voice])]) {
          for (const sound of layer.sounds) {
            const files = soundFiles(sound);
            if (files.length === 0) missing.push(`${name}: ${slot} ${sound} is no stock label`);
            for (const file of files) if (VERIFIED_STOCK_SOUNDS[file] === undefined) missing.push(`${name}: ${file} not in the game`);
          }
        }
      }
    }
  }
  assertEquals(missing.join("\n"), "");
});

test("three jabs in a row never sound alike, and the same hit always sounds the same [k2 property]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const takes: string[] = [];
    for (let serial = 1; serial <= 3; serial++) {
      const played: string[] = [];
      playHit(character, AttackStyle.jab, false, HitElement.normal, serial, (file, volume, pitch) => played.push(`${file}@${volume}@${pitch}`));
      const again: string[] = [];
      playHit(character, AttackStyle.jab, false, HitElement.normal, serial, (file, volume, pitch) => again.push(`${file}@${volume}@${pitch}`));
      assertEquals(again.join(","), played.join(","), `${fighterName(character)} jab ${serial} repeats exactly`);
      takes.push(played.join(","));
    }
    assertEquals(new Set(takes).size, 3, `${fighterName(character)} jab takes ${takes.join(" | ")}`);
  }
});

const SIGNATURE_SOUNDS: { readonly [label: string]: Character } = {
  StormBolt: Character.mountainKing, StormBoltLaunch: Character.mountainKing, ThunderClap: Character.mountainKing,
  WardBirth: Character.shadowHunter, VoodooBirth: Character.shadowHunter, ShadowHunterMissileLaunch: Character.shadowHunter, ShadowHunterMissileHit: Character.shadowHunter,
  StampedeHit: Character.beastmaster,
  Whirlwind: Character.blademaster, WindWalk: Character.blademaster, MirrorImage: Character.blademaster,
  FrostNova: Character.lich, DeathAndDecayTarget: Character.lich, DarkRitual: Character.lich,
  DeathCoil: Character.lichKing, DeathPactTarget: Character.lichKing,
  CarrionSwarmLaunch: Character.dreadlord, CarrionSwarmDamage: Character.dreadlord, Sleep: Character.dreadlord, InfernalBirth: Character.dreadlord,
  DemonHunterMissileLaunch: Character.demonHunter, DemonHunterMissileHit: Character.demonHunter, ManaBurn: Character.demonHunter,
  Warstomp: Character.cairne, ShockWave: Character.cairne, Reincarnation: Character.cairne,
  LightningBolt: Character.thrall, FeralSpiritTarget: Character.thrall, Earthquake: Character.thrall,
  FanOfKnives: Character.warden, FanOfKnivesHit: Character.warden, ShadowStrikeMissileBirth: Character.warden, ShadowStrikeBirth: Character.warden,
  FlameStrike: Character.kaelthas, BanishCaster: Character.kaelthas, SiphonManaCaster: Character.kaelthas, PhoenixMissileLaunch: Character.kaelthas,
  EntanglingRoots: Character.malfurion, ForceOfNatureBirth: Character.malfurion,
  Impale: Character.anubarak, ImpaleHit: Character.anubarak, ImpaleLand: Character.anubarak, ScarabBirth: Character.anubarak,
  BreathOfFire: Character.chen, StrongDrinkMissile: Character.chen, StrongDrink: Character.chen,
  ClusterRocketsLaunch: Character.tinker, ClusterRocketsImpact: Character.tinker, PocketFactoryBirth: Character.tinker, HeroTinkerMorph: Character.tinker,
  RainOfFireWave: Character.pitLord, HowlOfTerror: Character.pitLord,
  WaterElementalBirth: Character.jaina,
  HolyBolt: Character.forsakenPaladin, DivineShield: Character.forsakenPaladin,
};

test("no move plays a signature sound owned by another roster hero [k2 property]", () => {
  const borrowed: string[] = [];
  for (const character of SELECTABLE_CHARACTERS) {
    for (const move of soundedMoves(character)) {
      const row = moveSound(character, move);
      if (row === undefined) continue;
      for (const layer of [...row.perform, ...row.hit, ...row.strong, ...row.shield, ...(row.voice === undefined ? [] : [row.voice])]) {
        for (const sound of layer.sounds) {
          const owner = SIGNATURE_SOUNDS[sound];
          if (owner !== undefined && owner !== character) borrowed.push(`${fighterName(character)} ${move}: ${sound} belongs to ${fighterName(owner)}`);
        }
      }
    }
  }
  assertEquals([...new Set(borrowed)].join("\n"), "");
});


test("Grom performs and lands every move without Bloodlust audio while his weapon impacts remain audible [k3 measure #563]", () => {
  const bloodlust = soundFiles("Bloodlust");
  for (const move of soundedMoves(Character.grom)) {
    for (let serial = 0; serial < 5; serial++) {
      const performed: string[] = [];
      const impacts: string[] = [];
      const sink = (file: string) => performed.push(file);
      playPerform(Character.grom, move, serial, sink);
      playHit(Character.grom, move, false, HitElement.normal, serial, (file) => impacts.push(file));
      playHit(Character.grom, move, true, HitElement.normal, serial, (file) => impacts.push(file));
      playShieldHit(Character.grom, move, serial, (file) => impacts.push(file));
      assertEquals([...performed, ...impacts].some((file) => bloodlust.includes(file)), false, `Grom ${move} Bloodlust`);
      assertEquals(impacts.length > 0, true, `Grom ${move} weapon impacts`);
    }
  }
});
