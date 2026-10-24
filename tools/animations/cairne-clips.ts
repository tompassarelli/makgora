
import { mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, parseMDX, ModelRenderer, model as mdx } from "war3-model";
import { isDeepStrictEqual } from "node:util";
import { mat3, mat4, quat, vec3 } from "gl-matrix";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase, AttackStyle, Character, GrabAction } from "../../ts/src/game/sim/codes";
import { drawnStrideSource, measureDrawnStride, type DrawnStride } from "../../ts/scripts/wisp/drawnMotion";
import { DRAWN_STRIDES } from "../../ts/src/game/presentation/drawnStrideInfo";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { CAIRNE_MOVES } from "../../ts/src/game/sim/heroes/cairneMoves";
import { CAIRNE_SPECIALS } from "../../ts/src/game/sim/heroes/cairneSpecials";
import { seconds } from "./asset-info";
function ensure(ok: unknown, why: string): asserts ok { if (!ok) throw new Error(why); }
function tracks(value: unknown, visit: (track: mdx.AnimVector, path: string) => void, path = "") {
  if (!value || typeof value !== "object" || ArrayBuffer.isView(value)) return;
  if ("Keys" in value && Array.isArray(value.Keys)) { visit(value as mdx.AnimVector, path); return; }
  for (const [key, child] of Object.entries(value)) if (key !== "Nodes") tracks(child, visit, `${path}.${key}`);
}
const onGlobalClock=(track:mdx.AnimVector)=>track.GlobalSeqId!=null&&track.GlobalSeqId!==-1&&track.GlobalSeqId!==0xffffffff;
function parseSource(bytes:ArrayBuffer){const parsed=parseMDX(bytes);ensure(Buffer.from(generateMDX(parsed)).equals(Buffer.from(bytes)),"Stock MDX does not round trip");return parsed;}
function encodeVerified(value:mdx.Model){const bytes=generateMDX(value);ensure(isDeepStrictEqual(value,parseMDX(bytes)),"Authored MDX does not round trip");return bytes;}

const [input, output] = process.argv.slice(2).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/cairne-clips.ts STOCK_TAUREN.mdx PRIVATE_OUTPUT");
const source = parseSource(await Bun.file(input).arrayBuffer()), model = structuredClone(source);
ensure(source.Sequences.length === 12 && source.Nodes.some(n => n.Name === "Bone_Axe_Free"), "Expected classic Tauren Chieftain");
const stand = source.Sequences[4]!, idleSequence = source.Sequences[0]!;
interface Gesture { chest?: number; twist?: number; head?: number; arm?: number; elbow?: number; free?: number; freeElbow?: number; hip?: number; knee?: number; lean?: number; yaw?: number; leftHip?: number; rightHip?: number; leftKnee?: number; rightKnee?: number; step?: number; pitch?: number; rise?: number; spin?: number; depth?: number; shin?: number; leftShin?: number; rightShin?: number; hoof?: number; leftHoof?: number; rightHoof?: number; pelvis?: number; slide?: number }
interface Phase { frame: number; gesture: Gesture; target?: readonly [number,number]; grip?: readonly [number,number]; idle?: boolean }
interface Action { pose: HeroPose; frames: number; contact: number; gesture: Gesture; stock?: number; stockHit?: number; prepTravel?: number; hold?: boolean; air?: boolean; roll?: number; first?: Gesture; phases?: readonly Phase[]; target?: readonly [number, number]; damage?: boolean; beats?: readonly Phase[]; gore?: "travel" | "hold" | "recovery"; settleFrom?: number; stockFrom?: number }
interface Strike { prep: Gesture; hit: Gesture; follow: Gesture; prepAt?: number; followAt?: number; settle?: number; rest?: Gesture; restTarget?: readonly [number,number]; restGrip?: readonly [number,number]; prepTarget?: readonly [number,number]; hitTarget?: readonly [number,number]; hitGrip?: readonly [number,number]; followGrip?: readonly [number,number]; mid?: readonly Phase[]; aim?: boolean; reach?: readonly [number,number]; air?: boolean }
const strikeBeats=(move:{startupFrames:number;totalFrames:number;regions:readonly {firstFrame:number;lastFrame:number;hit:{strike?:{x2:number;z2:number}}}[]},s:Strike):Phase[]=>{
  const contact=move.startupFrames,end=move.totalFrames,lastActive=Math.max(...move.regions.map(r=>r.lastFrame));
  const followAt=s.followAt??Math.min(end-4,lastActive+2),settleAt=Math.round(followAt+(end-followAt)*(s.settle??0.55));
  const strike=move.regions[0]!.hit.strike!;
  return [{frame:0,gesture:ready},{frame:s.prepAt??Math.max(1,contact-Math.max(2,Math.round(contact*0.3))),gesture:s.prep,target:s.prepTarget},
    {frame:contact,gesture:s.hit,target:s.hitTarget??(s.aim?[strike.x2,strike.z2]:undefined),grip:s.hitGrip},...(s.mid??[]),{frame:followAt,gesture:s.follow,target:s.reach,grip:s.followGrip},
    {frame:settleAt,gesture:s.rest??blend(s.follow,ready,0.62),target:s.restTarget,grip:s.restGrip},{frame:end-1,gesture:ready,idle:!s.air},{frame:end,gesture:ready,idle:!s.air}].sort((a,b)=>a.frame-b.frame);
};
const blend=(a:Gesture,b:Gesture,t:number):Gesture=>Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].map(k=>[k,(a[k as keyof Gesture]??0)*(1-t)+(b[k as keyof Gesture]??0)*t]));
const ready: Gesture = {};
const reach: Gesture = { chest: 22, arm: -75, elbow: 35, free: -48, hip: -12, knee: 18, head: -12 };
const high: Gesture = { chest: -18, arm: -160, elbow: -10, free: -105, hip: 12, knee: 8, head: -22 };
const low: Gesture = { chest: 50, arm: -38, elbow: 20, free: -50, hip: -50, knee: 75, head: -20 };
const back: Gesture = { ...reach, chest: -10, yaw: 130, arm: -110, free: -60 };
const brace: Gesture = { chest: 28, arm: -24, elbow: 40, free: -35, hip: -35, knee: 55, head: -12 };
const held: Gesture = { chest: 8, arm: -25, elbow: 20, free: -78, freeElbow: 12, hip: -8, knee: 12 };
const captive: Gesture = { chest: -25, head: -28, arm: 25, elbow: 55, free: 20, freeElbow: 45, hip: -30, knee: 38 };
const actions: Action[] = [];
const normals: readonly [HeroPose, AttackStyle, Gesture][] = [
  ["jab", AttackStyle.jab, {...reach, chest: 12, arm: -55}], ["jab2", AttackStyle.jab2, reach],
  ["forwardTilt", AttackStyle.forwardTilt, reach], ["forwardTiltUp", AttackStyle.forwardTiltUp, reach], ["forwardTiltDown", AttackStyle.forwardTiltDown, reach],
  ["upTilt", AttackStyle.upTilt, high], ["downTilt", AttackStyle.downTilt, low], ["dashAttack", AttackStyle.dashAttack, {...reach, lean: 24, chest: 32}],
  ["forwardSmash", AttackStyle.forwardSmash, {...reach, chest: 38, hip: -24}], ["upSmash", AttackStyle.upSmash, {...high, chest: -30}], ["downSmash", AttackStyle.downSmash, low],
  ["neutralAir", AttackStyle.neutralAir, reach], ["forwardAir", AttackStyle.forwardAir, {...reach, chest: 32}], ["backAir", AttackStyle.backAir, back],
  ["upAir", AttackStyle.upAir, {chest:-22,head:-38,arm:15,free:10,hip:28,knee:40}], ["downAir", AttackStyle.downAir, {...low, chest: 38, arm: -55}],
];
const tiltHit: Gesture = {chest:10,arm:-130,elbow:5,free:-120,pitch:4,step:10,leftHip:-30,rightHip:15,leftKnee:25,head:-14};
const forwardTiltStrike=(bend:number):Strike=>({prep:{chest:-22+bend,arm:-170,elbow:40,free:-140,freeElbow:30,pitch:-10,step:-12,leftHip:-5,rightHip:10,knee:12,head:-20},
  hit:{...tiltHit,chest:10+bend},aim:true,mid:[{frame:15,gesture:{chest:38+bend,arm:-70,elbow:0,free:-70,pitch:12,step:18,leftHip:-42,rightHip:20,leftKnee:40,head:-6},target:[156,60]}],
  follow:{chest:52+bend,arm:-40,elbow:5,free:-45,pitch:16,step:20,leftHip:-48,rightHip:24,leftKnee:50,knee:15},followAt:18});
const slam: Gesture = {chest:60,arm:-45,elbow:0,free:-50,pitch:20,step:26,leftHip:-60,rightHip:35,leftKnee:65,rightKnee:10,head:-5};
const sweep: Gesture = {chest:60,twist:-25,arm:-50,elbow:5,free:-45,pitch:14,step:8,hip:-60,knee:85};
const strikes: Partial<Record<HeroPose, Strike>> = {
  jab2:{prep:{chest:-8,twist:25,arm:10,elbow:80,free:-20,pitch:-10,step:-10,hip:-10,knee:22,head:-8},
    hit:{chest:38,twist:-25,arm:-88,elbow:0,free:-25,pitch:16,step:28,leftHip:-50,rightHip:24,leftKnee:38,knee:10,head:-14},aim:true,
    follow:{chest:36,twist:-28,arm:-90,elbow:0,free:-22,pitch:15,step:27,leftHip:-50,rightHip:24,leftKnee:38,knee:10,head:-14},followAt:12,reach:[124,52],settle:0.6,restTarget:[60,25],
    rest:{chest:4,twist:-4,arm:-45,elbow:20,free:-25,pitch:2,step:5,leftHip:-12,rightHip:6,leftKnee:10,head:-4}},
  forwardTilt:forwardTiltStrike(0),forwardTiltUp:forwardTiltStrike(-8),forwardTiltDown:forwardTiltStrike(8),
  upTilt:{prep:{chest:22,twist:22,arm:-40,elbow:40,free:-40,pitch:6,step:-4,hip:-25,knee:45},
    hit:{chest:-5,twist:-12,arm:-150,elbow:10,free:-140,pitch:-4,step:14,leftHip:-38,rightHip:18,leftKnee:28,knee:10,head:-25},aim:true,
    mid:[{frame:14,gesture:{chest:-20,twist:-25,arm:-180,elbow:10,free:-175,pitch:-10,step:16,leftHip:-32,rightHip:16,leftKnee:22,head:-35,knee:5},target:[0,215]},{frame:16,gesture:{chest:-30,twist:-35,arm:-195,elbow:15,free:-190,pitch:-14,step:14,leftHip:-24,rightHip:14,leftKnee:18,head:-40,knee:12},target:[-90,175]}],
    follow:{chest:-30,twist:-40,arm:-235,elbow:25,free:-225,pitch:-14,step:12,leftHip:-20,rightHip:12,leftKnee:16,head:-30,knee:15},followAt:18,reach:[-140,140],settle:0.45,restTarget:[-55,175],
    rest:{chest:-6,twist:-15,arm:-325,elbow:10,free:-300,pitch:-4,step:8,head:-10,hip:4,knee:10}},
  downTilt:{prep:{chest:30,twist:25,arm:-10,elbow:60,free:-30,pitch:6,step:-8,hip:-45,knee:70,head:-10},
    hit:{chest:55,twist:-20,arm:-45,elbow:5,free:-40,pitch:16,step:18,leftHip:-65,rightHip:-20,leftKnee:70,rightKnee:85,head:-20},aim:true,
    follow:{chest:58,twist:-35,arm:-48,elbow:5,free:-42,pitch:18,step:22,leftHip:-65,rightHip:-20,leftKnee:70,rightKnee:85,head:-20},followAt:14,reach:[152,8]},
  dashAttack:{prep:{chest:20,twist:35,arm:20,elbow:40,free:10,freeElbow:40,pitch:6,step:-6,leftHip:-35,rightHip:20,knee:40,head:-5},
    hit:{chest:58,twist:40,arm:35,elbow:25,free:-20,freeElbow:70,pitch:32,step:50,leftHip:-72,rightHip:40,leftKnee:40,rightKnee:4,head:5},
    follow:{chest:64,twist:44,arm:40,elbow:25,free:-16,freeElbow:70,pitch:40,step:68,leftHip:-74,rightHip:42,leftKnee:42,rightKnee:4,head:5},followAt:21},
  forwardSmash:{prep:{chest:-30,arm:-195,elbow:50,free:-180,freeElbow:40,pitch:-14,step:-18,leftHip:-10,rightHip:20,knee:20,head:-25},prepAt:20,
    hit:{chest:5,arm:-140,elbow:5,free:-130,pitch:2,step:6,leftHip:-30,rightHip:15,leftKnee:25,head:-18},aim:true,
    mid:[{frame:29,gesture:{chest:40,arm:-80,elbow:0,free:-80,pitch:14,step:22,leftHip:-55,rightHip:30,leftKnee:55,head:-8},target:[175,60]},{frame:30,gesture:slam,target:[175,10]}],
    follow:{...slam,chest:66,pitch:22,step:28},followAt:34,reach:[190,0]},
  upSmash:{prep:{chest:14,arm:-5,elbow:70,free:-5,freeElbow:60,pitch:0,hip:-80,knee:120,head:4},prepAt:18,prepTarget:[75,55],
    hit:{chest:-12,arm:-178,elbow:0,free:-178,pitch:-4,hip:6,knee:-2,head:-32},aim:true,
    mid:[{frame:21,gesture:{chest:25,arm:-130,elbow:10,free:-120,freeElbow:20,pitch:4,hip:-45,knee:65,head:-12},target:[70,185]}],
    follow:{chest:-24,arm:-196,elbow:0,free:-150,freeElbow:40,pitch:-9,hip:10,knee:-6,head:-36},followAt:30,
    rest:{chest:-6,arm:-150,elbow:20,free:-60,freeElbow:30,pitch:-3,hip:4,knee:4,head:-14}},
  downSmash:{prep:{chest:-18,arm:-160,elbow:20,free:-150,freeElbow:15,pitch:-8,leftHip:-88,rightHip:-62,leftKnee:92,rightKnee:84,head:-20},prepAt:11,
    hit:{chest:36,arm:-62,elbow:5,free:-56,pitch:18,step:22,leftHip:-22,rightHip:-10,leftKnee:22,rightKnee:6,head:-14},aim:true,
    mid:[{frame:24,gesture:{chest:-10,twist:-20,yaw:150,arm:-150,elbow:15,free:-140,pitch:-6,leftHip:-86,rightHip:-68,leftKnee:88,rightKnee:86,head:-16},target:[-70,70]},
      {frame:28,gesture:{chest:42,twist:0,yaw:160,arm:-60,elbow:5,free:-54,pitch:20,step:22,leftHip:-24,rightHip:-12,leftKnee:24,rightKnee:8,head:-14},target:[-148,10]}],
    follow:{chest:44,twist:10,yaw:180,arm:-58,elbow:5,free:-52,pitch:22,step:24,leftHip:-26,rightHip:-12,leftKnee:26,rightKnee:8,head:-12},followAt:34,reach:[-158,8]},
  downAir:{prep:{chest:-10,arm:-185,elbow:30,free:-140,freeElbow:30,pitch:-10,leftHip:-110,rightHip:-102,leftKnee:124,rightKnee:118,head:-6,rise:16},prepAt:6,prepTarget:[-40,240],
    hit:{chest:40,arm:-10,elbow:60,free:60,freeElbow:20,pitch:0,leftHip:10,rightHip:6,leftKnee:-18,rightKnee:-18,head:20,rise:-60,depth:0},hitTarget:[50,-10],hitGrip:[45,40],
    mid:[{frame:11,gesture:{chest:-16,arm:-195,elbow:35,free:-160,freeElbow:30,pitch:-14,leftHip:-130,rightHip:-122,leftKnee:146,rightKnee:140,head:-10,rise:28},target:[-45,255]},
      {frame:16,gesture:{chest:45,arm:-10,elbow:60,free:65,freeElbow:20,pitch:0,leftHip:10,rightHip:6,leftKnee:-20,rightKnee:-20,head:22,rise:-88,depth:0},target:[50,-10],grip:[45,40]}],
    follow:{chest:25,arm:-10,elbow:60,free:-40,freeElbow:25,pitch:0,leftHip:-30,rightHip:-26,leftKnee:45,rightKnee:40,head:20,rise:-45,depth:0},followAt:19,reach:[55,0],followGrip:[35,60],settle:0.5,restTarget:[-60,40],restGrip:[-10,70],
    rest:{chest:12,arm:-30,elbow:30,free:-30,freeElbow:30,pitch:0,leftHip:-45,rightHip:-40,leftKnee:65,rightKnee:60,head:6,rise:-24,depth:-40}},
};
for (const [pose, style, gesture] of normals) {
  const move = CAIRNE_MOVES.normals[style]; ensure(move, `${pose}: missing timing`);
  const strike = strikes[pose];
  if (strike) { actions.push({pose,frames:move.totalFrames,contact:move.startupFrames,gesture:strike.hit,beats:strikeBeats(move,{...strike,air:pose.endsWith("Air")}),air:pose.endsWith("Air")}); continue; }
  const first = move.startupFrames;
  const sweeping = ["forwardTilt","forwardTiltUp","forwardTiltDown","forwardSmash","forwardAir","backAir","upTilt","downSmash","neutralAir"].includes(pose);
  const phases:Phase[]|undefined = sweeping ? move.regions.map(region => ({frame: region.firstFrame, target:[region.hit.strike!.x2,region.hit.strike!.z2],gesture: {...gesture,
    arm: (gesture.arm ?? 0) + ((region.hit.strike?.z2??0) > 130 ? -45 : (region.hit.strike?.z2??0) < 40 ? 45 : 0),
    yaw: (region.hit.strike?.x2??0) < 0 ? 145 : 0,
    chest: (gesture.chest ?? 0) + ((region.hit.strike?.z2??0) < 40 ? 20 : -8) }})) : undefined;
  actions.push({pose,frames:move.totalFrames,contact:first,gesture,phases,air:pose.endsWith("Air"),
    prepTravel: style===AttackStyle.dashAttack ? 40 : undefined,
    target: style===AttackStyle.upAir || style===AttackStyle.dashAttack ? undefined : [move.regions[0]!.hit.strike!.x2, move.regions[0]!.hit.strike!.z2]});
}
const extra: readonly [HeroPose, number, number, Gesture][] = [
  ["crouch",30,10,brace], ["landing",8,2,{...brace,chest:38}], ["shield",30,1,{...brace,free:-100}], ["smashCharge",30,1,{chest:-28,arm:-190,elbow:50,free:-175,freeElbow:40,lean:-12,hip:-15,knee:35,head:-22}],
  ["airDodge",49,4,{...brace,lean:-30}], ["dizzy",60,20,{chest:-15,head:35,arm:20,free:30,yaw:20}],
  ["turn",8,4,{chest:-10,yaw:130,hip:-15,knee:25}], ["stop",8,3,{...brace,lean:-20}], ["jumpSquat",5,4,brace],
  ["jump",24,6,{...high,hip:-35,knee:65}], ["doubleJump",24,6,{...high,hip:35,knee:45}], ["wallJump",24,6,{...reach,lean:-35,leftHip:-65,rightHip:25}],
  ["wallTech",26,6,{...brace,lean:-30}], ["fall",30,10,{chest:12,arm:-30,free:-50,hip:35,knee:45}], ["fallSpecial",30,10,{chest:38,arm:15,free:25,hip:45,knee:65}],
  ["ledgeHang",30,1,{chest:25,free:-165,freeElbow:5,hip:40,knee:60}], ["ledgeClimb",25,10,{...brace,lean:35,free:-105}], ["ledgeAttack",40,16,reach],
  ["knockdown",30,20,{...brace,lean:85}], ["downDamage",24,6,{...brace,lean:75,head:-35}], ["getUp",30,18,{...brace,lean:20}], ["getUpAttack",49,16,{...reach,yaw:100}],
  ["spotDodge",22,4,{...brace,lean:-25}], ["tech",26,8,{...brace,lean:45}],
  ["damageGround",24,3,{chest:-30,head:-30,arm:35,free:45}], ["damageAir",24,3,{chest:-45,hip:-35,knee:55,free:30}],
  ["damageTumble",30,9,{...brace,lean:100}], ["damageShield",24,3,{...brace,chest:-15,head:-20}],
  ["grab",45,11,held], ["grabHold",30,1,held], ["grabbed",30,1,captive], ["pummel",68,60,{...held,chest:26,arm:-60,elbow:60}],
  ["throwForward",45,19,{...held,chest:32,free:-115,freeElbow:-5}], ["throwBack",54,23,{...held,chest:-22,free:-175,yaw:125}],
  ["throwUp",32,21,{...held,chest:-25,free:-175,freeElbow:0,knee:0}], ["throwDown",51,24,{...held,chest:65,free:-35,hip:-35,knee:55}],
  ["victimPummel",68,60,{...captive,chest:45,head:-48}], ["victimThrowForward",45,19,{...captive,lean:-35,chest:-38,arm:-90}],
  ["victimThrowBack",54,23,{...captive,lean:40,yaw:-85,arm:-135}], ["victimThrowUp",32,21,{...captive,lean:-25,hip:-60,knee:20,free:-140}],
  ["victimThrowDown",51,24,{...captive,lean:75,chest:60,hip:-75,knee:80}],
];
for (const [pose, frames, contact, gesture] of extra) {
  const throwCode = ({pummel:GrabAction.pummel,throwForward:GrabAction.throwForward,throwBack:GrabAction.throwBack,throwUp:GrabAction.throwUp,throwDown:GrabAction.throwDown} as Partial<Record<HeroPose,GrabAction>>)[pose];
  const thrown = throwCode === undefined ? undefined : CAIRNE_MOVES.throws[throwCode];
  const move = pose === "grab" ? CAIRNE_MOVES.normals[AttackStyle.grab] : undefined;
  actions.push({pose,frames:thrown?.totalFrames ?? move?.totalFrames ?? frames,contact:thrown?.contactFrame ?? move?.startupFrames ?? contact,gesture,
    phases:pose==="getUpAttack"?[{frame:16,gesture:reach,target:[125,45]},{frame:17,gesture:high,target:[0,180]},{frame:18,gesture:back,target:[-125,45]}]:undefined,
    first: pose.startsWith("victim") ? captive : pose.startsWith("throw") || pose === "pummel" ? held : pose === "getUp" || pose === "getUpAttack" ? {...brace,lean:85} : undefined,
    hold:["crouch","shield","smashCharge","grabHold","grabbed","ledgeHang"].includes(pose),
    air:["airDodge","jump","doubleJump","wallJump","fall","fallSpecial","damageAir","damageTumble","victimThrowUp"].includes(pose)});
}
for (const pose of ["rollForward","rollBackward","techForward","techBackward","getUpRollForward","getUpRollBackward","ledgeRoll"] as const)
  actions.push({pose,frames:pose.startsWith("tech")?40:pose.startsWith("getUp")?35:pose==="ledgeRoll"?36:31,contact:10,gesture:brace,roll:pose.endsWith("Backward")?-1:1});
for (const [pose, key, gesture, contact] of [
  ["neutralSpecial","neutral",{...low,arm:-45,chest:45},24], ["sideSpecial","side",{...brace,leftHip:-70,rightHip:10,chest:20},20],
  ["upSpecial","up",{...high,hip:35,knee:55},11], ["downSpecial","down",{...brace,arm:-65,free:-65,head:30},20],
] as const) {
  const special = CAIRNE_SPECIALS[key]; ensure(special, `${pose}: missing special`);
  for (const air of [false,true]) { const form = air ? special.air ?? special.ground : special.ground;
    const gather: Gesture = {...brace,chest:32,arm:35,elbow:20,free:-30,freeElbow:15,hip:-55,knee:85,lean:6,yaw:-20,head:-10};
    const lift: Gesture = {...brace,chest:24,arm:95,elbow:25,free:-45,freeElbow:15,hip:-58,knee:88,lean:2,yaw:-24,head:-4};
    const overhead: Gesture = {...brace,chest:4,arm:145,elbow:35,free:-85,freeElbow:20,hip:-58,knee:88,lean:-8,yaw:-26,head:6};
    const wound: Gesture = {...brace,chest:-28,arm:-155,elbow:55,free:-110,freeElbow:20,hip:-65,knee:95,lean:-18,yaw:-28,head:10};
    const coiled: Gesture = {...wound,chest:-38,arm:-172,elbow:65,free:-125,hip:-70,knee:100,lean:-24,yaw:-34,head:18};
    actions.push({pose:(air?`${pose}Air`:pose) as HeroPose,frames:form.endFrame,contact,gesture,air:air||key==="up",...key==="down"?{stock:9,stockFrom:200,stockHit:567,settleFrom:form.endFrame-9}:{},
      first:key==="neutral"?gather:undefined,
      phases:key==="neutral"?[
        {frame:1,gesture:gather},{frame:3,gesture:gather},{frame:6,gesture:lift},{frame:10,gesture:overhead},{frame:14,gesture:wound},{frame:contact-1,gesture:coiled},
        {frame:contact,gesture},{frame:contact+4,gesture},
      ]:undefined}); }
}
interface Authored { prep: Gesture; prepTarget?: readonly [number,number]; first?: Gesture; phases: readonly Phase[] }
const authored: Partial<Record<HeroPose, Authored>> = {
  forwardAir: {prepTarget:[-60,200], prep:{chest:-35,head:-18,arm:-178,elbow:-25,free:-165,freeElbow:35,hip:22,knee:38,lean:-25}, phases:[
    {frame:19,target:[150,175],gesture:{chest:0,arm:-150,free:-140,freeElbow:20,hip:0,knee:30,lean:5}},
    {frame:20,target:[165,110],gesture:{chest:14,free:-120,freeElbow:15,hip:-10,knee:36,lean:8}},
    {frame:21,target:[145,35],gesture:{chest:32,head:-10,free:-90,freeElbow:12,hip:-24,knee:48,lean:11}},
    {frame:22,target:[120,-5],gesture:{chest:40,head:-12,free:-70,freeElbow:10,hip:-30,knee:55,lean:12}},
    {frame:25,target:[90,-25],gesture:{chest:44,head:-14,arm:0,elbow:15,free:-55,hip:-34,knee:58,lean:12}},
    {frame:30,target:[30,-25],gesture:{chest:42,head:-12,arm:25,elbow:20,free:-45,hip:-36,knee:58,lean:11}}]},
  getUpAttack: {first:{...brace,lean:85}, prepTarget:[-110,40], prep:{chest:32,head:-10,arm:35,elbow:25,free:-40,hip:-55,knee:85,lean:30}, phases:[
    {frame:16,target:[125,45],gesture:{chest:30,free:-30,hip:-50,knee:80,lean:12,yaw:0}},
    {frame:17,target:[130,40],gesture:{chest:32,free:-30,hip:-50,knee:80,lean:12,yaw:20}},
    {frame:18,target:[-125,45],gesture:{chest:28,free:-35,hip:-50,knee:80,lean:10,yaw:150}},
    {frame:22,target:[-130,40],gesture:{chest:30,free:-35,hip:-50,knee:80,lean:10,yaw:175}},
    {frame:30,target:[100,30],gesture:{chest:24,arm:50,elbow:20,free:-30,hip:-35,knee:55,yaw:340}}]},
  ledgeAttack: {first:{...brace,lean:35,free:-105}, prepTarget:[-90,190], prep:{chest:-10,head:-12,arm:-170,elbow:20,free:-60,freeElbow:20,hip:-15,knee:20,lean:-4,leftHip:-25,rightHip:10}, phases:[
    {frame:16,target:[140,45],gesture:{chest:26,head:-8,arm:-90,free:-80,hip:-30,knee:42,lean:6,leftHip:-50,rightHip:20}},
    {frame:19,target:[125,20],gesture:{chest:32,head:-6,arm:-60,free:-60,hip:-30,knee:44,lean:8,leftHip:-52,rightHip:22}},
    {frame:27,target:[100,30],gesture:{chest:22,arm:-40,elbow:20,free:-45,hip:-20,knee:30,lean:3,leftHip:-30,rightHip:12}}]},
  throwForward: {prepTarget:[-120,100], prep:{...held,chest:-10,twist:30,head:-8,free:-60,freeElbow:60,arm:20,hip:10,knee:25,lean:-10,yaw:-40}, phases:[
    {frame:19,target:[150,110],gesture:{...held,chest:34,twist:-20,head:-10,free:-110,freeElbow:0,arm:-45,lean:14,leftHip:-60,rightHip:25,knee:40,yaw:20}},
    {frame:24,target:[170,95],gesture:{...held,chest:42,twist:-28,head:-12,free:-95,freeElbow:0,arm:-25,lean:16,leftHip:-64,rightHip:28,knee:44,yaw:32}},
    {frame:31,target:[130,60],gesture:{...held,chest:30,twist:-15,head:-6,free:-65,freeElbow:20,arm:-10,lean:8,leftHip:-45,rightHip:20,knee:32,yaw:18}}]},
  throwUp: {prepTarget:[-90,60], prep:{...held,chest:36,head:10,free:-40,freeElbow:70,arm:-25,hip:-48,knee:75,lean:6}, phases:[
    {frame:21,target:[-100,110],gesture:{chest:-12,head:-35,arm:-30,elbow:20,free:-175,freeElbow:0,hip:5,knee:0,lean:-8}},
    {frame:24,target:[-105,115],gesture:{chest:-14,head:-35,arm:-30,elbow:20,free:-180,freeElbow:0,hip:4,knee:2,lean:-9}},
    {frame:28,target:[-100,90],gesture:{chest:-2,head:-15,arm:-20,elbow:20,free:-120,freeElbow:20,hip:-8,knee:15,lean:-3}}]},
  grab: {prepTarget:[-90,120], prep:{chest:-14,head:-6,arm:20,elbow:40,free:-40,freeElbow:70,hip:-10,knee:18,lean:-8,step:-8}, phases:[
    {frame:9,target:[-95,125],gesture:{chest:30,head:-16,arm:20,elbow:40,free:-95,freeElbow:0,lean:10,leftHip:-48,rightHip:22,knee:20,step:18}},
    {frame:14,target:[-95,125],gesture:{chest:32,head:-16,arm:20,elbow:40,free:-92,freeElbow:0,lean:11,leftHip:-50,rightHip:23,knee:22,step:20}}]},
  pummel: {prepTarget:[-90,125], prep:{...held,chest:-18,head:-35,hip:-5,knee:10,lean:-6}, phases:[
    {frame:60,target:[-80,130],gesture:{...held,chest:30,head:40,hip:-15,knee:25,lean:8}},
    {frame:63,target:[-80,130],gesture:{...held,chest:26,head:32,hip:-12,knee:22,lean:6}},
    {frame:66,target:[-85,125],gesture:{...held,chest:12,head:12,hip:-6,knee:14,lean:2}}]},
  throwBack: {prepTarget:[120,60], prep:{...held,chest:30,head:-5,free:-60,hip:-35,knee:55,lean:8}, phases:[
    {frame:23,target:[-150,150],gesture:{...held,chest:-26,head:-28,free:-160,hip:5,knee:15,lean:-14}},
    {frame:29,target:[-150,95],gesture:{...held,chest:-18,head:-20,free:-150,hip:0,knee:20,lean:-10}}]},
  throwDown: {prepTarget:[0,250], prep:{chest:-8,head:-22,arm:-145,elbow:10,free:-160,freeElbow:5,hip:2,knee:4,lean:-8}, phases:[
    {frame:24,target:[95,-10],gesture:{chest:65,head:10,arm:-105,elbow:10,free:-95,freeElbow:10,hip:-58,knee:82,lean:18}},
    {frame:31,target:[90,-15],gesture:{chest:70,head:12,arm:-100,elbow:10,free:-90,freeElbow:10,hip:-60,knee:85,lean:20}}]},
};
const authoredBeats=(action:Action,a:Authored):Phase[]=>{const last=a.phases.at(-1)!,settle=Math.round(last.frame+(action.frames-last.frame)*0.55),last2=a.phases.at(-1)!.gesture.yaw;
  const rest:Gesture={...ready,yaw:last2!==undefined&&Math.abs(last2)>180?360:undefined};
  const begin=[{frame:0,gesture:a.first??action.first??ready},{frame:Math.max(1,action.contact-3),gesture:a.prep,target:a.prepTarget},...a.phases];
  if(action.pose==="pummel")return [...begin,{frame:action.frames,gesture:a.first??action.first??ready}];
  if(action.air)return [...begin,{frame:settle,gesture:blend(last.gesture,rest,0.62)},{frame:action.frames-2,gesture:rest},{frame:action.frames,gesture:rest}];
  return [...begin,{frame:settle,gesture:blend(last.gesture,rest,0.62),target:last.target?[last.target[0]*0.5-45,last.target[1]*0.5+30] as const:undefined},{frame:action.frames-1,gesture:rest,idle:true},{frame:action.frames,gesture:rest,idle:true}];};
for (const action of actions) { const a=authored[action.pose]; if (a) action.beats=authoredBeats(action,a); }
const stockDonors: Partial<Record<HeroPose, number>> = { grab: 6, pummel: 10, throwForward: 9 };
const stockHits: Partial<Record<HeroPose, number>> = { pummel: 760 };
for (const action of actions) { const donor = stockDonors[action.pose]; if (donor !== undefined) { action.stock = donor; action.stockHit = stockHits[action.pose]; } }
const horns: Gesture = {chest:45,head:25,arm:30,elbow:25,free:-30,freeElbow:35,step:38};
const stride=(lead:number):Gesture=>({...horns,leftHip:lead>0?-22:18,rightHip:lead>0?18:-22,leftKnee:lead>0?24:14,rightKnee:lead>0?14:24});
const paw=(back:boolean):Gesture=>({chest:8,head:-8,arm:35,elbow:30,free:-20,freeElbow:30,step:-12,leftHip:back?0:-38,leftKnee:back?14:40,rightHip:8,rightKnee:18});
const lower=(back:boolean):Gesture=>({...horns,head:32,step:-4,leftHip:back?-4:-28,leftKnee:back?12:28,rightHip:8,rightKnee:18});
const fling: Gesture = {chest:-30,head:-40,arm:-60,elbow:10,free:-105,freeElbow:5,step:18,leftHip:-28,rightHip:22,leftKnee:4,rightKnee:0};
const brake: Gesture = {chest:16,head:6,arm:10,elbow:20,free:-50,freeElbow:20,step:16,leftHip:-24,rightHip:16,knee:22};
const goreActions: Action[] = [
  {pose:"sideSpecial",gore:"travel",frames:26,contact:11,gesture:horns,beats:[{frame:0,gesture:ready},{frame:2,gesture:paw(false)},{frame:4,gesture:paw(true)},{frame:6,gesture:paw(false)},
    {frame:8,gesture:lower(true)},{frame:10,gesture:lower(false)},{frame:11,gesture:stride(1)},{frame:14,gesture:stride(-1)},{frame:17,gesture:stride(1)},
    {frame:20,gesture:stride(-1)},{frame:23,gesture:stride(1)},{frame:25,gesture:blend(stride(-1),brake,0.35)},{frame:26,gesture:blend(stride(-1),brake,0.5)}]},
  {pose:"sideSpecial",gore:"hold",frames:20,contact:0,gesture:fling,beats:[{frame:0,gesture:{...horns,leftHip:-30,rightHip:20,knee:40}},
    {frame:6,gesture:{...blend(horns,fling,0.3),leftHip:-30,rightHip:20,knee:42}},{frame:13,gesture:{...blend(horns,fling,0.7),leftHip:-28,rightHip:20,knee:22}},
    {frame:17,gesture:{...fling,free:-150,freeElbow:30,chest:-24,head:-30}},{frame:19,gesture:fling},{frame:20,gesture:fling}]},
  {pose:"sideSpecial",gore:"recovery",frames:32,contact:0,gesture:brake,beats:[{frame:0,gesture:brake},{frame:7,gesture:blend(brake,ready,0.45)},
    {frame:14,gesture:blend(brake,ready,0.8)},{frame:21,gesture:ready},{frame:32,gesture:ready}]},
];
const damageActions: Action[] = [];
for (let height=0;height<3;height++) for (let strength=0;strength<3;strength++) {
  const gain=[0.55,0.9,1.3][strength]!;
  const gesture:Gesture = height===0 ? {hip:-55*gain,knee:75*gain,chest:24*gain,head:-12*gain,arm:25*gain,free:35*gain}
    : height===1 ? {chest:48*gain,head:-24*gain,hip:-22*gain,knee:25*gain,arm:-35*gain,free:-45*gain,yaw:18*gain}
    : {head:-50*gain,chest:-28*gain,arm:42*gain,free:55*gain,hip:15*gain,knee:22*gain};
  damageActions.push({pose:"damageGround",frames:24,contact:0,gesture,hold:true,damage:true});
}
function rotation(base: ArrayLike<number>, pitch:number, yaw=0): Float32Array<ArrayBuffer> {
  const q=quat.create(); quat.rotateY(q,q,pitch*Math.PI/180); quat.rotateZ(q,q,yaw*Math.PI/180);
  quat.multiply(q,q,Float32Array.from(base)); quat.normalize(q,q); return new Float32Array(q);
}
const joints:Record<string,(g:Gesture)=>[number,number]>={
  Root:g=>[(g.lean??0)-(g.pitch??0),g.yaw??0], Bone_Chest:g=>[g.chest??0,g.twist??0], Bone_Head:g=>[g.head??0,0],
  Bone_UpperArmR:g=>[g.arm??0,0], Bone_LowerArmR:g=>[g.elbow??0,0], Bone_UpperArmL:g=>[g.free??0,0], Bone_LowerArmL:g=>[g.freeElbow??0,0],
  Bone_UpperlegL:g=>[g.leftHip??g.hip??0,0], Bone_UpperlegR:g=>[g.rightHip??(g.hip??0)*0.55,0], Bone_Leg2L:g=>[g.leftKnee??g.knee??0,0], Bone_Leg2R:g=>[g.rightKnee??g.knee??0,0],
  Bone_Leg3L:g=>[g.leftShin??g.shin??0,0], Bone_Leg3R:g=>[g.rightShin??g.shin??0,0], Bone_FootL:g=>[g.leftHoof??g.hoof??0,0], Bone_FootR:g=>[g.rightHoof??g.hoof??0,0], Bone_Pelvis:g=>[g.pelvis??0,0],
};
const joint=(name:string,g:Gesture):[number,number]=>Object.hasOwn(joints,name)?joints[name]!(g):[0,0];
const originals=new Map<string,mdx.AnimVector>(); tracks(source,(track,path)=>originals.set(path,track));
const render=new ModelRenderer(model), data=Reflect.get(render,"rendererData");
const hand=model.Nodes.find(n=>n.Name==="Bone_HandR")!,weapon=model.Nodes.find(n=>n.Name==="Bone_Axe_Free")!,main=model.Nodes.find(n=>n.Name==="Main")!;
const evaluate=(index:number,frame:number)=>{render.setSequence(index);data.frame=model.Sequences[index]!.Interval[0]+Math.round(frame*1000/60);render.update(0);};
evaluate(4,0);
const handRest=mat4.clone(data.nodes[hand.ObjectId].matrix),axeRest=mat4.clone(data.nodes[weapon.ObjectId].matrix),offset=mat4.create();
ensure(mat4.invert(offset,handRest),"Hand's stock pose is singular"); mat4.multiply(offset,offset,axeRest);
const weaponRef=model.Nodes.find(n=>n.Name==="Weapon Ref")!,weaponPivot=model.PivotPoints[weaponRef.ObjectId]!,handPivot=vec3.fromValues(model.PivotPoints[hand.ObjectId]![0]!,model.PivotPoints[hand.ObjectId]![1]!,model.PivotPoints[hand.ObjectId]![2]!);
const weaponPoint=vec3.fromValues(weaponPivot[0]!,weaponPivot[1]!,weaponPivot[2]!);vec3.transformMat4(weaponPoint,weaponPoint,data.nodes[weaponRef.ObjectId].matrix);
const inverseHand=mat4.create();ensure(mat4.invert(inverseHand,handRest),"Hand pose is singular");vec3.transformMat4(weaponPoint,weaponPoint,inverseHand);
const shaft=vec3.normalize(vec3.create(),vec3.subtract(vec3.create(),weaponPoint,handPivot)),unpivot=vec3.create();
const bladeNormal=vec3.fromValues(0,1,0);{const turn=mat3.create();mat3.fromMat4(turn,inverseHand);vec3.transformMat3(bladeNormal,bladeNormal,turn);vec3.normalize(bladeNormal,bladeNormal);}
evaluate(0,0);const idleOffset=mat4.create();ensure(mat4.invert(idleOffset,data.nodes[hand.ObjectId].matrix),"Hand's idle pose is singular");mat4.multiply(idleOffset,idleOffset,data.nodes[weapon.ObjectId].matrix);
const mixMatrix=(a:mat4,b:mat4,t:number)=>{const qa=quat.create(),qb=quat.create(),ta=vec3.create(),tb=vec3.create(),out=mat4.create();mat4.getRotation(qa,a);mat4.getRotation(qb,b);mat4.getTranslation(ta,a);mat4.getTranslation(tb,b);
  quat.slerp(qa,qa,qb,t);vec3.lerp(ta,ta,tb,t);return mat4.fromRotationTranslation(out,quat.normalize(qa,qa),ta);};
const feet=["Foot Left Ref ","Foot Right Ref "].map(name=>model.Nodes.find(n=>n.Name===name)!);
const soles=()=>Math.min(...feet.map(foot=>{const pivot=model.PivotPoints[foot.ObjectId]!,at=vec3.fromValues(pivot[0]!,pivot[1]!,pivot[2]!);vec3.transformMat4(at,at,data.nodes[foot.ObjectId].matrix);return at[2]!;}));
evaluate(4,0);const soleRest=soles()-Math.min(...[...new DrawnModel(generateMDX(source),1).triangles(4,0,1)].filter((_,i)=>i%2===1));
const resting=(path:string,like:ArrayLike<number>)=>path.endsWith("Rotation")?new Float32Array([0,0,0,1]):path.endsWith("Scaling")?new Float32Array([1,1,1]):path.endsWith("Translation")?new Float32Array(3):Float32Array.from(like);
const ease=(t:number)=>t*t*(3-2*t);
const along=(phases:readonly Phase[],frame:number,value:(phase:Phase)=>number)=>{const after=phases.findIndex(p=>p.frame>=frame);if(after<=0)return value(phases[Math.max(0,after)]??phases[phases.length-1]!);
  const a=phases[after-1]!,b=phases[after]!;return value(a)+(value(b)-value(a))*ease((frame-a.frame)/(b.frame-a.frame));};
const farthestReach=(clip:number)=>{const [first,last]=source.Sequences[clip]!.Interval;let best=-Infinity,at=0;
  for(let frame=0;frame*1000/60<=last-first;frame++){evaluate(clip,frame);const tip=vec3.fromValues(weaponPivot[0]!,weaponPivot[1]!,weaponPivot[2]!);vec3.transformMat4(tip,tip,data.nodes[weaponRef.ObjectId].matrix);
    if(tip[0]!>best){best=tip[0]!;at=Math.round(frame*1000/60);}}
  return at;};
let cursor=Math.max(...source.Sequences.map(s=>s.Interval[1]))+100;
const bindings:string[]=[],damageBindings:string[]=[],goreBindings:string[]=[],records:{pose:string;index:number;frames:number;contact:number}[]=[];
for (const [ordinal,action] of [...actions,...damageActions,...goreActions].entries()) {
  const index=model.Sequences.length,start=cursor,end=start+Math.round(action.frames*1000/60);cursor=end+100;
  const name=action.gore?`Cairne Gore ${action.gore}`:action.damage?`Cairne Pain ${Math.floor((ordinal-actions.length)/3)} ${(ordinal-actions.length)%3}`:`Cairne ${action.pose}`;
  model.Sequences.push({...stand,Name:name,Interval:new Uint32Array([start,end]),NonLooping:!action.hold,MoveSpeed:0,Rarity:0,
    MinimumExtent:new Float32Array([-320,-320,-200]),MaximumExtent:new Float32Array([320,320,360]),BoundsRadius:440});
  if(action.stock!==undefined){const [stockFirst,last]=source.Sequences[action.stock]!.Interval,first=stockFirst+(action.stockFrom??0),hit=stockFirst+(action.stockHit??farthestReach(action.stock)),contact=start+Math.round(action.contact*1000/60);
    const wind=Math.max(start,contact-(hit-first)),tail=Math.min(end,contact+(last-hit));
    const retimed=(frame:number)=>frame<=hit?wind+Math.round((frame-first)/Math.max(1,hit-first)*(contact-wind)):contact+Math.round((frame-hit)/Math.max(1,last-hit)*(tail-contact));
    tracks(model,(track,path)=>{const donor=originals.get(path);if(!donor||onGlobalClock(donor))return;const placed=new Set<number>();
      const flat=(key:mdx.AnimKeyframe,Frame:number):mdx.AnimKeyframe=>{const copy={...structuredClone(key),Frame};if(path.endsWith(".Rotation")||!copy.InTan)return copy;
        const handle=()=>track.LineType===mdx.LineType.Bezier?copy.Vector.slice():new Float32Array(copy.Vector.length);return {...copy,InTan:handle(),OutTan:handle()};};
      const inside=donor.Keys.filter(key=>key.Frame>=first&&key.Frame<=last);
      for(const key of inside){const Frame=retimed(key.Frame);if(placed.has(Frame))continue;placed.add(Frame);track.Keys.push(flat(key,Frame));}
      if(inside.length&&!placed.has(start))track.Keys.push(flat(inside[0]!,start));
      if(inside.length&&!placed.has(end))track.Keys.push(flat(inside.at(-1)!,end));
      const stance=donor.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);
      if(action.settleFrom!==undefined&&stance&&inside.length){const cut=start+Math.round(action.settleFrom*1000/60);
        track.Keys=track.Keys.filter(k=>k.Frame<=cut||k.Frame>end);track.Keys.push(flat(stance,end));}
      if(action.settleFrom!==undefined&&stance&&!inside.length)track.Keys.push(flat(stance,start),flat(stance,end));
      track.Keys.sort((a,b)=>a.Frame-b.Frame);});
  }else{
  const coil=blend(ready,action.gesture,-0.32);
  const phases:Phase[]=action.beats ? [...action.beats] : action.roll ? [0,0.12,0.25,0.5,0.75,0.9,1].map(t=>({frame:Math.round(t*action.frames),gesture:{...blend(ready,brace,t===0||t===1?0:1),lean:t*360*action.roll!}})) : action.hold ? [{frame:0,gesture:action.gesture},{frame:action.frames,gesture:action.gesture}] : [
    {frame:0,gesture:action.first??ready},{frame:Math.max(1,action.contact-3),gesture:action.pose==="neutralSpecial"||action.pose==="neutralSpecialAir"
      ? action.phases?.find(phase=>phase.frame===action.contact-1)?.gesture??ready : blend(action.first??ready,coil,0.75)},
    ...(action.phases ?? [{frame:action.contact,gesture:action.gesture,target:action.target},{frame:Math.min(action.frames-1,action.contact+4),gesture:action.gesture,target:action.target}]),
    {frame:action.frames,gesture:action.pose==="pummel"||action.pose==="victimPummel"?action.first??ready:ready},
  ].sort((a,b)=>a.frame-b.frame).filter((p,i,array)=>i===0||p.frame!==array[i-1]?.frame);
  tracks(model,(track,path)=>{
    const donor=originals.get(path); if(!donor||onGlobalClock(donor))return;
    const first=donor.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);if(!first)return;
    const idleKey=donor.Keys.find(k=>k.Frame>=idleSequence.Interval[0]&&k.Frame<=idleSequence.Interval[1])??{...first,Vector:resting(path,first.Vector)};
    const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path),node=match?source[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
    for(const phase of phases){const base=phase.idle?idleKey:first;const [pitch,yaw]=node?joint(node.Name,phase.gesture):[0,0];const Vector=node?rotation(base.Vector,pitch,yaw):base.Vector.slice();
      const tangent=()=>match||track.LineType===mdx.LineType.Bezier?Vector.slice():new Float32Array(Vector.length);
      track.Keys.push({...base,Frame:start+Math.round(phase.frame*1000/60),Vector,...first.InTan?{InTan:tangent(),OutTan:tangent()}: {}});}
  });


  const shoulder=model.Nodes.find(n=>n.Name==="Bone_UpperArmR")!,elbow=model.Nodes.find(n=>n.Name==="Bone_LowerArmR")!;
  const baseline=(node:mdx.Node)=>source.Nodes[node.ObjectId]!.Rotation!.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1])!.Vector;
  for(const phase of phases)if(phase.target){
    const armKey=shoulder.Rotation!.Keys.find(k=>k.Frame===start+Math.round(phase.frame*1000/60))!,elbowKey=elbow.Rotation!.Keys.find(k=>k.Frame===start+Math.round(phase.frame*1000/60))!;
    const angles=[phase.gesture.arm??0,0,phase.gesture.elbow??0,0],authored=angles.slice(),pull=action.beats?0.05:0,depth=0.5,flat=3000;
    const loss=()=>{armKey.Vector=rotation(baseline(shoulder),angles[0]!,angles[1]!);elbowKey.Vector=rotation(baseline(elbow),angles[2]!,angles[3]!);
      evaluate(index,phase.frame);const facingCamera=()=>{const turn=mat3.create(),n=vec3.create();mat3.fromMat4(turn,data.nodes[hand.ObjectId].matrix);vec3.transformMat3(n,bladeNormal,turn);return n[1]!/vec3.length(n);};const point=vec3.scaleAndAdd(vec3.create(),weaponPoint,shaft,phase.gesture.slide??0);vec3.transformMat4(point,point,data.nodes[hand.ObjectId].matrix);
      const plane=phase.gesture.depth,grip=vec3.create();if(phase.grip||plane!==undefined)vec3.transformMat4(grip,handPivot,data.nodes[hand.ObjectId].matrix);
      return (point[0]!-phase.target![0])**2+(point[2]!-phase.target![1])**2+(phase.grip?(grip[0]!-phase.grip[0])**2+(grip[2]!-phase.grip[1])**2:0)+(plane===undefined?depth*point[1]!**2:4*((point[1]!-plane)**2+(grip[1]!-plane)**2))+flat*(1-Math.abs(facingCamera()))**2+pull*angles.reduce((sum,angle,axis)=>sum+(angle-authored[axis]!)**2,0);};
    for(let pass=0;pass<4;pass++)for(let axis=0;axis<4;axis++){let best=Infinity,bestAngle=angles[axis]!;for(let centre=pull?authored[axis]!:0,angle=centre-180;angle<=centre+180;angle+=pass<2?15:5){angles[axis]=angle;const value=loss();if(value<best){best=value;bestAngle=angle;}}angles[axis]=bestAngle;}
    loss();for(const key of [armKey,elbowKey])if(key.InTan){key.InTan=key.Vector.slice();key.OutTan=key.Vector.slice();}
  }


  const addTransform=(node:mdx.Node,frame:number,matrix:mat4)=>{
    const pivot=model.PivotPoints[node.ObjectId]!,q=quat.create(),p=vec3.fromValues(pivot[0]!,pivot[1]!,pivot[2]!),v=vec3.create();
    mat4.getRotation(q,matrix);quat.normalize(q,q);vec3.transformQuat(v,p,q);
    const translation=new Float32Array([matrix[12]!-p[0]!+v[0]!,matrix[13]!-p[1]!+v[1]!,matrix[14]!-p[2]!+v[2]!]);
    for(const [property,Vector]of [["Rotation",new Float32Array(q)],["Translation",translation]] as const){
      const track=node[property];ensure(track,`${node.Name}: no ${property}`);const existing=track.Keys.find(k=>k.Frame===start+Math.round(frame*1000/60));
      const key={Frame:start+Math.round(frame*1000/60),Vector,...track.LineType>1?{InTan:property==="Rotation"?Vector.slice():new Float32Array(3),OutTan:property==="Rotation"?Vector.slice():new Float32Array(3)}: {}};
      if(existing)Object.assign(existing,key);else track.Keys.push(key);
    }
  };
  const settled=phases.findIndex(p=>p.idle),idleFrom=settled>0?phases[settled-1]!.frame:Infinity,idleAt=settled>0?phases[settled]!.frame:Infinity;
  const idleWeight=(frame:number)=>frame<=idleFrom?0:Math.min(1,(frame-idleFrom)/(idleAt-idleFrom));
  for(let frame=0;frame<=action.frames;frame++){
    evaluate(index,frame);const world=mat4.create(),local=mat4.create();mat4.multiply(world,data.nodes[hand.ObjectId].matrix,mixMatrix(offset,idleOffset,idleWeight(frame)));
    const spin=along(phases,frame,p=>p.gesture.spin??0),slide=along(phases,frame,p=>p.gesture.slide??0);if(spin!==0||slide!==0){const turn=mat4.create();mat4.translate(turn,turn,vec3.scale(vec3.create(),shaft,slide));mat4.translate(turn,turn,handPivot);mat4.rotate(turn,turn,spin*Math.PI/180,shaft);vec3.negate(unpivot,handPivot);mat4.translate(turn,turn,unpivot);mat4.multiply(world,data.nodes[hand.ObjectId].matrix,mat4.multiply(turn,turn,mixMatrix(offset,idleOffset,idleWeight(frame))));}
    ensure(mat4.invert(local,data.nodes[main.ObjectId].matrix),"Main pose is singular");mat4.multiply(local,local,world);addTransform(weapon,frame,local);
  }
  weapon.Rotation!.Keys.sort((a,b)=>a.Frame-b.Frame);weapon.Translation!.Keys.sort((a,b)=>a.Frame-b.Frame);

  const drawn=new DrawnModel(generateMDX(model),1);const rootTrack=main.Translation!;
  if(!action.air){const mainKeys=source.Nodes[main.ObjectId]!.Translation!.Keys,mainDonor=mainKeys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1])!,mainIdle=mainKeys.find(k=>k.Frame>=idleSequence.Interval[0]&&k.Frame<=idleSequence.Interval[1])??{...mainDonor,Vector:resting(".Translation",mainDonor.Vector)};
    for(let frame=0;frame<=action.frames;frame++){const vertices=drawn.triangles(index,frame/60,1);let floor=Infinity;for(let i=1;i<vertices.length;i+=2)floor=Math.min(floor,vertices[i]!);
      if(action.beats){evaluate(index,frame);floor=soles()-soleRest;}
      const Frame=start+Math.round(frame*1000/60),w=idleWeight(frame),Vector=mainDonor.Vector.map((v,i)=>v*(1-w)+mainIdle.Vector[i]!*w);Vector[2]=Vector[2]!-floor;
      if(action.beats)Vector[0]=Vector[0]!+along(action.beats,frame,p=>p.gesture.step??0);
      if(action.prepTravel&&frame<action.contact){const wind=Math.max(1,action.contact-3);Vector[0]=Vector[0]!-action.prepTravel*(frame<=wind?frame/wind:(action.contact-frame)/(action.contact-wind));}
      const key={Frame,Vector,...rootTrack.LineType>1?{InTan:new Float32Array(3),OutTan:new Float32Array(3)}:{}};
      const previous=rootTrack.Keys.find(k=>k.Frame===Frame);if(previous)Object.assign(previous,key);else rootTrack.Keys.push(key);}
    rootTrack.Keys.sort((a,b)=>a.Frame-b.Frame);}
  else if(action.beats?.some(b=>b.gesture.rise!==undefined)){const mainDonor=source.Nodes[main.ObjectId]!.Translation!.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1])!;
    for(let frame=0;frame<=action.frames;frame++){const Frame=start+Math.round(frame*1000/60),Vector=mainDonor.Vector.slice();Vector[2]=Vector[2]!+along(action.beats,frame,p=>p.gesture.rise??0);
      const key={Frame,Vector,...rootTrack.LineType>1?{InTan:new Float32Array(3),OutTan:new Float32Array(3)}:{}};
      const previous=rootTrack.Keys.find(k=>k.Frame===Frame);if(previous)Object.assign(previous,key);else rootTrack.Keys.push(key);}
    rootTrack.Keys.sort((a,b)=>a.Frame-b.Frame);}
  }
  const duration=(end-start)/1000;
  const victimContact=action.pose.startsWith("victim");
  const contact=action.pose.startsWith("throw")||victimContact||action.pose==="pummel"?`, contact: ${seconds(victimContact?0.5:action.contact/60)}`:"";
  const binding=`{ index: ${index}, seconds: ${seconds(victimContact?1:duration)}, aligned: true${contact} }`;
  if(action.gore)goreBindings.push(`  ${action.gore}: { index: ${index}, seconds: ${seconds(duration)} },`);else if(action.damage)damageBindings.push(`  ${binding},`);else bindings.push(`  ${action.pose}: ${binding},`);
  records.push({pose:name,index,frames:victimContact?60:action.frames,contact:victimContact?30:action.contact});
}

for(const [ordinal,action]of actions.entries())if(action.pose.startsWith("victim")){
  const sequence=model.Sequences[source.Sequences.length+ordinal]!,[first,last]=sequence.Interval,contact=first+Math.round(action.contact*1000/60),start=cursor;cursor=start+1100;
  tracks(model,track=>{if(onGlobalClock(track))return;for(const key of track.Keys)if(key.Frame>=first&&key.Frame<=last)key.Frame=start+(key.Frame<=contact?Math.round((key.Frame-first)/(contact-first)*500):500+Math.round((key.Frame-contact)/(last-contact)*500));track.Keys.sort((a,b)=>a.Frame-b.Frame);});
  sequence.Interval=new Uint32Array([start,start+1000]);
}
const bytes=encodeVerified(parseSource(generateMDX(model)));mkdirSync(output,{recursive:true});await Bun.write(join(output,"herotaurenchieftain.mdx"),bytes);
await Bun.write(join(project,"ts/src/game/presentation/heroes/cairneClips.ts"),[
  "// Generated by tools/animations/cairne-clips.ts; regenerate instead of editing.", 'import { f32 } from "wisp/src/sim/f32";', 'import type { CommandGrabClips, HeroClip, HeroClipTable } from "../../sim/heroes/hero";',
  'export const CAIRNE_FALLBACK: HeroClip = { index: 4, seconds: 2.0 };',
  'export const CAIRNE_CLIPS = { idle: { index: 0, seconds: f32(2.667) }, walk: { index: 3, seconds: 1.0 }, dash: { index: 3, seconds: 1.0 }, run: { index: 3, seconds: 1.0 }, ko: { index: 11, seconds: 2.0 },',
  ...bindings,'} as const satisfies HeroClipTable;', 'export const CAIRNE_DAMAGE_CLIPS: readonly HeroClip[] = [',...damageBindings,'];','export const CAIRNE_COMMAND_GRAB = {',...goreBindings,'} as const satisfies CommandGrabClips;',"",
].join("\n"));
const before=new DrawnModel(generateMDX(source),1),after=new DrawnModel(bytes,1);
const strides:DrawnStride[]=Object.entries(DRAWN_STRIDES).flatMap(([character,row])=>row===undefined||Number(character)===Character.cairne?[]:
  (["walk","run"] as const).map(motion=>({character:Number(character) as Character,motion,...row[motion]})));
for(const motion of ["walk","run"] as const)strides.push(measureDrawnStride(bytes,after,Character.cairne,motion,"units\\orc\\HeroTaurenChieftain\\HeroTaurenChieftain.mdl"));
await Bun.write(join(project,"ts/src/game/presentation/drawnStrideInfo.ts"),drawnStrideSource(strides));
let preserved=0;
for(const [index,sequence]of source.Sequences.entries())for(const part of [0,0.5,1]){const time=(sequence.Interval[1]-sequence.Interval[0])*part/1000,a=before.triangles(index,time,1),b=after.triangles(index,time,1);
  ensure(a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i]!)<0.001),`${sequence.Name}: stock pose changed`);preserved++;}
const motions=actions.map((action,ordinal)=>{const index=source.Sequences.length+ordinal,first=after.triangles(index,0,1),contact=after.triangles(index,action.pose.startsWith("victim")?0.5:action.contact/60,1);let motion=0;
  ensure(first.length>0&&contact.length===first.length,`${action.pose}: body missing`);for(let i=0;i<first.length;i+=2)motion=Math.max(motion,Math.hypot(contact[i]!-first[i]!,contact[i+1]!-first[i+1]!));
  if(!action.hold)ensure(motion>=8,`${action.pose}: no local gesture (${motion})`);return {pose:action.pose,motion};});
const pain=damageActions.map((_,ordinal)=>after.triangles(source.Sequences.length+actions.length+ordinal,0,1));
for(let a=0;a<pain.length;a++)for(let b=a+1;b<pain.length;b++)ensure(pain[a]!.some((v,i)=>Math.abs(v-pain[b]![i]!)>2),`Pain ${a}/${b}: same silhouette`);
const framed={sequenceStart:(clip:number)=>after.sequenceStart(clip),triangles:(clip:number,at:number,facing:number)=>{const t=after.triangles(clip,at,facing).slice();for(let i=1;i<t.length;i+=2)t[i]=t[i]!*0.7-30;for(let i=0;i<t.length;i+=2)t[i]=t[i]!*0.8;return t;}} as unknown as DrawnModel;
for(const pose of ["jab","jab2","forwardTilt","upTilt","downTilt","dashAttack","forwardSmash","upSmash","smashCharge","downSmash","neutralAir","forwardAir","backAir","upAir","downAir","getUpAttack","ledgeAttack","grab","pummel","neutralSpecial","sideSpecial","upSpecial","downSpecial","rollForward","throwForward","throwBack","throwUp","throwDown"] as const){
  const ordinal=actions.findIndex(a=>a.pose===pose),action=actions[ordinal]!;
  const panels:PoseFrame[]=[1,-1].flatMap(facing=>(action.beats?action.beats.map(b=>b.frame):[0,Math.max(1,action.contact-3),action.contact,Math.min(action.frames,action.contact+4),action.frames]).map(frame=>({frame,phase:frame<action.contact?AttackPhase.startup:frame<=action.contact+4?AttackPhase.active:AttackPhase.recovery,x:0,z:0,facing,parts:[],strikes:[],clip:source.Sequences.length+ordinal,seconds:frame/60})));
  await Bun.write(join(output,`${pose}.png`),sheet(`Cairne ${pose}`,framed,panels,panels.length/2).png);
}
for(const [ordinal,action]of goreActions.entries()){const clip=source.Sequences.length+actions.length+damageActions.length+ordinal;
  const panels:PoseFrame[]=[1,-1].flatMap(facing=>action.beats!.map(b=>({frame:b.frame,phase:AttackPhase.active,x:0,z:0,facing,parts:[],strikes:[],clip,seconds:b.frame/60})));
  await Bun.write(join(output,`gore-${action.gore}.png`),sheet(`Cairne gore ${action.gore}`,framed,panels,panels.length/2).png);
}
await Bun.write(join(output,"cairne-clips.json"),JSON.stringify({stockSequences:source.Sequences.length,preservedSamples:preserved,appended:records.length,records,motions},null,2)+"\n");
console.log(`CAIRNE_CLIPS_PASS ${records.length} clips; ${preserved} stock pose samples retained; nine distinct first pain poses; ${output}`);
