import { NO_GLOBAL_SEQ } from './animVector';

import { mkdirSync } from "node:fs";
import { mat4, quat, vec3 } from "../../ts/node_modules/gl-matrix";
import { join, relative, resolve } from "node:path";
import { generateMDX, ModelRenderer, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sheet } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase, AttackStyle, Character, GrabAction } from "../../ts/src/game/sim/codes";
import { heroDefinition } from "../../ts/src/game/roster/kits";
import { type Blade, type DrawnBlade, DOWN_AIR_SWEEP, DOWN_AIR_TOTAL, NEUTRAL_AIR_BLADES, NEUTRAL_AIR_FIRST_SPIN, NEUTRAL_AIR_SPIN_FRAMES, NEUTRAL_AIR_SPINS, UP_AIR_BLADE } from "../../ts/src/game/fighters/blademaster/moves";
import { seconds } from "./asset-info";
import { swordGestureBaseModel } from "./recovery-model";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";
import { fighters } from "../../ts/scripts/heroModelSource";

const [input, output] = process.argv.slice(2, 4).map(p => resolve(p));
const replaceFlag = process.argv.indexOf("--replace"), replaceOnly = replaceFlag < 0 ? undefined : process.argv[replaceFlag + 1];
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith("..") && (replaceOnly === undefined || replaceOnly === "aerials" || replaceOnly === "up-air" || replaceOnly === "forward-air" || replaceOnly === "counter"), "usage: bun tools/animations/blademaster-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--replace aerials|up-air|forward-air|counter]");
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
interface Pose { hand: V; tip: V; lean: number; twist: number; knee: number; offhand: number; legSplit:number; drop:number; pitch:number; figure?: Figure; spin?: number }
const pose = (hand: V, tip: V, lean = 0, twist = 0, knee = 12, offhand = 25, legSplit=0, drop=0, pitch=0): Pose => ({hand, tip, lean, twist, knee, offhand, legSplit, drop, pitch});
const upAirPose = (b: Blade) => pose([b.gripX,-24,b.gripZ],[b.tipX,-24,b.tipZ],-14,10,80,70,65);
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
  {key:"neutralAir",name:"Air Crescent Slash",style:AttackStyle.neutralAir,prep:pose([-15,-24,121],[-70,-24,172],-9,-18,48,50),hit:pose([48,-24,99],[140,-24,117],4,12,38,55),exit:pose([-40,-24,96],[-130,-24,121],-5,-25,54,65),second:12},
  {key:"forwardAir",name:"Air Forward Cleave",style:AttackStyle.forwardAir,prep:pose([-5,-24,144],[-45,-24,225],-15,-22,55,50),hit:pose([52,-24,95],[140,-24,49],16,18,40,60),exit:pose([43,-24,52],[90,-24,-25],22,30,64,65)},
  {key:"backAir",name:"Air Turning Back Cut",style:AttackStyle.backAir,prep:pose([26,-24,130],[95,-24,192],-10,20,52,45),hit:pose([-42,-24,100],[-138,-24,83],-12,-55,44,65),exit:pose([-40,-24,112],[-115,-24,174],-6,-65,62,60)},
  {key:"upAir",name:"Air Upward Pierce",style:AttackStyle.upAir,prep:pose([10,-24,88],[52,-24,6],20,-12,62,45),hit:upAirPose(UP_AIR_BLADE[0]!),exit:pose([-40,-24,112],[-120,-24,160],-5,-18,64,55,35)},
  {key:"throwBack",name:"Throw Back Heave",style:undefined,prep:pose([40,-24,105],[100,-24,148],10,18,30,75),hit:pose([-40,-24,140],[-125,-24,196],-18,-45,28,90),exit:pose([-30,-24,119],[-100,-24,150],-6,-55,20,55)},
] as const;
const radial = (centreX: number, centreZ: number, degrees: number, grip: number, length: number): Blade => {
  const x = Math.cos(degrees*Math.PI/180), z = Math.sin(degrees*Math.PI/180);
  return {gripX:centreX+grip*x,gripZ:centreZ+grip*z,tipX:centreX+(grip+length)*x,tipZ:centreZ+(grip+length)*z};
};
const drawnAt = (table: readonly DrawnBlade[], frame: number) => table.find(b => b.frame === frame);
const SWORD = 99;
const FLIP_CENTRE = [0, 60] as const, FLIP_GRIP = 40, FLIP_DROP = -21, FLIP_LEAD = 40;
const flipEnd = NEUTRAL_AIR_FIRST_SPIN + NEUTRAL_AIR_SPINS * NEUTRAL_AIR_SPIN_FRAMES;
const flipBlade = (frame: number) => 22.5 - 360 / NEUTRAL_AIR_SPIN_FRAMES * (frame - 6);
const flip = (frame: number): Pose => {
  const degrees = flipBlade(frame), b = drawnAt(NEUTRAL_AIR_BLADES, frame) ?? radial(FLIP_CENTRE[0], FLIP_CENTRE[1], degrees, FLIP_GRIP, SWORD);
  return {...pose([b.gripX,-24,b.gripZ],[b.tipX,-24,b.tipZ],0,0,85,60,0,FLIP_DROP), spin: 90 - FLIP_LEAD - degrees};
};
const SWEEP_PIVOT = [6, 90] as const, SWEEP_GRIP = 40, SWEEP_DROP = -25;
const sweep = (degrees: number, pitch: number, knee: number, frame?: number): Pose => {
  const b = (frame === undefined ? undefined : drawnAt(DOWN_AIR_SWEEP, frame)) ?? radial(SWEEP_PIVOT[0], SWEEP_PIVOT[1], degrees, SWEEP_GRIP, SWORD);
  return pose([b.gripX,-24,b.gripZ],[b.tipX,-24,b.tipZ],pitch*0.5,0,knee,55,0,SWEEP_DROP,pitch);
};
const SWEEP_LEAN = [24, 30, 22, 8] as const;
const replacements = [
  {key:"downAir",name:"Down Air Sword Plunge",style:AttackStyle.downAir,keys:[
    [0,guard],
    [3,sweep(75,-18,55)],
    [5,sweep(15,8,70)],
    ...DOWN_AIR_SWEEP.map((b,index)=>[b.frame,sweep(0,SWEEP_LEAN[index]??0,85,b.frame)] as const),
    [11,sweep(150,-10,60)],
    [18,sweep(175,-6,40)],
    [31,pose([10,-25,100],[60,-25,170],0,0,20,30)],
    [DOWN_AIR_TOTAL,guard],
  ]},
  {key:"neutralAir",name:"Sword Gesture Air Crescent Slash",style:AttackStyle.neutralAir,keys:[
    [0,guard],
    [3,{...pose([-6,-24,128],[-30,-24,225],-12,-10,50,45,0,-8),spin:-15}],
    ...Array.from({length:flipEnd-NEUTRAL_AIR_FIRST_SPIN+1},(_,index)=>[NEUTRAL_AIR_FIRST_SPIN+index,flip(NEUTRAL_AIR_FIRST_SPIN+index)] as const),
    [flipEnd+3,{...pose([30,-24,70],[110,-24,20],10,0,50,45,0,-10),spin:720}],
    [36,{...guard,spin:720}],
  ]},
] as const;
const parry = pose([34,-25,92],[46,-25,192],-6,10,34,40);
const kickGuard = pose([-10,-25,80],[-95,-25,130],0,-10,40,70);
const plant = figure(18,22,12,{pitch:28,chest:10,pelvis:0,left:[95,110],right:[70,120],drop:-55,offhand:-95});
const chamber = figure(-28,40,195,{pitch:-10,chest:-6,pelvis:-10,left:[60,110],right:[120,90],drop:-55,offhand:-95});
const SPIN = -150, LIFT = 60;
const kick = {...figure(22,8,0,{left:[10,20],right:[0,0],drop:0,offhand:-95}),spin:SPIN,drop:LIFT};
const kickRise = {...figure(20,30,30,{left:[40,60],right:[30,40],drop:0,offhand:-95}),spin:SPIN*0.6,drop:LIFT*0.5};
const counterGestures = [
  {key:"sideSpecial",name:"Wind Walk Guard",style:undefined,keys:[
    [0,guard],[4,parry],[29,parry],[36,{...parry,lean:6,knee:24}],[59,guard],
  ]},
  {key:"sideSpecialFollowUp",name:"Wind Walk Kick",style:undefined,keys:[
    [0,parry],[5,kickGuard],[8,plant],[10,plant],[11,kickRise],[13,kick],[22,kick],[29,kickRise],[37,kickGuard],[46,guard],
  ]},
] as const;
type Gesture = (typeof gestures)[number] | (typeof replacements)[number] | (typeof counterGestures)[number];

function writeBindings(bindings: readonly string[], names: readonly string[]) {
  return Bun.write(join(project,"ts/src/game/presentation/blademasterClipInfo.ts"),["// Generated by tools/animations/blademaster-clips.ts; regenerate instead of editing.",'import { f32 } from "wisp/src/sim/f32";','import type { HeroClipTable } from "../sim/heroes/hero";',"export const BLADEMASTER_AUTHORED_CLIPS = {",...bindings,"} as const satisfies HeroClipTable;","","export const BLADEMASTER_AUTHORED_CLIP_NAMES = {",...names,"} as const;",""].join("\n"));
}

const frameAligned = (style: AttackStyle | undefined) => style !== undefined && ([AttackStyle.jab, AttackStyle.jab2, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.dashAttack, AttackStyle.neutralAir, AttackStyle.downAir] as readonly AttackStyle[]).includes(style);


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
const rootRotation=[...donor.keys()].find(path=>{const m=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);return m!==null&&source[m[1] as "Bones"|"Helpers"][Number(m[2])]?.Name==="Bone_Root";});
ensure(rootRotation,"missing root rotation");
if(!base.has(rootRotation))base.set(rootRotation,new Float32Array([0,0,0,1]));
const nodes=[...model.Bones,...model.Helpers], nodeByName=(name:string)=>{const n=nodes.find(n=>n.Name===name);ensure(n,name);return n;};
const arm=[nodeByName("Bone_Arm1_R"),nodeByName("Bone_Arm2_R")],hand=nodeByName("Bone_Hand_R"),tip=nodeByName("Shimmer");
let cursor=Math.max(...source.Sequences.map(s=>s.Interval[1]))+100;
interface ClipRecord { pose:string; name:string; index:number; first:number; last:number; total:number; seconds:number; strikeSeconds:number; controlFrames:number[] }
const records: ClipRecord[]=[],bindings:string[]=[],names:string[]=[];
function timeline(g: Gesture, first: number, last: number, total: number): { controlFrames: number[]; poses: Pose[] } {
  if("keys" in g)return {controlFrames:g.keys.map(([frame])=>frame),poses:g.keys.map(([,p])=>p)};
  if(g.style===AttackStyle.upTilt)return {controlFrames:[0,first-3,first,first+1,first+2,first+3,last,last+2,total-4,total],poses:[guard,pose([30,-50,70],[115,-50,5],14,-15,34,40),pose([40,-50,120],[165,-50,120],8,-10),pose([28,-50,140],[108,-50,242],-6,-4),pose([0,-50,150],[-22,-50,275],-10,0),pose([-28,-50,140],[-131,-50,212],-6,4),pose([-40,-50,120],[-165,-50,120],4,10),pose([0,-50,145],[0,-50,270],-6,14),pose([30,-50,115],[-15,-50,235],0,4),guard]};
  if(g.style===AttackStyle.upAir)return {controlFrames:[0,Math.max(1,first-4),...UP_AIR_BLADE.map((_,index)=>first-1+index),last+1,last+6,total-6,total],poses:[guard,g.prep,...UP_AIR_BLADE.map(upAirPose),g.exit,pose([-25,-24,100],[-50,-24,2],5,-12,50,45),pose([15,-24,85],[62,-24,4],12,-6,40,40),guard]};
  if(g.style===AttackStyle.forwardTiltUp)return {controlFrames:[0,Math.max(1,first-3),first,last+2,total-4,total],poses:[guard,g.prep,g.hit,pose([0,-50,145],[0,-50,270],-6,14),pose([30,-50,115],[-15,-50,235],0,4),guard]};
  return {controlFrames:[0,Math.max(1,first-3),first,("second" in g?g.second:last+2),total],poses:[guard,g.prep,g.hit,g.exit,guard]};
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
    if(n?.Name==="Bone_Root"&&match?.[3]==="Rotation"&&p.spin)q=rotate(q,[0,1,0],p.spin);
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
  if(g.style===AttackStyle.upTilt) aim(hand,sword!,p.tip,new Float32Array([90.45929718017578,63.46139907836914,82.50170135498047]));
  else for(let iteration=0;iteration<("keys" in g?8:1);iteration++)aim(hand,tip,p.tip);
}
function author(g: Gesture, index: number, start: number, end: number, first: number, last: number, total: number, scale = 1): number[] {
  const {controlFrames,poses}=timeline(g,first,last,total);
  const values=new Map<string,Float32Array[]>();
  for(let phase=0;phase<poses.length;phase++){
    const p=poses[phase]!,temp=posedModel(p,model.Sequences[index]!,start);
    if(phase!==0&&phase!==poses.length-1&&p!==guard)reach(temp,start,p,g);
    tracks(temp,(t,path)=>{const q=base.has(path)&&!onGlobalClock(t)?t.Keys.at(-1)?.Vector:undefined;if(q){const list=values.get(path)??[];list.push(Float32Array.from(q));values.set(path,list);}});
  }
  tracks(model,(t,path)=>{const v=base.get(path);if(!v||onGlobalClock(t))return;
    t.Keys=t.Keys.filter(k=>k.Frame<start||k.Frame>end);
    for(let phase=0;phase<controlFrames.length;phase++){const Vector=values.get(path)?.[phase]??v;t.Keys.push({Frame:Math.min(end,start+Math.round(controlFrames[phase]!*scale*1000/60)),Vector:Vector.slice(),...(t.LineType>=mdx.LineType.Hermite?{InTan:Vector.slice(),OutTan:Vector.slice()}: {})});}
    t.Keys.sort((a,b)=>a.Frame-b.Frame);
  });
  return controlFrames;
}
for(const g of replaceOnly ? [] : gestures){
  const move=g.style===undefined?undefined:hero.moves.normals[g.style];
  const thrown=hero.moves.throws[GrabAction.throwBack];ensure(move||thrown,"missing timing");
  const existing = shipped.Sequences.find(s => s.Name === `Sword Gesture ${g.name}`);
  const first=move?.startupFrames??thrown!.contactFrame,total=existing ? Math.round((existing.Interval[1]-existing.Interval[0])*60/1000) : move?.totalFrames??thrown!.totalFrames;
  const last=first+(move?.activeFrames??1)-1;
  const start=existing?.Interval[0]??cursor,end=existing?.Interval[1]??start+Math.round(total*1000/60),index=model.Sequences.length;cursor=end+100;
  ensure(existing === undefined || shipped.Sequences.indexOf(existing) === index, "gesture index changed");
  model.Sequences.push({...stand,Name:`Sword Gesture ${g.name}`,Interval:new Uint32Array([start,end]),NonLooping:true,MoveSpeed:0,Rarity:0,MinimumExtent:new Float32Array([-300,-300,-200]),MaximumExtent:new Float32Array([300,300,350]),BoundsRadius:400});
  const controlFrames=author(g,index,start,end,first,last,total);
  records.push({pose:g.key,name:`Sword Gesture ${g.name}`,index,first,last,total,seconds:(end-start)/1000,strikeSeconds:Math.round(first*1000/60)/1000,controlFrames});
}
const replaced=new Set<number>();
for(const g of replaceOnly==="counter"?counterGestures:[]){
  const name=`Sword Gesture ${g.name}`,total=g.keys.at(-1)![0],existing=model.Sequences.findIndex(sq=>sq.Name===name);
  const index=existing>=0?existing:model.Sequences.length,start=existing>=0?model.Sequences[existing]!.Interval[0]:cursor,end=start+Math.round(total*1000/60);
  if(existing<0){model.Sequences.push({...stand,Name:name,Interval:new Uint32Array([start,end]),NonLooping:true,MoveSpeed:0,Rarity:0,MinimumExtent:new Float32Array([-300,-300,-200]),MaximumExtent:new Float32Array([300,300,350]),BoundsRadius:400});cursor=end+100;}
  const controlFrames=author(g,index,start,end,0,0,total);replaced.add(index);
  const strike=g.key==="sideSpecial"?4:16;
  records.push({pose:g.key,name,index,first:strike,last:strike,total,seconds:(end-start)/1000,strikeSeconds:Math.round(strike*1000/60)/1000,controlFrames});
}
const inPlace=replaceOnly==="forward-air"||replaceOnly==="counter"?[]:replaceOnly==="up-air"?gestures.filter(g=>g.style===AttackStyle.upAir).map(g=>({g,name:`Sword Gesture ${g.name}`,matchesMove:false})):replacements.map(g=>({g,name:g.name,matchesMove:true}));
for(const {g,name,matchesMove} of inPlace){
  const move=g.style===undefined?undefined:hero.moves.normals[g.style],index=model.Sequences.findIndex(s=>s.Name===name),start=model.Sequences[index]?.Interval[0],end=model.Sequences[index]?.Interval[1];
  ensure(move&&start!==undefined&&end!==undefined,`missing ${name}`);
  const total=Math.round((end-start)*60/1000),first=move.startupFrames,last=first+move.activeFrames-1;
  ensure(!matchesMove||("keys" in g&&g.keys.at(-1)?.[0]===move.totalFrames),`${name}: keys do not span the move`);
  const controlFrames=author(g,index,start,end,first,last,total,matchesMove?total/move.totalFrames:1);replaced.add(index);
  records.push({pose:g.key,name,index,first,last,total,seconds:(end-start)/1000,strikeSeconds:Math.round(first*1000/60)/1000,controlFrames});
}
if(replaceOnly==="forward-air"){
  const name="Sword Gesture Air Forward Cleave",index=model.Sequences.findIndex(s=>s.Name===name),slam=model.Sequences.find(s=>s.Name==="Attack Slam"),move=hero.moves.normals[AttackStyle.forwardAir];
  ensure(index>=0&&slam&&move,"missing forward-air retime inputs");
  const [start,end]=[model.Sequences[index]!.Interval[0],model.Sequences[index]!.Interval[1]],total=Math.round((end-start)*60/1000),first=move.startupFrames,last=first+move.activeFrames-1;
  const from=[0,767,833,slam.Interval[1]-slam.Interval[0]],stock=(ms:number)=>ms<=from[2]!||ms>=from[3]!,to=[0,first,last,total].map(frame=>frame*1000/60);
  const retime=(ms:number)=>{const i=Math.min(from.length-2,from.findIndex((v,j)=>ms<=from[j+1]!));return start+Math.round(to[i]!+(to[i+1]!-to[i]!)*(ms-from[i]!)/(from[i+1]!-from[i]!));};
  const hold=16,leanKeys=[[0,0],[6,-10],[first,6],[last,6],[hold,14],[total,0]] as const;
  const lean=(frame:number)=>{const i=Math.max(0,leanKeys.findLastIndex(([f])=>f<=frame)),[f0,p0]=leanKeys[i]!,[f1,p1]=leanKeys[Math.min(i+1,leanKeys.length-1)]!;return f1===f0?p0:p0+(p1-p0)*(frame-f0)/(f1-f0);};
  const airborne=new Set(["Bone_Root","Bone_Leg1_L","Bone_Leg2_L","Bone_Foot_L","Bone_Leg1_R","Bone_Leg2_R","Bone_Foot_R"]);
  tracks(model,(t,path)=>{
    if(onGlobalClock(t))return;
    const match=/^\.(Bones|Helpers)\.(\d+)\./.exec(path);if(match&&airborne.has(model[match[1] as "Bones"|"Helpers"][Number(match[2])]!.Name))return;
    const keys=new Map<number,(typeof t.Keys)[number]>();
    for(const k of t.Keys)if(k.Frame>=slam.Interval[0]&&k.Frame<=slam.Interval[1]&&stock(k.Frame-slam.Interval[0]))keys.set(retime(k.Frame-slam.Interval[0]),{...structuredClone(k),Frame:retime(k.Frame-slam.Interval[0])});
    for(const frame of [start,end]){const ready=t.Keys.find(k=>k.Frame===frame),key=keys.get(frame);if(ready&&key)keys.set(frame,{...structuredClone(ready),Frame:frame});}
    if(match&&model[match[1] as "Bones"|"Helpers"][Number(match[2])]!.Name==="Bone_Chest"&&path.endsWith("Rotation"))for(const k of keys.values()){const pitch=lean((k.Frame-start)*60/1000);for(const field of ["Vector","InTan","OutTan"] as const){const q=k[field];if(q)k[field]=rotate(q,[0,1,0],pitch);}}
    if(path===pelvisRotation)for(const [frame,pitch] of leanKeys){const Vector=rotate(base.get(path)!,[0,1,0],pitch);keys.set(start+Math.round(frame*1000/60),{Frame:start+Math.round(frame*1000/60),Vector,...(t.LineType>=mdx.LineType.Hermite?{InTan:Vector.slice(),OutTan:Vector.slice()}:{})});}
    t.Keys=t.Keys.filter(k=>k.Frame<start||k.Frame>end).concat([...keys.values()]).sort((a,b)=>a.Frame-b.Frame);
  });
  const renderer=new ModelRenderer(model),data=Reflect.get(renderer,"rendererData") as {frame:number;nodes:{matrix:Float32Array}[]};
  renderer.setSequence(index);data.frame=start+Math.round(last*1000/60);renderer.update(0);
  const holdFrame=start+Math.round(hold*1000/60);
  for(const node of [...model.Bones,...model.Helpers]){
    const t=node.Rotation;if(!t||onGlobalClock(t)||airborne.has(node.Name)||!t.Keys.some(k=>k.Frame>start&&k.Frame<end))continue;
    const world=mat4.getRotation(quat.create(),data.nodes[node.ObjectId]!.matrix),parent=node.Parent==null?quat.create():mat4.getRotation(quat.create(),data.nodes[node.Parent]!.matrix);
    let Vector=new Float32Array(quat.normalize(quat.create(),quat.multiply(quat.create(),quat.invert(quat.create(),parent),world)));
    if(node.Name==="Bone_Chest")Vector=rotate(Vector,[0,1,0],lean(hold)-lean(last));
    t.Keys=t.Keys.filter(k=>k.Frame!==holdFrame).concat({Frame:holdFrame,Vector,...(t.LineType>=mdx.LineType.Hermite?{InTan:Vector.slice(),OutTan:Vector.slice()}:{})}).sort((a,b)=>a.Frame-b.Frame);
  }
  replaced.add(index);
  records.push({pose:"forwardAir",name,index,first,last,total,seconds:(end-start)/1000,strikeSeconds:Math.round(first*1000/60)/1000,controlFrames:[0,first,last,total]});
}
const bytes=encodeVerified(parseSource(generateMDX(model))),before=new DrawnModel(generateMDX(source),1),after=new DrawnModel(bytes,1);
for(const [index,s]of source.Sequences.entries())if(!replaced.has(index))for(const fraction of [0,0.5,1]){const t=(s.Interval[1]-s.Interval[0])*fraction/1000,a=before.triangles(index,t,1),b=after.triangles(index,t,1);ensure(a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i]!)<0.001),`${s.Name}: shipped pose changed`);}
mkdirSync(join(output,"hero-models"),{recursive:true});await Bun.write(join(output,fighter.source),bytes);
for(const g of gestures){
  const index=model.Sequences.findIndex(s=>s.Name===`Sword Gesture ${g.name}`),s=model.Sequences[index];ensure(s,`missing ${g.name}`);
  bindings.push(`  ${g.key}: { index: ${index}, seconds: ${seconds((s.Interval[1]-s.Interval[0])/1000)}${frameAligned(g.style) ? ", aligned: true" : ""} },`);
  names.push(`  ${g.key}: ${JSON.stringify(`Sword Gesture ${g.name}`)},`);
}
for(const g of counterGestures){
  const index=model.Sequences.findIndex(sq=>sq.Name===`Sword Gesture ${g.name}`),sq=model.Sequences[index];if(!sq)continue;
  for(const key of [g.key,`${g.key}Air`]){bindings.push(`  ${key}: { index: ${index}, seconds: ${seconds((sq.Interval[1]-sq.Interval[0])/1000)}, aligned: true },`);names.push(`  ${key}: ${JSON.stringify(`Sword Gesture ${g.name}`)},`);}
}
await writeBindings(bindings, names);
await Bun.write(join(output,"blademaster-clips.json"),JSON.stringify({sourceSequences:source.Sequences.length,records},null,2)+"\n");
const frames=records.flatMap(r=>[Math.max(1,r.first-3),r.first,r.controlFrames[3]!].map(frame=>({frame,facing:1,clip:r.index,seconds:frame/60,phase:AttackPhase.active,x:0,z:0,parts:[],strikes:[]})));
await Bun.write(join(output,"Blademaster-gestures.png"),sheet("Blademaster",after,frames,6).png);
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
