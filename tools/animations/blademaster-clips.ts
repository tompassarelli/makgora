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
const replaceOnly = process.argv.includes("--replace-down-air");
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/blademaster-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--replace-down-air]");
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
  {key:"upAir",name:"Air Upward Pierce",style:AttackStyle.upAir,prep:pose([10,-24,88],[52,-24,6],20,-12,62,45),hit:pose([7,-24,147],[7,-24,246],-14,10,80,70,65),exit:pose([24,-24,136],[62,-24,219],-5,18,64,55,35)},
  {key:"throwBack",name:"Throw Back Heave",style:undefined,prep:pose([40,-24,105],[100,-24,148],10,18,30,75),hit:pose([-40,-24,140],[-125,-24,196],-18,-45,28,90),exit:pose([-30,-24,119],[-100,-24,150],-6,-55,20,55)},
] as const;
const replacements = [
  {key:"downAir",name:"Down Air Sword Plunge",style:AttackStyle.downAir,keys:[
    [0,guard],
    [3,figure(-10,128,120,{pitch:-20,chest:-14,left:[60,100],right:[45,90],drop:10,offhand:40})],
    [5,figure(-30,140,160,{pitch:-34,chest:-20,chestTwist:-24,pelvisTwist:12,left:[90,130],right:[75,125],drop:20,offhand:35})],
    [7,figure(14,118,40,{pitch:10,chest:20,left:[40,80],right:[20,60],drop:4,offhand:55})],
    [8,figure(34,62,-18,{pitch:36,chest:30,chestTwist:16,left:[-10,30],right:[0,45],drop:-30,offhand:70})],
    [9,figure(34,58,-62,{pitch:50,chest:34,chestTwist:22,pelvis:-8,pelvisTwist:-14,left:[-30,8],right:[-20,20],drop:-40,offhand:85})],
    [10,figure(28,62,-128,{pitch:54,chest:36,chestTwist:18,pelvis:-8,left:[-35,8],right:[-25,25],drop:-36,offhand:85})],
    [11,figure(22,114,70,{pitch:-6,chest:-10,chestTwist:-14,left:[60,100],right:[70,110],drop:-22,offhand:45})],
    [12,figure(-16,66,-124,{pitch:-40,chest:-14,chestTwist:-34,pelvisTwist:16,left:[85,10],right:[60,40],drop:-22,offhand:60})],
    [13,figure(-28,72,-165,{pitch:-44,chest:-16,chestTwist:-34,pelvisTwist:16,left:[88,10],right:[62,40],drop:-23,offhand:60})],
    [14,figure(-16,124,135,{pitch:-4,chest:0,chestTwist:12,left:[45,95],right:[60,115],drop:-18,offhand:40})],
    [15,figure(34,66,-55,{pitch:30,chest:28,chestTwist:40,pelvis:6,pelvisTwist:-24,left:[75,5],right:[-35,100],drop:-20,offhand:85})],
    [16,figure(30,62,-110,{pitch:34,chest:30,chestTwist:36,pelvis:6,pelvisTwist:-24,left:[72,8],right:[-38,105],drop:-21,offhand:85})],
    [17,figure(24,118,70,{pitch:-4,chest:-10,chestTwist:-18,left:[25,65],right:[45,95],drop:-18,offhand:45})],
    [18,figure(-20,64,-128,{pitch:-28,chest:-20,chestTwist:-42,pelvis:-10,pelvisTwist:26,left:[-35,110],right:[70,20],drop:-20,offhand:30})],
    [19,figure(-34,72,-168,{pitch:-32,chest:-22,chestTwist:-42,pelvis:-10,pelvisTwist:26,left:[-38,115],right:[72,22],drop:-21,offhand:30})],
    [20,figure(-26,140,160,{pitch:-30,chest:-20,left:[90,130],right:[80,125],drop:-6,offhand:35})],
    [21,figure(32,62,-60,{pitch:44,chest:40,chestTwist:12,pelvis:10,left:[80,120],right:[65,110],drop:-22,offhand:85})],
    [22,figure(28,60,-115,{pitch:46,chest:42,chestTwist:10,pelvis:10,left:[82,122],right:[68,112],drop:-23,offhand:85})],
    [23,figure(20,140,85,{pitch:-16,chest:-12,left:[70,115],right:[75,120],drop:-10,offhand:40})],
    [24,figure(22,74,-88,{pitch:24,chest:28,left:[-10,40],right:[0,55],drop:-18,offhand:75})],
    [27,figure(20,74,-92,{pitch:30,chest:32,pelvis:-6,left:[-15,30],right:[-5,40],drop:-22,offhand:75})],
    [30,figure(16,72,-90,{pitch:14,chest:20,left:[30,70],right:[40,80],drop:-20,offhand:55})],
    [33,figure(14,68,-82,{pitch:2,chest:10,left:[12,25],right:[4,20],drop:-14,offhand:30})],
    [37,swing(18,76,-48,{lean:7,twist:3,knee:8,offhand:28,drop:-9,pitch:1})],
    [41,swing(26,90,0,{lean:4,twist:3,knee:10,offhand:26,drop:-4,pitch:0})],[45,guard],[46,guard],
  ]},
] as const;
type Gesture = (typeof gestures)[number] | (typeof replacements)[number];

function writeBindings(bindings: readonly string[], names: readonly string[]) {
  return Bun.write(join(project,"ts/src/game/presentation/blademasterClipInfo.ts"),["// Generated by tools/animations/blademaster-clips.ts; regenerate instead of editing.",'import { f32 } from "wisp/src/sim/f32";','import type { HeroClipTable } from "../sim/heroes/hero";',"export const BLADEMASTER_AUTHORED_CLIPS = {",...bindings,"} as const satisfies HeroClipTable;","","export const BLADEMASTER_AUTHORED_CLIP_NAMES = {",...names,"} as const;",""].join("\n"));
}

const frameAligned = (style: AttackStyle | undefined) => style !== undefined && ([AttackStyle.jab, AttackStyle.jab2, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.dashAttack, AttackStyle.downAir] as readonly AttackStyle[]).includes(style);


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
interface ClipRecord { pose:string; name:string; index:number; first:number; last:number; total:number; seconds:number; strikeSeconds:number; controlFrames:number[] }
const records: ClipRecord[]=[],bindings:string[]=[],names:string[]=[];
function timeline(g: Gesture, first: number, last: number, total: number): { controlFrames: number[]; poses: Pose[] } {
  if("keys" in g)return {controlFrames:g.keys.map(([frame])=>frame),poses:g.keys.map(([,p])=>p)};
  if(g.style===AttackStyle.upTilt)return {controlFrames:[0,first-3,first,first+1,first+2,first+3,last,last+2,total-4,total],poses:[guard,pose([30,-50,70],[115,-50,5],14,-15,34,40),pose([40,-50,120],[165,-50,120],8,-10),pose([28,-50,140],[108,-50,242],-6,-4),pose([0,-50,150],[-22,-50,275],-10,0),pose([-28,-50,140],[-131,-50,212],-6,4),pose([-40,-50,120],[-165,-50,120],4,10),pose([0,-50,145],[0,-50,270],-6,14),pose([30,-50,115],[-15,-50,235],0,4),guard]};
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
function author(g: Gesture, index: number, start: number, end: number, first: number, last: number, total: number): number[] {
  const {controlFrames,poses}=timeline(g,first,last,total);
  const values=new Map<string,Float32Array[]>();
  for(let phase=0;phase<poses.length;phase++){
    const p=poses[phase]!,temp=posedModel(p,model.Sequences[index]!,start);
    if(phase!==0&&phase!==poses.length-1&&p!==guard)reach(temp,start,p,g);
    tracks(temp,(t,path)=>{const q=base.has(path)&&!onGlobalClock(t)?t.Keys.at(-1)?.Vector:undefined;if(q){const list=values.get(path)??[];list.push(Float32Array.from(q));values.set(path,list);}});
  }
  tracks(model,(t,path)=>{const v=base.get(path);if(!v||onGlobalClock(t))return;
    t.Keys=t.Keys.filter(k=>k.Frame<start||k.Frame>end);
    for(let phase=0;phase<controlFrames.length;phase++){const Vector=values.get(path)?.[phase]??v;t.Keys.push({Frame:start+Math.round(controlFrames[phase]!*1000/60),Vector:Vector.slice(),...(t.LineType>=mdx.LineType.Hermite?{InTan:Vector.slice(),OutTan:Vector.slice()}: {})});}
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
  bindings.push(`  ${g.key}: { index: ${index}, seconds: ${seconds((end-start)/1000)}${frameAligned(g.style) ? ", aligned: true" : ""} },`);
  names.push(`  ${g.key}: ${JSON.stringify(`Sword Gesture ${g.name}`)},`);
  records.push({pose:g.key,name:`Sword Gesture ${g.name}`,index,first,last,total,seconds:(end-start)/1000,strikeSeconds:Math.round(first*1000/60)/1000,controlFrames});
}
const replaced=new Set<number>();
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
if(!replaceOnly)await writeBindings(bindings, names);
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
