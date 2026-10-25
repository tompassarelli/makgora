import { NO_GLOBAL_SEQ } from './animVector';

import { mkdirSync } from "node:fs";
import { mat4, quat, vec3 } from "../../ts/node_modules/gl-matrix";
import { join, relative, resolve } from "node:path";
import { generateMDX, ModelRenderer, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sheet } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase, AttackStyle, Character, GrabAction } from "../../ts/src/game/sim/codes";
import { heroDefinition } from "../../ts/src/game/sim/heroes/registry";
import { seconds } from "./asset-info";
import { swordGestureBaseModel } from "./recovery-model";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";
import { fighters } from "../../ts/scripts/heroModelSource";

const [input, output] = process.argv.slice(2, 4).map(p => resolve(p));
const replaceOnly = process.argv.includes("--in-place");
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/blademaster-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--in-place]");
const fighter = fighters.get(Character.blademaster)!; ensure(fighter, "missing Blademaster");
const shipped = parseSource(await Bun.file(join(input, fighter.source)).arrayBuffer());
const source = replaceOnly ? shipped : swordGestureBaseModel(shipped) ?? shipped;
const sword = source.Nodes.find(n => n?.Name === "Sword"), rightHand = source.Nodes.find(n => n?.Name === "Bone_Hand_R");
ensure(sword && rightHand, "missing sword grip");
if (!replaceOnly) {
  const grip = new Float32Array([94.21669006347656, -66.13787841796875, 72.99081420898438]);
  sword.PivotPoint = grip; source.PivotPoints[sword.ObjectId] = grip;
  const gripOffset = Float32Array.from(grip, (value, axis) => rightHand.PivotPoint[axis]! - value);
  sword.Translation = { LineType: mdx.LineType.Linear, GlobalSeqId: NO_GLOBAL_SEQ, Keys: source.Sequences.flatMap(s => [s.Interval[0], s.Interval[1]].map(Frame => ({ Frame, Vector: gripOffset.slice() }))) };
  const lateralBladeClips = new Map([["Attack Slam", 50], ["Stand - 4", 50], ["Portrait 1", 50], ["Damage Grid Mid Large", 50], ["Jump Motion doubleJump", 50], ["Paired Grab victimThrowDown", -1]]);
  for (const [name, lateral] of lateralBladeClips) {
    const index = source.Sequences.findIndex(s => s.Name === name), sequence = source.Sequences[index];
    ensure(sequence && sword.Rotation, `missing ${name} sword motion`);
    const renderer = new ModelRenderer(source), data = Reflect.get(renderer, "rendererData") as { frame: number; nodes: { matrix: Float32Array }[] };
    const keys: mdx.AnimVector["Keys"] = [];
    for (let frame = sequence.Interval[0], step = 0;; frame = Math.min(sequence.Interval[1], frame + 1000 / 60), step++) {
      renderer.setSequence(index); data.frame = frame; renderer.update(0);
      const world = data.nodes[sword.ObjectId]!.matrix, parent = data.nodes[rightHand.ObjectId]!.matrix;
      const hand = vec3.transformMat4(vec3.create(), grip, world);
      const tip = vec3.transformMat4(vec3.create(), [90.45929718017578, 63.46139907836914, 82.50170135498047], world);
      const direction = vec3.sub(vec3.create(), tip, hand), outward = vec3.clone(direction);
      if (lateral < 0) { const [azimuth, elevation] = [step >= 28 && step <= 36 ? 200 : 220, step === 29 ? 90 : 60].map(d => d * Math.PI / 180); vec3.set(outward, Math.cos(elevation) * Math.cos(azimuth), Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation)); }
      else outward[1] = (hand[1] < 0 ? -1 : 1) * (Math.abs(direction[1]) + lateral);
      const turn = quat.rotationTo(quat.create(), vec3.normalize(vec3.create(), direction), vec3.normalize(vec3.create(), outward));
      const aimed = quat.multiply(quat.create(), turn, mat4.getRotation(quat.create(), world));
      const Vector = new Float32Array(quat.normalize(quat.create(), quat.multiply(quat.create(), quat.invert(quat.create(), mat4.getRotation(quat.create(), parent)), aimed)));
      keys.push({ Frame: Math.round(frame), Vector, InTan: Vector.slice(), OutTan: Vector.slice() });
      if (frame === sequence.Interval[1]) break;
    }
    sword.Rotation.Keys = sword.Rotation.Keys.filter(k => k.Frame < sequence.Interval[0] || k.Frame > sequence.Interval[1]).concat(keys).sort((a, b) => a.Frame - b.Frame);
  }
}
const model = structuredClone(source), hero = heroDefinition(Character.blademaster); ensure(hero, "missing moves");
const stand = source.Sequences.find(s => s.Name === "Stand Ready"); ensure(stand, "missing guard");
type V = readonly [number, number, number];
interface Figure { pitch: number; chest: number; chestTwist: number; pelvis: number; pelvisTwist: number; left: readonly [number, number]; right: readonly [number, number] }
interface Pose { hand: V; tip: V; lean: number; twist: number; knee: number; offhand: number; legSplit:number; drop:number; pitch:number; figure?: Figure }
const pose = (hand: V, tip: V, lean = 0, twist = 0, knee = 12, offhand = 25, legSplit=0, drop=0, pitch=0): Pose => ({hand, tip, lean, twist, knee, offhand, legSplit, drop, pitch});
const guard = pose([26,-25,100],[100,-25,145]);
const coil = pose([-16,-25,135],[-65,-20,180],-12,-20,24,35);
interface Body { lean: number; twist: number; knee: number; offhand: number; drop: number; pitch: number }
const swing = (x: number, z: number, degrees: number, b: Body) =>
  pose([x,-24,z],[x+100*Math.cos(degrees*Math.PI/180),-24,z+100*Math.sin(degrees*Math.PI/180)],b.lean,b.twist,b.knee,b.offhand,0,b.drop,b.pitch);
interface Stance extends Partial<Omit<Figure, "left" | "right">> { left: readonly [number, number]; right: readonly [number, number]; drop: number; offhand?: number }
const figure = (x: number, z: number, degrees: number, s: Stance): Pose => {
  const f: Figure = {pitch:0,chest:0,chestTwist:0,pelvis:0,pelvisTwist:0,...s};
  return {...swing(x,z+s.drop,degrees,{lean:f.chest,twist:f.chestTwist,knee:0,offhand:s.offhand??55,drop:s.drop,pitch:f.pitch}),figure:f};
};
const fallReady = figure(12,74,-128,{pitch:4,chest:8,left:[40,70],right:[18,48],drop:0,offhand:45});
const airborne: readonly string[] = ["neutralAir","forwardAir","backAir","upAir"];
const gestures = [
  {key:"jab",name:"Jab Quick Cut",style:AttackStyle.jab,prep:pose([10,-50,120],[-45,-50,170],-5,-12),hit:pose([46,-24,76],[128,-24,65],8,8,16),exit:pose([42,-25,64],[65,-24,12],12,16)},
  {key:"jab2",name:"Jab Returning Cut",style:AttackStyle.jab2,prep:pose([30,-24,58],[78,-24,8],14,18),hit:pose([48,-24,74],[135,-24,91],3,-12,20),exit:pose([15,-25,126],[-40,-24,160],-4,-20)},
  {key:"forwardTilt",name:"Tilt Level Cut",style:AttackStyle.forwardTilt,prep:coil,hit:pose([50,-24,86],[145,-24,85],12,12,20),exit:pose([45,-25,62],[85,-25,5],18,25,28)},
  {key:"forwardTiltUp",name:"Tilt Rising Cut",style:AttackStyle.forwardTiltUp,prep:pose([-12,-50,72],[-60,-50,20],15,-18,26),hit:pose([40,-24,115],[115,-24,182],-8,14,14),exit:pose([30,-50,115],[-15,-50,235],-12,24)},
  {key:"forwardTiltDown",name:"Tilt Falling Cut",style:AttackStyle.forwardTiltDown,prep:pose([6,-24,132],[-40,-24,206],-12,-18),hit:pose([48,-24,60],[132,-24,18],20,10,34),exit:pose([25,-50,46],[42,-50,-15],28,22,38)},
  {key:"upTilt",name:"Tilt Overhead Arc",style:AttackStyle.upTilt,prep:pose([32,-25,72],[100,-25,22],10,-15),hit:pose([12,-25,143],[25,-25,236],-10,8,14),exit:pose([-32,-25,124],[-114,-25,154],-7,20)},
  {key:"downTilt",name:"Tilt Low Poke",style:AttackStyle.downTilt,prep:pose([-22,-50,65],[-85,-50,95],16,-24,40,45),hit:pose([48,-50,43],[145,-50,20],27,8,44,55),exit:pose([42,-50,40],[136,-50,8],24,12,40)},
  {key:"dashAttack",name:"Dash Lunging Cut",style:AttackStyle.dashAttack,prep:pose([-8,-25,104],[-75,-25,147],6,-28,28),hit:pose([61,-24,80],[155,-24,58],28,18,34,65),exit:pose([52,-24,56],[116,-24,-8],30,30,40)},
  {key:"forwardSmash",name:"Smash Shoulder Cleave",style:AttackStyle.forwardSmash,prep:pose([-25,-24,139],[-65,-24,220],-20,-32,36,60),hit:pose([52,-24,112],[150,-24,50],35,35,50,80),exit:pose([44,-24,48],[96,-24,-20],32,40,42)},
  {key:"upSmash",name:"Smash Sky Splitter",style:AttackStyle.upSmash,prep:pose([-8,-24,58],[-62,-24,0],24,-20,48,50),hit:pose([12,-24,150],[12,-24,252],-16,10,10,65),exit:pose([-25,-24,143],[-88,-24,214],-10,22,18)},
  {key:"downSmash",name:"Smash Front Rear Sweep",style:AttackStyle.downSmash,prep:pose([-22,-50,65],[-85,-50,95],16,-24,40,45),hit:pose([50,-50,40],[146,-50,12],18,35,72,90),exit:pose([-48,-50,39],[-146,-50,8],23,-35,65,70),second:16},
  {key:"neutralAir",name:"Air Crescent Slash",style:AttackStyle.neutralAir,lift:[2,pose([-12,-24,104],[-110,-24,120],-6,-12,44,48)],prep:pose([-15,-24,121],[-70,-24,172],-9,-18,48,50),hit:pose([48,-24,99],[140,-24,117],4,12,38,55),carry:[[9,pose([40,-24,52],[120,-24,0],14,16,40,60)],[11,pose([4,-24,58],[-40,-24,-30],6,-6,46,62)]],exit:pose([-40,-24,96],[-130,-24,121],-5,-25,54,65),second:12},
  {key:"forwardAir",name:"Air Forward Cleave",style:AttackStyle.forwardAir,lift:[3,pose([-14,-24,108],[-114,-24,112],-8,-14,50,48)],prep:pose([-20,-24,140],[-90,-24,212],-15,-22,55,50),hit:pose([52,-24,95],[140,-24,49],16,18,40,60),exit:pose([43,-24,52],[90,-24,-25],22,30,64,65)},
  {key:"backAir",name:"Air Turning Back Cut",style:AttackStyle.backAir,lift:[2,pose([8,-24,128],[12,-24,228],-4,8,48,45)],prep:pose([26,-24,130],[95,-24,192],-10,20,52,45),hit:pose([-42,-24,100],[-138,-24,83],-12,-55,44,65,35),exit:pose([-58,-24,84],[-150,-24,40],-10,-62,58,60,28),second:10,settle:[[31,fallReady]]},
  {key:"upAir",name:"Air Upward Pierce",style:AttackStyle.upAir,prep:pose([10,-24,82],[52,-24,0],20,-12,62,45,0,-6),hit:pose([7,-24,151],[7,-24,250],-14,10,80,70,65,4),exit:pose([-2,-24,128],[-58,-24,216],-10,6,64,55,35,-2),settle:[[16,pose([-20,-24,124],[-110,-24,170],-8,-4,62,52,25,-2)],[21,pose([-6,-24,90],[-80,-24,22],-2,-2,50,47,8)],[25,fallReady]]},
  {key:"throwBack",name:"Throw Back Heave",style:undefined,prep:pose([40,-24,105],[100,-24,148],10,18,30,75),hit:pose([-40,-24,140],[-125,-24,196],-18,-45,28,90),exit:pose([-30,-24,119],[-100,-24,150],-6,-55,20,55)},
] as const;
const replacements = [
  {key:"downAir",name:"Down Air Sword Plunge",style:AttackStyle.downAir,keys:[
    [0,fallReady],
    [3,figure(-10,128,120,{pitch:-20,chest:-14,left:[60,100],right:[45,90],drop:10,offhand:40})],
    [5,figure(-30,140,160,{pitch:-34,chest:-20,chestTwist:-24,pelvisTwist:12,left:[90,130],right:[75,125],drop:20,offhand:35})],
    [7,figure(14,118,40,{pitch:10,chest:20,left:[40,80],right:[20,60],drop:4,offhand:55})],
    [8,figure(34,62,-18,{pitch:36,chest:30,chestTwist:16,left:[-10,30],right:[0,45],drop:-30,offhand:70})],
    [9,figure(34,58,-62,{pitch:50,chest:34,chestTwist:22,pelvis:-8,pelvisTwist:-14,left:[-30,8],right:[-20,20],drop:-40,offhand:85})],
    [10,figure(28,62,-128,{pitch:54,chest:36,chestTwist:18,pelvis:-8,left:[-35,8],right:[-25,25],drop:-36,offhand:85})],
    [11,figure(0,140,95,{pitch:-8,chest:-12,chestTwist:-20,left:[100,135],right:[60,20],drop:-28,offhand:20})],
    [12,figure(10,66,-90,{pitch:20,chest:24,chestTwist:-26,pelvisTwist:20,left:[95,130],right:[90,125],drop:-26,offhand:70})],
    [13,figure(-28,72,-165,{pitch:-44,chest:-16,chestTwist:-34,pelvisTwist:16,left:[88,10],right:[62,40],drop:-23,offhand:60})],
    [14,figure(-30,110,178,{pitch:20,chest:10,chestTwist:30,pelvisTwist:-20,left:[20,90],right:[45,120],drop:-20,offhand:60})],
    [15,figure(32,64,-85,{pitch:32,chest:30,chestTwist:40,pelvis:6,pelvisTwist:-24,left:[75,5],right:[-35,100],drop:-20,offhand:85})],
    [16,figure(26,62,-120,{pitch:34,chest:30,chestTwist:36,pelvis:6,pelvisTwist:-24,left:[72,8],right:[-38,105],drop:-21,offhand:85})],
    [17,figure(20,130,95,{pitch:-10,chest:-14,chestTwist:-18,left:[20,60],right:[40,90],drop:-18,offhand:45})],
    [18,figure(40,56,-88,{pitch:6,chest:16,chestTwist:-10,pelvis:-10,left:[-8,4],right:[10,20],drop:-24,offhand:65})],
    [19,figure(-44,72,-168,{pitch:-32,chest:-22,chestTwist:-42,pelvis:-10,pelvisTwist:26,left:[-38,115],right:[72,22],drop:-21,offhand:30})],
    [20,figure(-10,150,135,{pitch:-46,chest:-26,chestTwist:-30,pelvisTwist:14,left:[-20,60],right:[30,110],drop:-6,offhand:15})],
    [21,figure(30,62,-70,{pitch:40,chest:36,chestTwist:-30,pelvis:10,pelvisTwist:30,left:[85,120],right:[-25,15],drop:-22,offhand:85})],
    [22,figure(24,60,-112,{pitch:42,chest:38,chestTwist:-30,pelvis:10,pelvisTwist:30,left:[85,120],right:[-28,15],drop:-23,offhand:85})],
    [23,figure(16,142,110,{pitch:-22,chest:-16,chestTwist:16,left:[60,105],right:[65,110],drop:-10,offhand:40})],
    [24,figure(24,70,-90,{pitch:30,chest:34,pelvis:-6,left:[-20,30],right:[-10,45],drop:-18,offhand:75})],
    [27,figure(20,72,-92,{pitch:34,chest:36,pelvis:-6,left:[-25,25],right:[-12,40],drop:-22,offhand:75})],
    [30,figure(18,72,-100,{pitch:30,chest:32,pelvis:-4,left:[-20,30],right:[-8,42],drop:-20,offhand:70})],
    [33,figure(15,72,-116,{pitch:20,chest:24,left:[-4,44],right:[3,48],drop:-16,offhand:60})],
    [37,figure(14,72,-125,{pitch:14,chest:18,left:[10,52],right:[6,46],drop:-11,offhand:54})],
    [41,figure(13,73,-129,{pitch:8,chest:12,left:[24,61],right:[12,47],drop:-6,offhand:49})],
    [45,fallReady],[46,fallReady],
  ]},
] as const;
const held = [
  {key:"jump",name:"Air Jump Rise",frames:24,keys:[
    [0,guard],
    [8,figure(10,96,-160,{pitch:-6,chest:-4,left:[30,55],right:[10,35],drop:6,offhand:55})],
    [16,figure(12,82,-140,{pitch:0,chest:4,left:[45,80],right:[22,55],drop:3,offhand:50})],
    [24,fallReady],
  ]},
  {key:"fall",name:"Air Fall Ready",frames:30,keys:[[0,fallReady],[30,fallReady]]},
] as const;
type Gesture = (typeof gestures)[number] | (typeof replacements)[number] | (typeof held)[number];

function writeBindings(bindings: readonly string[], names: readonly string[]) {
  return Bun.write(join(project,"ts/src/game/presentation/blademasterClipInfo.ts"),["// Generated by tools/animations/blademaster-clips.ts; regenerate instead of editing.",'import { f32 } from "wisp/src/sim/f32";','import type { HeroClipTable } from "../sim/heroes/hero";',"export const BLADEMASTER_AUTHORED_CLIPS = {",...bindings,"} as const satisfies HeroClipTable;","","export const BLADEMASTER_AUTHORED_CLIP_NAMES = {",...names,"} as const;",""].join("\n"));
}

const frameAligned = (style: AttackStyle | undefined) => style !== undefined && ([AttackStyle.jab, AttackStyle.jab2, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.dashAttack, AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir] as readonly AttackStyle[]).includes(style);


function multiply(a: ArrayLike<number>, b: ArrayLike<number>): Float32Array<ArrayBuffer> {
  const [x,y,z,w]=Array.from(a),[u,v,t,s]=Array.from(b);
  const q=new Float32Array([w*u+x*s+y*t-z*v,w*v-x*t+y*s+z*u,w*t+x*v-y*u+z*s,w*s-x*u-y*v-z*t]);
  const n=Math.hypot(...q);return q.map(v=>v/n);
}
function rotate(q: ArrayLike<number>, axis: V, degrees: number) {
  const a=degrees*Math.PI/360,s=Math.sin(a);return multiply([axis[0]*s,axis[1]*s,axis[2]*s,Math.cos(a)],q);
}
const donor = new Map<string, mdx.AnimVector>(); tracks(source,(t,p)=>donor.set(p,t));
const base = new Map<string, Float32Array>();
for (const [path,t] of donor) {
  if(onGlobalClock(t))continue;
  const k=t.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);
  if(k)base.set(path,Float32Array.from(k.Vector));
}
const pelvisRotation=[...donor.keys()].find(path=>{const m=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);return m!==null&&source[m[1] as "Bones"|"Helpers"][Number(m[2])]?.Name==="Bone_Pelvis";});
ensure(pelvisRotation,"missing pelvis rotation");
if(!base.has(pelvisRotation))base.set(pelvisRotation,new Float32Array([0,0,0,1]));
const nodes=[...model.Bones,...model.Helpers], nodeByName=(name:string)=>{const n=nodes.find(n=>n.Name===name);ensure(n,name);return n;};
const arm=[nodeByName("Bone_Arm1_R"),nodeByName("Bone_Arm2_R")],hand=nodeByName("Bone_Hand_R"),tip=nodeByName("Shimmer");
let cursor=Math.max(...source.Sequences.map(s=>s.Interval[1]))+100;
const replaced=new Set<number>();
const gestureSequence=(name:string,start:number,end:number):mdx.Sequence=>({...stand,Name:`Sword Gesture ${name}`,Interval:new Uint32Array([start,end]),NonLooping:true,MoveSpeed:0,Rarity:0,MinimumExtent:new Float32Array([-300,-300,-200]),MaximumExtent:new Float32Array([300,300,350]),BoundsRadius:400});
interface ClipRecord { pose:string; name:string; index:number; first:number; last:number; total:number; seconds:number; strikeSeconds:number; controlFrames:number[] }
const records: ClipRecord[]=[],bindings:string[]=[],names:string[]=[];
function timeline(g: Gesture, first: number, last: number, total: number): { controlFrames: number[]; poses: Pose[] } {
  if("keys" in g)return {controlFrames:g.keys.map(([frame])=>frame),poses:g.keys.map(([,p])=>p)};
  if(g.style===AttackStyle.upTilt)return {controlFrames:[0,first-3,first,first+1,first+2,first+3,last,last+2,total-4,total],poses:[guard,pose([30,-50,70],[115,-50,5],14,-15,34,40),pose([40,-50,120],[165,-50,120],8,-10),pose([28,-50,140],[108,-50,242],-6,-4),pose([0,-50,150],[-22,-50,275],-10,0),pose([-28,-50,140],[-131,-50,212],-6,4),pose([-40,-50,120],[-165,-50,120],4,10),pose([0,-50,145],[0,-50,270],-6,14),pose([30,-50,115],[-15,-50,235],0,4),guard]};
  if(g.style===AttackStyle.forwardTiltUp)return {controlFrames:[0,Math.max(1,first-3),first,last+2,total-4,total],poses:[guard,g.prep,g.hit,pose([0,-50,145],[0,-50,270],-6,14),pose([30,-50,115],[-15,-50,235],0,4),guard]};
  const rest=airborne.includes(g.key)?fallReady:guard;
  const carry="carry" in g?g.carry:[],lift="lift" in g?[g.lift]:[],settle="settle" in g?g.settle:[];
  return {controlFrames:[0,...lift.map(([frame])=>frame),Math.max(1,first-3),first,...carry.map(([frame])=>frame),("second" in g?g.second:last+2),...settle.map(([frame])=>frame),total],poses:[rest,...lift.map(([,p])=>p),g.prep,g.hit,...carry.map(([,p])=>p),g.exit,...settle.map(([,p])=>p),rest]};
}
function posedJoint(name: string, q: Float32Array<ArrayBuffer>, p: Pose): Float32Array<ArrayBuffer> {
  const f=p.figure;
  if(f){
    if(name==="Bone_Chest")return rotate(rotate(q,[0,1,0],f.pitch+f.chest),[0,0,1],f.chestTwist);
    if(name==="Bone_Pelvis")return rotate(rotate(q,[0,1,0],f.pitch+f.pelvis),[0,0,1],f.pelvisTwist);
    if(name==="Bone_Head")return rotate(q,[0,1,0],-f.chest*0.3);
    const leg=/^Bone_Leg([12])_([LR])$/.exec(name);
    if(leg){const [hip,knee]=leg[2]==="L"?f.left:f.right;return rotate(q,[0,1,0],leg[1]==="1"?-hip:knee);}
  }
  if(name==="Bone_Chest")return rotate(rotate(q,[0,1,0],p.lean+p.pitch),[0,0,1],p.twist);
  if(name==="Bone_Pelvis")return rotate(rotate(q,[0,1,0],p.pitch),[0,0,1],-p.twist*0.35);
  if(name==="Bone_Head")return rotate(q,[0,1,0],-p.lean*0.4);
  if(name==="Bone_Arm1_L")return rotate(q,[0,1,0],-p.offhand);
  if(name==="Bone_Arm2_L")return rotate(q,[0,1,0],p.offhand*0.5);
  if(/^Bone_Leg1_[LR]$/.test(name))return rotate(q,[0,1,0],-p.knee*(name.endsWith("L")?0.7:0.4)+p.legSplit*(name.endsWith("L")?1:-1));
  if(/^Bone_Leg2_[LR]$/.test(name))return rotate(q,[0,1,0],p.knee*(p.legSplit&&name.endsWith("L")?0.35:1));
  return q;
}
function posedModel(p: Pose, sequence: mdx.Sequence, start: number): mdx.Model {
  const temp=structuredClone(source);
  temp.Sequences.push(sequence);
  tracks(temp,(t,path)=>{const v=base.get(path);if(!v||onGlobalClock(t))return;t.Keys=[];
    const match=/^\.(Bones|Helpers)\.(\d+)\.(Rotation|Translation)$/.exec(path),n=match?temp[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
    let q=v.slice();
    if(n&&match?.[3]==="Rotation")q=posedJoint(n.Name,q,p);
    if(n?.Name==="Bone_Root"&&match?.[3]==="Translation")q[2]=q[2]!+p.drop;
    t.LineType=mdx.LineType.Linear;t.Keys.push({Frame:start,Vector:q});
  });
  return temp;
}
function reach(temp: mdx.Model, start: number, p: Pose, g: Gesture) {
  const renderer=new ModelRenderer(temp);renderer.setSequence(temp.Sequences.length-1);
  const data=Reflect.get(renderer,"rendererData") as {frame:number;nodes:{matrix:Float32Array}[]};data.frame=start;renderer.update(0);
  const position=(n:mdx.Node,v=temp.PivotPoints[n.ObjectId]!):number[]=>{const m=data.nodes[n.ObjectId]!.matrix;return [m[0]!*v[0]!+m[4]!*v[1]!+m[8]!*v[2]!+m[12]!,m[1]!*v[0]!+m[5]!*v[1]!+m[9]!*v[2]!+m[13]!,m[2]!*v[0]!+m[6]!*v[1]!+m[10]!*v[2]!+m[14]!];};
  const aim=(joint:mdx.Node,effector:mdx.Node,target:V,endpoint?:Float32Array)=>{
    const origin=position(joint),a=position(effector,endpoint).map((v,i)=>v-origin[i]!),b=target.map((v,i)=>v-origin[i]!);const an=Math.hypot(...a),bn=Math.hypot(...b);if(an<0.001||bn<0.001)return;
    const av=a.map(v=>v/an),bv=b.map(v=>v/bn),cross=[av[1]!*bv[2]!-av[2]!*bv[1]!,av[2]!*bv[0]!-av[0]!*bv[2]!,av[0]!*bv[1]!-av[1]!*bv[0]!],cn=Math.hypot(...cross);if(cn<0.00001)return;
    const axis=cross.map(v=>v/cn),parent=joint.Parent==null?undefined:data.nodes[joint.Parent]?.matrix;
    const local=parent?[0,1,2].map(i=>(axis[0]!*parent[i*4]!+axis[1]!*parent[i*4+1]!+axis[2]!*parent[i*4+2]!)/Math.hypot(parent[i*4]!,parent[i*4+1]!,parent[i*4+2]!)):axis;
    const n=temp.Nodes[joint.ObjectId]!,key=n.Rotation?.Keys.at(-1);ensure(key,"missing joint rotation");key.Vector=rotate(key.Vector,local as unknown as V,Math.acos(Math.max(-1,Math.min(1,av.reduce((s,v,i)=>s+v*bv[i]!,0))))*180/Math.PI);renderer.update(0);
  };
  for(let iteration=0;iteration<12;iteration++)for(const joint of arm.toReversed())aim(joint,hand,p.hand);
  if("style" in g&&g.style===AttackStyle.upTilt) aim(hand,sword!,p.tip,new Float32Array([90.45929718017578,63.46139907836914,82.50170135498047]));
  else for(let iteration=0;iteration<("keys" in g?8:1);iteration++)aim(hand,tip,p.tip);
}
function settle(name: string, frames: number, p: Pose, g: Gesture) {
  const index=model.Sequences.findIndex(s=>s.Name===name),sequence=model.Sequences[index];ensure(sequence,`missing ${name}`);
  const start=sequence.Interval[0],end=sequence.Interval[1],from=Math.round(end-frames*1000/60);
  const temp=posedModel(p,sequence,start);reach(temp,start,p,g);
  const goal=new Map<string,Float32Array>();
  tracks(temp,(t,path)=>{const q=base.has(path)&&!onGlobalClock(t)?t.Keys.at(-1)?.Vector:undefined;if(q)goal.set(path,Float32Array.from(q));});
  const blend=(a:ArrayLike<number>,b:ArrayLike<number>,w:number)=>{
    const sign=a.length===4&&Array.from(a).reduce((sum,v,i)=>sum+v*b[i]!,0)<0?-1:1,mixed=Float32Array.from(a,(v,i)=>v*(1-w)+sign*b[i]!*w);
    if(a.length!==4)return mixed;const n=Math.hypot(...mixed);return mixed.map(v=>v/n);
  };
  tracks(model,(t,path)=>{const target=goal.get(path);if(!target||onGlobalClock(t))return;
    const inside=t.Keys.filter(k=>k.Frame>=start&&k.Frame<=end),before=inside.filter(k=>k.Frame<=from).at(-1),after=inside.find(k=>k.Frame>=from);
    const hold=before&&after&&after.Frame>before.Frame?blend(before.Vector,after.Vector,(from-before.Frame)/(after.Frame-before.Frame)):Float32Array.from((before??after??{Vector:target}).Vector);
    const keys=[{Frame:from,Vector:hold},...inside.filter(k=>k.Frame>from&&k.Frame<end).map(k=>{const x=(k.Frame-from)/(end-from);return {Frame:k.Frame,Vector:blend(k.Vector,target,x*x*(3-2*x))};}),{Frame:end,Vector:Float32Array.from(target)}];
    t.Keys=t.Keys.filter(k=>k.Frame<start||k.Frame>end||k.Frame<from).concat(keys.map(k=>({...k,...(t.LineType>=mdx.LineType.Hermite?{InTan:k.Vector.slice(),OutTan:k.Vector.slice()}:{})}))).sort((a,b)=>a.Frame-b.Frame);
  });
  replaced.add(index);
}
function author(g: Gesture, index: number, start: number, end: number, first: number, last: number, total: number): number[] {
  const {controlFrames,poses}=timeline(g,first,last,total);
  const values=new Map<string,Float32Array[]>();
  for(let phase=0;phase<poses.length;phase++){
    const p=poses[phase]!,temp=posedModel(p,model.Sequences[index]!,start);
    if(p!==guard)reach(temp,start,p,g);
    tracks(temp,(t,path)=>{const q=base.has(path)&&!onGlobalClock(t)?t.Keys.at(-1)?.Vector:undefined;if(q){const list=values.get(path)??[];list.push(Float32Array.from(q));values.set(path,list);}});
  }
  tracks(model,(t,path)=>{const v=base.get(path);if(!v||onGlobalClock(t))return;
    t.Keys=t.Keys.filter(k=>k.Frame<start||k.Frame>end);
    for(let phase=0;phase<controlFrames.length;phase++){const Vector=values.get(path)?.[phase]??v;t.Keys.push({Frame:start+Math.round(controlFrames[phase]!*1000/60),Vector:Vector.slice(),...(t.LineType>=mdx.LineType.Hermite?{InTan:Vector.slice(),OutTan:Vector.slice()}: {})});}
    t.Keys.sort((a,b)=>a.Frame-b.Frame);
  });
  return controlFrames;
}
for(const g of replaceOnly ? gestures.filter(g=>airborne.includes(g.key)) : gestures){
  const move=g.style===undefined?undefined:hero.moves.normals[g.style];
  const thrown=hero.moves.throws[GrabAction.throwBack];ensure(move||thrown,"missing timing");
  const existing = shipped.Sequences.find(s => s.Name === `Sword Gesture ${g.name}`);
  const first=move?.startupFrames??thrown!.contactFrame,total=existing ? Math.round((existing.Interval[1]-existing.Interval[0])*60/1000) : move?.totalFrames??thrown!.totalFrames;
  const last=first+(move?.activeFrames??1)-1;
  const start=existing?.Interval[0]??cursor,end=existing?.Interval[1]??start+Math.round(total*1000/60),present=model.Sequences.findIndex(s=>s.Name===`Sword Gesture ${g.name}`),index=present<0?model.Sequences.length:present;cursor=Math.max(cursor,end+100);
  ensure(existing === undefined || shipped.Sequences.indexOf(existing) === index, "gesture index changed");
  if(present<0)model.Sequences.push(gestureSequence(g.name,start,end));
  const controlFrames=author(g,index,start,end,first,last,total);replaced.add(index);
  records.push({pose:g.key,name:`Sword Gesture ${g.name}`,index,first,last,total,seconds:(end-start)/1000,strikeSeconds:Math.round(first*1000/60)/1000,controlFrames});
}
for(const g of held){
  const name=`Sword Gesture ${g.name}`,present=model.Sequences.findIndex(s=>s.Name===name),index=present<0?model.Sequences.length:present;
  const start=model.Sequences[index]?.Interval[0]??cursor,end=model.Sequences[index]?.Interval[1]??start+Math.round(g.frames*1000/60);cursor=Math.max(cursor,end+100);
  if(present<0)model.Sequences.push(gestureSequence(g.name,start,end));
  author(g,index,start,end,0,0,g.frames);replaced.add(index);
}
settle("Jump Motion doubleJump",12,fallReady,held[1]);
for(const g of [...gestures,...held]){
  const index=model.Sequences.findIndex(s=>s.Name===`Sword Gesture ${g.name}`),sequence=model.Sequences[index];ensure(sequence,`missing ${g.name}`);
  bindings.push(`  ${g.key}: { index: ${index}, seconds: ${seconds((sequence.Interval[1]-sequence.Interval[0])/1000)}${"style"in g&&frameAligned(g.style) ? ", aligned: true" : ""} },`);
  names.push(`  ${g.key}: ${JSON.stringify(`Sword Gesture ${g.name}`)},`);
}
for(const g of replacements){
  const move=hero.moves.normals[g.style],index=model.Sequences.findIndex(s=>s.Name===g.name),start=model.Sequences[index]?.Interval[0],end=model.Sequences[index]?.Interval[1];
  ensure(move&&start!==undefined&&end!==undefined,`missing ${g.name}`);
  const total=Math.round((end-start)*60/1000),first=move.startupFrames,last=first+move.activeFrames-1;
  ensure(total===move.totalFrames,`${g.name}: clip length differs from the move`);
  const controlFrames=author(g,index,start,end,first,last,total);replaced.add(index);
  records.push({pose:g.key,name:g.name,index,first,last,total,seconds:(end-start)/1000,strikeSeconds:Math.round(first*1000/60)/1000,controlFrames});
}
const bytes=encodeVerified(parseSource(generateMDX(model))),before=new DrawnModel(generateMDX(source),1),after=new DrawnModel(bytes,1);
for(const [index,s]of source.Sequences.entries())if(!replaced.has(index))for(const fraction of [0,0.5,1]){const t=(s.Interval[1]-s.Interval[0])*fraction/1000,a=before.triangles(index,t,1),b=after.triangles(index,t,1);ensure(a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i]!)<0.001),`${s.Name}: shipped pose changed`);}
mkdirSync(join(output,"hero-models"),{recursive:true});await Bun.write(join(output,fighter.source),bytes);
await writeBindings(bindings, names);
await Bun.write(join(output,"blademaster-clips.json"),JSON.stringify({sourceSequences:source.Sequences.length,records},null,2)+"\n");
const frames=records.flatMap(r=>[Math.max(1,r.first-3),r.first,r.controlFrames[3]!].map(frame=>({frame,facing:1,clip:r.index,seconds:frame/60,phase:AttackPhase.active,x:0,z:0,parts:[],strikes:[]})));
await Bun.write(join(output,"Blademaster-gestures.png"),sheet("Blademaster",after,frames,6).png);
for(const g of held){const index=model.Sequences.findIndex(s=>s.Name===`Sword Gesture ${g.name}`);await Bun.write(join(output,`Blademaster-${g.key}.png`),sheet(g.name,after,[0,g.frames/2,g.frames].flatMap(frame=>[1,-1].map(facing=>({frame,facing,clip:index,seconds:frame/60,phase:AttackPhase.none,x:0,z:0,parts:[],strikes:[]}))),6).png);}
for(const r of records)await Bun.write(join(output,`Blademaster-${r.pose}-hit.png`),sheet(r.name,after,[1,-1].map(facing=>({frame:r.first,facing,clip:r.index,seconds:r.strikeSeconds,phase:AttackPhase.active,x:0,z:0,parts:[],strikes:[]})),2).png);
const contacts=records.map(r=>after.triangles(r.index,r.strikeSeconds,1));
let closest=Infinity;
for(let i=0;i<contacts.length;i++)for(let j=0;j<i;j++){
  const a=contacts[i]!,b=contacts[j]!;ensure(a.length===b.length,"contact geometry changed");
  const delta=a.reduce((sum,v,k)=>sum+Math.abs(v-b[k]!),0)/a.length;closest=Math.min(closest,delta);
  ensure(delta>2,`${records[i]!.pose}/${records[j]!.pose}: repeated contact silhouette`);
}
console.log(`BLADEMASTER_CONTACT_PASS ${records.length} distinct hit poses; minimum mean vertex difference ${closest.toFixed(3)}`);
console.log(`BLADEMASTER_CLIPS_PASS ${records.length} authored gestures; ${source.Sequences.length*3} base poses retained after grip repair`);
