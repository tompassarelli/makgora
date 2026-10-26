import { NO_GLOBAL_SEQ, type KeyVector } from './animVector';


import { BunRuntime } from "../../ts/node_modules/@effect/platform-bun/dist/index.js";
import { Effect, Schema } from "effect";
import { mkdirSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { generateMDX, ModelRenderer, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackStyle, AttackPhase, Character, GrabAction } from "../../ts/src/game/sim/codes";
import { heroDefinition } from "../../ts/src/game/sim/heroes/registry";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { DOWN_DAMAGE_FRAMES, DOWN_ROLL_FRAMES, TECH_ROLL_FRAMES } from "../../ts/src/game/sim/down";
import { LEDGE_ROLL_FRAMES } from "../../ts/src/game/sim/ledge";
import { GROUND_ROLL_FRAMES } from "../../ts/src/game/sim/conditions";
import { seconds } from "./asset-info";
import { highestGrip, ledgeGripOffset } from "./ledge-grip";
import { ensure, parseSource, tracks, onGlobalClock, encodeVerified } from "./original-clips";
class ClipFailure extends Schema.TaggedError<ClipFailure>()("ClipFailure", { cause: Schema.Unknown }) {}
BunRuntime.runMain(Effect.tryPromise({ try: async () => {
const args = process.argv.slice(2), [input, output] = args.slice(0, 2).map(p => resolve(p));
const option = (name: string) => { const at = args.indexOf(name); return at < 0 ? undefined : resolve(args[at + 1] ?? ""); };
const rigOutput = option("--rig"), bakedKeys = option("--keys");
const replaced = args.slice(2).filter((a, i, all) => !a.startsWith("--") && !all[i - 1]?.startsWith("--")) as HeroPose[], inPlace = replaced.length > 0;
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith("..") && (!(rigOutput || bakedKeys) || replaced.length === 1), "usage: bun tools/animations/medivh-clips.ts STOCK_MEDIVH.mdx|SHIPPED_MEDIVH.mdx PRIVATE_OUTPUT [POSE...] [--rig RIG.json | --keys KEYS.json] (one POSE with --rig or --keys)");
const source = parseSource(await Bun.file(input).arrayBuffer()), model = structuredClone(source);
ensure((inPlace ? source.Sequences.some(s => s.Name === "Medivh Damage 0 0") : source.Sequences.length === 22) && source.Bones.some(b => b.Name === "Staff"), "Expected original classic Medivh");
const stand = source.Sequences[0]!;
const hero = heroDefinition(Character.medivh); ensure(hero, "Register Medivh before exporting his clips");
const HANG_SLACK=8,hangHands=["Bone_Hand_L","Bone_Hand_R"].map(name=>model.Nodes.findIndex(n=>n?.Name===name));
function hangRoot(drawn:DrawnModel,index:number,time:number,old?:ArrayLike<number>){const [x,z]=ledgeGripOffset(drawn,index,time,highestGrip(drawn,index,time,hangHands),Character.medivh);return new Float32Array([(old?.[0]??0)+x-HANG_SLACK,old?.[1]??0,(old?.[2]??0)+z]);}
interface Gesture { tx?: number; chest?: number; waist?: number; arm?: number; wrist?: number; leftArm?: number; head?: number; front?: number; back?: number; kneeFront?: number; kneeBack?: number; yaw?: number; lean?: number; }
interface Beat { frame: number; g: Gesture; hand: Point; direction: Point; }
function everyFrame(anchors:readonly Beat[],from:number,to:number):Beat[] {
 const mix=(a:number,b:number,s:number)=>a+(b-a)*s,point=(a:Point,b:Point,s:number):Point=>[mix(a[0],b[0],s),mix(a[1],b[1],s),mix(a[2],b[2],s)];
 return Array.from({length:to-from+1},(_,i)=>from+i).map(frame=>{const j=Math.max(0,anchors.findIndex(b=>b.frame>=frame)-1),a=anchors[j]!,b=anchors[j+1]??a,s=b.frame>a.frame?Math.min(1,Math.max(0,(frame-a.frame)/(b.frame-a.frame))):0;
  const keys=[...new Set([...Object.keys(a.g),...Object.keys(b.g)])] as (keyof Gesture)[];
  return {frame,g:Object.fromEntries(keys.map(k=>[k,mix(a.g[k]??0,b.g[k]??0,s)])),hand:point(a.hand,b.hand,s),direction:point(a.direction,b.direction,s)};});
}
interface Action { pose: HeroPose; frames: number; contact: number; gesture: Gesture; hold?: boolean; air?: boolean; roll?: number; beats?: readonly Beat[]; }
const forward: Gesture = {chest:23,arm:-80,wrist:15,leftArm:-55,head:-15,front:18,back:-12};
const overhead: Gesture = {chest:-12,arm:-140,wrist:10,leftArm:-85,head:-10,front:-12,back:10};
const low: Gesture = {chest:48,arm:20,wrist:35,leftArm:-35,head:-28,front:-80,back:-70,kneeFront:130,kneeBack:120};
const back: Gesture = {chest:-12,arm:55,wrist:25,leftArm:-30,head:15,yaw:155,front:12,back:12};
const cast: Gesture = {chest:-15,arm:-110,wrist:20,leftArm:-140,head:-25,front:12,yaw:25};
const brace: Gesture = {chest:20,arm:-35,wrist:25,leftArm:-50,head:-10,front:25,back:25};
const actions: Action[] = [];
const normals: readonly [HeroPose, AttackStyle, Gesture][] = [
 ["jab",AttackStyle.jab,{...forward,arm:-60,chest:10}], ["jab2",AttackStyle.jab2,{...forward,arm:-80}],
 ["forwardTilt",AttackStyle.forwardTilt,forward], ["forwardTiltUp",AttackStyle.forwardTiltUp,{...overhead,arm:-130}], ["forwardTiltDown",AttackStyle.forwardTiltDown,{...low,arm:-70}],
 ["upTilt",AttackStyle.upTilt,overhead], ["downTilt",AttackStyle.downTilt,low], ["dashAttack",AttackStyle.dashAttack,{...forward,lean:12}],
 ["forwardSmash",AttackStyle.forwardSmash,{...forward,chest:35,waist:-20,arm:-115,wrist:60}], ["upSmash",AttackStyle.upSmash,{...overhead,chest:-30,arm:-175}], ["downSmash",AttackStyle.downSmash,low],
 ["neutralAir",AttackStyle.neutralAir,{...forward,yaw:70}], ["forwardAir",AttackStyle.forwardAir,{...forward}], ["backAir",AttackStyle.backAir,back], ["upAir",AttackStyle.upAir,overhead], ["downAir",AttackStyle.downAir,{...low,lean:45,front:45}],
];
const beats: Partial<Record<HeroPose,(move:{startupFrames:number;activeFrames:number;totalFrames:number})=>readonly Beat[]>> = {
 dashAttack:({startupFrames:c,activeFrames:a,totalFrames:t})=>{
  const run:Beat={frame:0,g:{lean:6,chest:8,head:-4,arm:-10,front:-25,back:18},hand:[24,-18,62],direction:[1,0,0.1]};
  return [run,...everyFrame([run,
   {frame:Math.max(1,c-2),g:{tx:-30,lean:-26,chest:-24,head:14,arm:-30,front:-35,back:35,kneeFront:80,kneeBack:70,yaw:-45},hand:[-12,-18,54],direction:[-1,0,-0.25]},
   {frame:c,g:{tx:10,lean:38,chest:20,head:-18,arm:45,wrist:20,front:-60,back:40,kneeFront:90,yaw:14},hand:[44,-18,46],direction:[1,0,-0.1]},
   {frame:c+5,g:{tx:18,lean:56,chest:24,head:-26,arm:52,wrist:22,front:-72,back:52,kneeFront:105,yaw:18},hand:[54,-18,38],direction:[1,0,-0.05]},
   {frame:c+8,g:{tx:20,lean:48,chest:20,head:-22,arm:46,wrist:24,front:-66,back:46,kneeFront:96,yaw:15},hand:[48,-18,44],direction:[1,0,0.15]},
   {frame:c+a-1,g:{tx:22,lean:36,chest:14,head:-14,arm:34,wrist:28,front:-55,back:38,kneeFront:85,yaw:12},hand:[36,-18,56],direction:[1,0,0.55]},
  ],Math.max(1,c-2),c+a-1),
  {frame:Math.round(c+a-1+(t-c-a+1)*0.4),g:{tx:15,lean:20,chest:8,head:-8,arm:24,front:-35,back:22,kneeFront:55,yaw:6},hand:[30,-18,64],direction:[0.65,0,0.75]},
  {frame:Math.round(c+a-1+(t-c-a+1)*0.7),g:{tx:6,lean:8,chest:3,head:-3,arm:14,front:-12,back:8,kneeFront:20,yaw:2},hand:[22,-18,70],direction:[0.35,0,0.95]}];
 },
};
for (const [pose,style,gesture] of normals) { const move=hero.moves.normals[style];ensure(move,`${pose}: missing move timing`); actions.push({pose,frames:move.totalFrames,contact:move.startupFrames,gesture,air:pose.endsWith("Air"),beats:beats[pose]?.(move)}); }
const extra: readonly [HeroPose,number,number,Gesture][] = [
 ["crouch",30,12,brace],["landing",8,2,brace],["shield",30,8,{...brace,leftArm:-100}],["airDodge",49,4,{...brace,lean:-25}], ["smashCharge",30,8,{...overhead,arm:-100}],["dizzy",60,25,{chest:-15,head:30,arm:20,leftArm:15}],
 ["turn",8,4,{yaw:140,chest:-12}], ["stop",8,3,{...brace,lean:-18}], ["jumpSquat",5,4,{...brace,front:55,back:55}],
 ["jump",24,7,{...overhead,front:-50,back:25,lean:-12}], ["doubleJump",24,7,{...cast,front:-45,back:35,lean:-20}], ["wallJump",24,7,{...overhead,lean:-25}], ["wallTech",26,6,brace],
 ["fall",30,12,{...brace,front:40,back:-20}], ["fallSpecial",30,12,{...brace,chest:45,head:20}], ["ledgeHang",30,10,{arm:-120,wrist:10,leftArm:-120,head:-10,kneeFront:60,kneeBack:60}], ["ledgeClimb",25,10,{...overhead,lean:35}], ["ledgeAttack",40,20,forward],
 ["knockdown",30,25,{...brace,lean:85}], ["downDamage",DOWN_DAMAGE_FRAMES,8,{...brace,lean:75,head:30}], ["getUp",30,18,{...brace,lean:30}], ["getUpAttack",49,16,low],
 ["spotDodge",22,4,{...brace,lean:-30}], ["tech",26,8,{...brace,lean:45}],
 ["damageGround",24,3,{...brace,chest:-35,head:-30}], ["damageAir",24,3,{...brace,chest:-40,front:60}], ["damageTumble",30,9,{...brace,lean:70}], ["damageShield",24,3,{...brace,chest:-20}],
 ["grab",30,7,{...forward,leftArm:-105,chest:30}], ["grabHold",30,1,{...forward,leftArm:-100,chest:20}], ["grabbed",30,1,{chest:-35,waist:20,head:30,arm:25,leftArm:30}], ["pummel",24,8,{...forward,leftArm:-105,arm:-70}],
 ["throwForward",30,11,forward], ["throwBack",34,13,back], ["throwUp",30,11,overhead], ["throwDown",32,15,low],
 ["victimPummel",24,3,{chest:-25,waist:10,head:-25}], ["victimThrowForward",30,8,{chest:-35,waist:15,lean:-25}], ["victimThrowBack",34,8,{chest:35,waist:-15,lean:25}], ["victimThrowUp",30,8,{chest:-30,front:50,back:50,lean:-30}], ["victimThrowDown",32,8,{...brace,lean:70}],
];
for(const [pose,defaultFrames,defaultContact,gesture] of extra) { const throwCode=({pummel:GrabAction.pummel,throwForward:GrabAction.throwForward,throwBack:GrabAction.throwBack,throwUp:GrabAction.throwUp,throwDown:GrabAction.throwDown} as Partial<Record<HeroPose,GrabAction>>)[pose]; const thrown=throwCode===undefined?undefined:hero.moves.throws[throwCode]; const normalStyle=pose==="grab"?AttackStyle.grab:pose==="getUpAttack"?AttackStyle.getupAttack:pose==="ledgeAttack"?AttackStyle.ledgeAttack:undefined; const normalMove=normalStyle===undefined?undefined:hero.moves.normals[normalStyle]; const frames=thrown?.totalFrames??normalMove?.totalFrames??defaultFrames,contact=thrown?.contactFrame??normalMove?.startupFrames??defaultContact; actions.push({pose,frames,contact,gesture,hold:["grabHold","grabbed","shield","smashCharge","crouch","ledgeHang","knockdown","downDamage","fall","fallSpecial"].includes(pose),air:["airDodge","jump","doubleJump","wallJump","fall","fallSpecial","damageAir","damageTumble","victimThrowUp"].includes(pose)}); }
for(const pose of ["rollForward","techForward","getUpRollForward","ledgeRoll","rollBackward","techBackward","getUpRollBackward"] as const)actions.push({pose,frames:pose.startsWith("tech")?TECH_ROLL_FRAMES:pose.startsWith("getUp")?DOWN_ROLL_FRAMES:pose==="ledgeRoll"?LEDGE_ROLL_FRAMES:GROUND_ROLL_FRAMES,contact:10,gesture:{...brace,front:-75,back:-75,kneeFront:120,kneeBack:120},roll:pose.endsWith("Backward")?-1:1});
for(const [pose,key,gesture]of [["neutralSpecial","neutral",cast],["sideSpecial","side",{...cast,leftArm:-145}],["upSpecial","up",{...overhead,leftArm:-130,front:-55,back:35,lean:-15}],["downSpecial","down",{...low,leftArm:-80,front:100}]] as const){
 const move=hero.specials?.[key]; ensure(move,`${pose}: missing special`);
 for(const air of [false,true]) { const form = air ? move.air ?? move.ground : move.ground; const contact = Math.min(...[...(form.regions?.map(r=>r.firstFrame)??[]),...(form.motion?.map(r=>r.first)??[]),...(form.projectiles?.map(r=>r.spawnFrame)??[]),...(form.placement?[form.placement.frame]:[]),form.endFrame]); actions.push({pose:(air?`${pose}Air`:pose) as HeroPose,frames:form.endFrame,contact:Math.max(3,contact),gesture,air}); }
}
function rotated(q: ArrayLike<number>, y:number,z=0){const a=y*Math.PI/360,b=z*Math.PI/360;const u=[-Math.sin(a)*Math.sin(b),Math.sin(a)*Math.cos(b),Math.cos(a)*Math.sin(b),Math.cos(a)*Math.cos(b)];const [x=0,v=0,w=0,t=1]=Array.from(q);const [i=0,j=0,k=0,l=1]=u;return new Float32Array([l*x+i*t+j*w-k*v,l*v-i*w+j*t+k*x,l*w+i*v-j*x+k*t,l*t-i*x-j*v-k*w]);}
type Point = readonly [number, number, number];
type Phase = { frame: number; amount: number };
function multiply(a:ArrayLike<number>, b:ArrayLike<number>) {
 const [x=0,y=0,z=0,w=1]=Array.from(a),[i=0,j=0,k=0,l=1]=Array.from(b);
 const q=[w*i+x*l+y*k-z*j,w*j-x*k+y*l+z*i,w*k+x*j-y*i+z*l,w*l-x*i-y*j-z*k];
 const length=Math.hypot(...q);return new Float32Array(q.map(v=>v/length));
}
function scaledRotation(q:ArrayLike<number>,amount:number) {
 const a=Array.from(q),sign=(a[3]??1)<0?-1:1,w=Math.min(1,Math.max(-1,(a[3]??1)*sign)),angle=Math.acos(w),gain=Math.abs(Math.sin(angle))<0.00001?amount:Math.sin(angle*amount)/Math.sin(angle);
 return new Float32Array([(a[0]??0)*sign*gain,(a[1]??0)*sign*gain,(a[2]??0)*sign*gain,Math.cos(angle*amount)]);
}
function aimArm(index:number,start:number,action:Action,phases:readonly Phase[],left:boolean,target:Point,direction?:Point) {
 const renderer=new ModelRenderer(model),data=Reflect.get(renderer,"rendererData");renderer.setSequence(index);
 const side=left?"L":"R",arm=model.Nodes.find(n=>n?.Name===`Bone_Arm1_${side}`)!,elbow=model.Nodes.find(n=>n?.Name===`Bone_Arm2_${side}`)!,hand=model.Nodes.find(n=>n?.Name===`Bone_Hand_${side}`)!;
 const sample=start+Math.round(action.contact*1000/60);data.frame=sample;
 const base=(n:mdx.Node)=>source.Nodes[n.ObjectId]?.Rotation?.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1])?.Vector??new Float32Array([0,0,0,1]);
 const key=(n:mdx.Node,frame:number)=>n.Rotation!.Keys.find(k=>k.Frame===start+Math.round(frame*1000/60))!;
 const set=(n:mdx.Node,frame:number,q:KeyVector)=>{const k=key(n,frame);k.Vector=q;if(k.InTan){k.InTan=q.slice();k.OutTan=q.slice();}};
 const point=(n:mdx.Node):Point=>{const p=model.PivotPoints[n.ObjectId]!,m=data.nodes[n.ObjectId].matrix;return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];};
 const armBase=base(arm),elbowBase=base(elbow),handBase=base(hand),angles=[left?action.gesture.leftArm??0:action.gesture.arm??0,0,left?0:action.gesture.wrist??0,0];set(hand,action.contact,handBase.slice());
 const loss=()=>{set(arm,action.contact,rotated(armBase,angles[0]!,angles[1]!));set(elbow,action.contact,rotated(elbowBase,angles[2]!,angles[3]!));renderer.update(0);const p=point(hand);return p.reduce((sum,v,i)=>sum+(v-target[i]!)**2,0);};
 for(const step of [30,10,3,1])for(let pass=0;pass<2;pass++)for(let dim=0;dim<4;dim++){const origin=angles[dim]!,range=step===30?180:step*3;let best=loss(),angle=origin;for(let delta=-range;delta<=range;delta+=step){angles[dim]=origin+delta;const score=loss();if(score<best){best=score;angle=angles[dim]!;}}angles[dim]=angle;}
 loss();
 let handDelta=new Float32Array([0,0,0,1]);
 if(direction){const weapon=model.Nodes.find(n=>n?.Name.trim()==="Staff")!,tip=point(weapon),grip=point(hand),m=data.nodes[hand.Parent!].matrix;
  const local=(v:Point)=>[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[4]*v[0]+m[5]*v[1]+m[6]*v[2],m[8]*v[0]+m[9]*v[1]+m[10]*v[2]];
  const a=local([tip[0]-grip[0],tip[1]-grip[1],tip[2]-grip[2]]),b=local(direction),al=Math.hypot(...a),bl=Math.hypot(...b);for(let i=0;i<3;i++){a[i]!/=al;b[i]!/=bl;}
  const q=[a[1]!*b[2]!-a[2]!*b[1]!,a[2]!*b[0]!-a[0]!*b[2]!,a[0]!*b[1]!-a[1]!*b[0]!,1+a.reduce((s,v,i)=>s+v*b[i]!,0)],length=Math.hypot(...q);handDelta=new Float32Array(q.map(v=>v/length));
 }
 for(const {frame,amount}of phases){set(arm,frame,rotated(armBase,angles[0]!*amount,angles[1]!*amount));set(elbow,frame,rotated(elbowBase,angles[2]!*amount,angles[3]!*amount));if(direction)set(hand,frame,multiply(scaledRotation(handDelta,amount),handBase));}
}
function contactAim(pose:HeroPose):{hand:Point;direction:Point}|undefined {
 if(pose==="jab2")return {hand:[18,-18,62],direction:[1,0,0]};
 if(pose==="downAir")return {hand:[18,-18,30],direction:[0,0,-1]};
 if(pose==="upTilt")return {hand:[25,-18,140],direction:[0.4,0,1]};
 if(pose==="upAir")return {hand:[8,-18,115],direction:[1,0,0]};
 if(pose==="upSmash"||pose==="throwUp"||pose==="upSpecial"||pose==="upSpecialAir")return {hand:[8,-18,113],direction:[0,0,1]};
 if(pose==="forwardTiltUp")return {hand:[32,-18,72],direction:[1,0,0.5]};
 if(pose==="forwardTiltDown")return {hand:[33,-18,47],direction:[1,0,-0.6]};
 if(pose==="downTilt"||pose==="downSmash"||pose==="getUpAttack"||pose==="throwDown"||pose==="downSpecial"||pose==="downSpecialAir")return {hand:[35,-18,28],direction:[1,0,-0.2]};
 if(pose==="backAir"||pose==="throwBack")return {hand:[-33,-18,65],direction:[-1,0,0]};
 if(["jab","jab2","forwardTilt","dashAttack","forwardSmash","neutralAir","forwardAir","ledgeAttack","getUpAttack","throwForward","neutralSpecial","neutralSpecialAir"].includes(pose))return {hand:[34,-18,62],direction:[1,0,0]};
 if(pose==="sideSpecial"||pose==="sideSpecialAir")return {hand:[21,-18,101],direction:[0.65,0,1]};
 return undefined;
}
function joint(name:string,g:Gesture):[number,number]{
 if(name==="Bone_Chest")return [g.chest??0,g.yaw??0];
 if(name==="Bone_Pelvis")return [g.waist??0,0];
 if(name==="Bone_Arm1_R")return [g.arm??0,0];
 if(name==="Bone_Arm2_R")return [g.wrist??0,0];
 if(name==="Bone_Arm1_L")return [g.leftArm??0,0];
 if(name==="Bone_Head")return [g.head??0,0];
 if(/^Bone_Leg1_[LR]$/.test(name))return [name.includes("_L")?g.front??0:g.back??0,0];
 if(/^Bone_Leg2_[LR]$/.test(name))return [name.includes("_L")?g.kneeFront??Math.abs(g.front??0):g.kneeBack??Math.abs(g.back??0),0];
 if(name==="Bone_Root")return [g.lean??0,0];
 return [0,0];
}
const originals=new Map<string,mdx.AnimVector>();tracks(source,(t,p)=>originals.set(p,t));
const skeleton=(["Bones","Helpers"] as const).flatMap(kind=>model[kind].map((n,i)=>({n,path:`.${kind}.${i}`})));
if(rigOutput){
 const action=actions.find(a=>a.pose===replaced[0]),style=normals.find(([pose])=>pose===replaced[0])?.[1],move=style===undefined?undefined:hero.moves.normals[style];ensure(action&&move,`${replaced[0]}: not an authored Medivh normal`);
 const at=(path:string)=>{const t=originals.get(path),v=t&&!onGlobalClock(t)?t.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1])?.Vector:undefined;return v?Array.from(v):null;};
 const staff=model.Nodes.find(n=>n?.Name.trim()==="Staff")!,grip=Array.from(source.PivotPoints[staff.ObjectId]!);let staffTip=grip,reach=0;
 for(const g of source.Geosets)for(let v=0;v<g.Vertices.length/3;v++)if(g.Groups[g.VertexGroup[v]!]?.includes(staff.ObjectId)){const p=Array.from(g.Vertices.subarray(3*v,3*v+3)),d=Math.hypot(...p.map((x,i)=>x-grip[i]!));if(d>reach){reach=d;staffTip=p;}}
 await Bun.write(rigOutput,JSON.stringify({frames:action.frames,contact:action.contact,active:move.activeFrames,staffTip,nodes:skeleton.map(({n,path})=>({name:n.Name,parent:skeleton.findIndex(s=>s.n.ObjectId===n.Parent),pivot:Array.from(source.PivotPoints[n.ObjectId]!),rotation:at(`${path}.Rotation`),translation:at(`${path}.Translation`)}))}));
 console.log(`MEDIVH_RIG ${replaced[0]} ${rigOutput}`);return;
}
let cursor=Math.max(...source.Sequences.map(s=>s.Interval[1]))+100;
const bindings:string[]=[],damageBindings:string[]=[], records:{pose:string;index:number;frames:number;contact:number}[]=[];
const damageActions:Action[]=[];
for(let height=0;height<3;height++)for(let strength=0;strength<3;strength++){const gain=[0.45,0.8,1.2][strength]!;if(!inPlace)damageActions.push({pose:"damageGround",frames:24,contact:3,hold:true,gesture:height===0?{front:65*gain,back:55*gain,waist:25*gain,chest:25*gain,head:-15*gain}:height===1?{chest:55*gain,waist:-25*gain,arm:30*gain,leftArm:35*gain}:{head:-45*gain,chest:-35*gain,arm:45*gain,leftArm:55*gain}});}
if(inPlace){ensure(replaced.every(pose=>actions.some(action=>action.pose===pose)),`unknown pose in ${replaced.join(" ")}`);actions.splice(0,actions.length,...actions.filter(action=>replaced.includes(action.pose)));}
for(const [ordinal,action]of [...actions,...damageActions].entries()){
 const name=ordinal<actions.length?`Medivh ${action.pose}`:`Medivh Damage ${Math.floor((ordinal-actions.length)/3)} ${((ordinal-actions.length)%3)}`;
 const existing=inPlace?model.Sequences.findIndex(sequence=>sequence.Name===name):-1;ensure(!inPlace||existing>=0,`${name}: shipped sequence missing`);
 const index=existing>=0?existing:model.Sequences.length,start=existing>=0?model.Sequences[index]!.Interval[0]!:cursor,end=start+Math.round(action.frames*1000/60);
 if(existing>=0){const shipped=model.Sequences[index]!.Interval[1]!,next=Math.min(...model.Sequences.map(sequence=>sequence.Interval[0]!).filter(first=>first>start));ensure(end<next,`${name}: no room before the next sequence`);
  tracks(model,track=>{if(!onGlobalClock(track))track.Keys=track.Keys.filter(key=>key.Frame<start||key.Frame>Math.max(end,shipped));});model.Sequences[index]!.Interval=new Uint32Array([start,end]);}
 else{cursor=end+100;model.Sequences.push({...stand,Name:name,Interval:new Uint32Array([start,end]),NonLooping:true,MoveSpeed:0,Rarity:0,MinimumExtent:new Float32Array([-300,-300,-200]),MaximumExtent:new Float32Array([300,300,350]),BoundsRadius:400});}
 const reverse=action.pose==="downSmash"?action.contact+3:action.pose==="getUpAttack"?action.contact+2:undefined;
 const beatAt=(frame:number)=>action.beats?.find(beat=>beat.frame===frame);
 const phaseFrames=action.beats?[...new Set([0,...action.beats.map(beat=>beat.frame),action.frames])]:[...new Set([0,Math.max(1,action.contact-3),action.contact,Math.min(action.frames-1,action.contact+4),action.frames,...action.roll?[0.25,0.5,0.75].map(p=>Math.round(action.frames*p)):[],...reverse?[reverse]:[]])].sort((a,b)=>a-b);
 const phases=phaseFrames.map(frame=>({frame,amount:action.beats?beatAt(frame)?1:0:action.hold?1:action.roll?Math.sin(Math.PI*frame/action.frames):frame===0||frame===action.frames?0:frame===Math.max(1,action.contact-3)?-0.3:1}));
 tracks(model,(track,path)=>{
  const donor=originals.get(path);if(!donor||onGlobalClock(donor))return;
  const flight=action.pose==="upSpecial"||action.pose==="upSpecialAir";
  if(flight){const raven=source.Sequences[18]!; const donorKeys=donor.Keys.filter(k=>k.Frame>=raven.Interval[0]&&k.Frame<=raven.Interval[1]);
   if(donorKeys.length>0){for(const k of donorKeys){const key=structuredClone(k);key.Frame=start+Math.round((k.Frame-raven.Interval[0])/(raven.Interval[1]-raven.Interval[0])*(end-start));track.Keys.push(key);}return;}
   if(/^\.GeosetAnims\.\d+\.Alpha$/.test(path)){for(const Frame of [start,end])track.Keys.push({Frame,Vector:new Float32Array([1])});return;}}
  let first=donor.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);

  if(!first&&/^\.(Bones|Helpers)\.\d+\.(Rotation|Translation|Scaling)$/.test(path)){const Vector=new Float32Array(path.endsWith("Rotation")?[0,0,0,1]:path.endsWith("Scaling")?[1,1,1]:[0,0,0]);first={Frame:stand.Interval[0],Vector,...track.LineType>1?{InTan:Vector.slice(),OutTan:Vector.slice()}: {}};}
  if(!first)return;
  const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path),node=match?source[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
  for(const {frame,amount}of phases){let Vector=first.Vector.slice();if(node){let[y,z]=joint(node.Name,beatAt(frame)?.g??action.gesture);if(node.Name==="Bone_Root"&&action.roll)y=frame/action.frames*360*action.roll;else y*=amount;z*=amount;if(node.Name==="Bone_Chest"&&reverse&&frame>=reverse&&frame<action.frames)z=165;if(node.Name==="Bone_Root"&&(action.pose==="getUp"||action.pose==="getUpAttack")&&frame<action.contact)y=85*(1-frame/action.contact);Vector=rotated(first.Vector,y,z);}
   const tangent=()=>match||track.LineType===mdx.LineType.Bezier?Vector.slice():new Float32Array(Vector.length);
   track.Keys.push({...first,Frame:start+Math.round(frame*1000/60),Vector,...first.InTan?{InTan:tangent(),OutTan:tangent()}: {}});
  }
 });
 if(action.pose==="upSpecial"||action.pose==="upSpecialAir"){
  for(const anim of model.GeosetAnims){if(!anim.Alpha||typeof anim.Alpha==="number")continue;anim.Alpha.Keys=anim.Alpha.Keys.filter(k=>k.Frame<start||k.Frame>end);for(const frame of [0,8,9,28,29,action.frames])anim.Alpha.Keys.push({Frame:start+Math.round(frame*1000/60),Vector:new Float32Array([anim.GeosetId===0?(frame>=9&&frame<=28?0:1):(frame>=9&&frame<=28?1:0)])});anim.Alpha.LineType=0;}
  const bird=model.Nodes.find(n=>n?.Name==="Bone00")!;if(!bird.Translation)bird.Translation={LineType:1,GlobalSeqId: NO_GLOBAL_SEQ,Keys:source.Sequences.flatMap(s=>Array.from(s.Interval).map(Frame=>({Frame,Vector:new Float32Array([0,0,0])})))};bird.Translation.Keys=bird.Translation.Keys.filter(k=>k.Frame<start||k.Frame>end);for(const frame of [0,action.frames])bird.Translation.Keys.push({Frame:start+Math.round(frame*1000/60),Vector:new Float32Array([0,0,75]),...(bird.Translation.LineType>1?{InTan:new Float32Array([0,0,0]),OutTan:new Float32Array([0,0,0])}:{})});
 }
 if(inPlace)tracks(model,track=>track.Keys.sort((a,b)=>a.Frame-b.Frame));
 if(action.beats)for(const beat of action.beats)aimArm(index,start,{...action,contact:beat.frame},[{frame:beat.frame,amount:1}],true,beat.hand,beat.direction);
 const aim=contactAim(action.pose);if(ordinal<actions.length&&aim&&!action.beats&&action.pose!=="upSpecial"&&action.pose!=="upSpecialAir")aimArm(index,start,action,phases,true,aim.hand,aim.direction);
 if(reverse)aimArm(index,start,{...action,contact:reverse},phases.filter(p=>p.frame>=reverse),true,[-35,-18,28],[-1,0,-0.2]);
 if(["grab","grabHold","pummel","throwForward","neutralSpecial","neutralSpecialAir"].includes(action.pose))aimArm(index,start,action,phases,true,[36,12,65]);
 if(["sideSpecial","sideSpecialAir"].includes(action.pose))aimArm(index,start,action,phases,true,[27,12,112]);
 if(["downSpecial","downSpecialAir"].includes(action.pose))aimArm(index,start,action,phases,true,[35,12,32]);

 const center=model.Nodes.find(b=>b.Name==="Bone_Root");ensure(center,"No Medivh root");
 if(!center.Translation)center.Translation={LineType:1,GlobalSeqId: NO_GLOBAL_SEQ,Keys:source.Sequences.flatMap(s=>Array.from(s.Interval).map(Frame=>({Frame,Vector:new Float32Array([0,0,0])})))};
 const beforeKeys=center.Translation.Keys.filter(k=>k.Frame<start||(inPlace&&k.Frame>end));
 const drawn=new DrawnModel(generateMDX(model),1);
 const translations:mdx.AnimKeyframe[]=[];
 for(const {frame}of phases){const triangle=drawn.triangles(index,frame/60,1);let lowest=Infinity;for(let i=1;i<triangle.length;i+=2)lowest=Math.min(lowest,triangle[i]!);const old=center.Translation.Keys.find(k=>k.Frame===start+Math.round(frame*1000/60));translations.push({Frame:start+Math.round(frame*1000/60),Vector:(action.pose==="ledgeHang"?hangRoot(drawn,index,frame/60,old?.Vector):undefined)??new Float32Array([(old?.Vector[0]??0)+(beatAt(frame)?.g.tx??0),old?.Vector[1]??0,(old?.Vector[2]??0)-(action.air||action.pose==="upSpecial"?0:lowest)]),...(center.Translation.LineType>1?{InTan:new Float32Array([0,0,0]),OutTan:new Float32Array([0,0,0])}:{})});}
 center.Translation.Keys=[...beforeKeys,...translations].sort((a,b)=>a.Frame-b.Frame);
 const victimContact=/^victim(Pummel|Throw)/.test(action.pose);
 const pairedContact=/^(pummel|throw|victimPummel|victimThrow)/.test(action.pose)?`, contact: ${seconds(victimContact?0.5:action.contact/60)}`:"";
 const binding=`{ index: ${index}, seconds: ${seconds(victimContact?1:(end-start)/1000)}, aligned: true${pairedContact} }`;
 if(ordinal<actions.length)bindings.push(`  ${action.pose}: ${binding},`);else damageBindings.push(`  ${binding},`);
 records.push({pose:name,index,frames:victimContact?60:action.frames,contact:victimContact?30:action.contact});
}

if(!inPlace){
const upTiltOrdinal=actions.findIndex(action=>action.pose==="upTilt"),upTiltAction=actions[upTiltOrdinal]!,upTiltIndex=source.Sequences.length+upTiltOrdinal;
const upTiltSequence=model.Sequences[upTiltIndex]!,upTiltStart=upTiltSequence.Interval[0],upTiltEnd=upTiltSequence.Interval[1];
const upTiltFrame=(frame:number)=>upTiltStart+Math.round(frame*1000/60),upTiltCoil=upTiltFrame(upTiltAction.contact-3);
tracks(model,(track,path)=>{
 if(onGlobalClock(track))return;
 const first=track.Keys.find(key=>key.Frame===upTiltStart),coil=track.Keys.find(key=>key.Frame===upTiltCoil),hold=track.Keys.find(key=>key.Frame===upTiltFrame(upTiltAction.contact+4)),last=track.Keys.find(key=>key.Frame===upTiltEnd);
 const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path),node=match?model[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
 if(first&&coil&&node&&/^Bone_Leg[12]_[LR]$/.test(node.Name)){coil.Vector=rotated(first.Vector,node.Name.startsWith("Bone_Leg1")?-35:90);if(coil.InTan){coil.InTan=coil.Vector.slice();coil.OutTan=coil.Vector.slice();}}
 if(hold)hold.Frame=upTiltFrame(upTiltAction.contact+3);
 if(last)track.Keys.push({...structuredClone(last),Frame:upTiltFrame(upTiltAction.contact+7)});
 track.Keys.sort((a,b)=>a.Frame-b.Frame);
});
for(const frame of [0,upTiltAction.contact-3,upTiltAction.contact+7,upTiltAction.frames]) aimArm(upTiltIndex,upTiltStart,{...upTiltAction,contact:frame},[{frame,amount:1}],true,[32,-18,38],[1,0,-0.5]);
const upTiltDrawn=new DrawnModel(generateMDX(model),1),upTiltTriangles=upTiltDrawn.triangles(upTiltIndex,(upTiltCoil-upTiltStart)/1000,1);
let upTiltFloor=Infinity;for(let i=1;i<upTiltTriangles.length;i+=2)upTiltFloor=Math.min(upTiltFloor,upTiltTriangles[i]!);
const upTiltRoot=model.Nodes.find(node=>node?.Name==="Bone_Root")!.Translation!.Keys.find(key=>key.Frame===upTiltCoil)!;upTiltRoot.Vector[2]!-=upTiltFloor;
}

if(!inPlace)for(const [ordinal,action]of actions.entries())if(/^victim(Pummel|Throw)/.test(action.pose)){
 const sequence=model.Sequences[source.Sequences.length+ordinal]!,[first,last]=sequence.Interval,contact=first!+Math.round(action.contact*1000/60),start=cursor;cursor=start+1100;
 tracks(model,track=>{if(onGlobalClock(track))return;for(const key of track.Keys)if(key.Frame>=first!&&key.Frame<=last!)key.Frame=start+(key.Frame<=contact?Math.round((key.Frame-first!)/(contact-first!)*500):500+Math.round((key.Frame-contact)/(last!-contact)*500));track.Keys.sort((a,b)=>a.Frame-b.Frame);});
 sequence.Interval=new Uint32Array([start,start+1000]);
}
if(bakedKeys){
 const action=actions.find(a=>a.pose===replaced[0])!,index=model.Sequences.findIndex(s=>s.Name===`Medivh ${action.pose}`),[start,end]=model.Sequences[index]!.Interval as unknown as [number,number];
 const authored=await Bun.file(bakedKeys).json() as {frames:number;nodes:{rotation:number[][];translation:number[][]}[]};
 ensure(authored.frames===action.frames&&authored.nodes.length===skeleton.length,`${action.pose}: Blender keys cover ${authored.frames} frames of ${authored.nodes.length} nodes, the move ${action.frames} of ${skeleton.length}`);
 const at=(frame:number)=>start+Math.round(frame*1000/60);
 for(const [node,{n}]of skeleton.entries())for(const kind of ["Rotation","Translation"] as const){
  const track=n[kind];if(!track||onGlobalClock(track))continue;
  const baked=authored.nodes[node]![kind==="Rotation"?"rotation":"translation"];
  track.Keys=[...track.Keys.filter(k=>k.Frame<start||k.Frame>end),...baked.map((v,frame)=>{const Vector=Float32Array.from(v);return {Frame:at(frame),Vector,...(track.LineType>=mdx.LineType.Hermite?{InTan:Vector.slice(),OutTan:Vector.slice()}:{})};})].sort((a,b)=>a.Frame-b.Frame);
 }
 const root=model.Nodes.find(n=>n?.Name==="Bone_Root")!.Translation!,drawn=new DrawnModel(generateMDX(model),1);
 for(let frame=0;frame<=action.frames;frame++){const triangles=drawn.triangles(index,frame/60,1);let lowest=Infinity;for(let i=1;i<triangles.length;i+=2)lowest=Math.min(lowest,triangles[i]!);root.Keys.find(k=>k.Frame===at(frame))!.Vector[2]!-=lowest;}
 ensure(end===at(action.frames),`${action.pose}: timing changed`);
}
const bytes=encodeVerified(parseSource(generateMDX(model)));mkdirSync(output,{recursive:true});await Bun.write(join(output,"medivh.mdx"),bytes);
const clipTable=join(project,"ts/src/game/presentation/heroes/medivhClips.ts");
if(inPlace){let table=await Bun.file(clipTable).text();for(const binding of bindings){const line=new RegExp(`^  ${binding.trim().split(":")[0]}: .*,$`,"m");ensure(line.test(table),`${binding}: no binding to replace`);table=table.replace(line,()=>binding);}await Bun.write(clipTable,table);}
else await Bun.write(clipTable,[
 "// Generated by tools/animations/medivh-clips.ts from the stock classic Medivh rig.",'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClip, HeroClipTable } from "../../sim/heroes/hero";',
 'export const MEDIVH_MODEL_FILE = '+JSON.stringify("units\\creeps\\Medivh\\Medivh.mdl")+';',
 'export const MEDIVH_FALLBACK: HeroClip = { index: 0, seconds: 1.5 };',
 'export const MEDIVH_CLIPS = { idle: MEDIVH_FALLBACK, walk: { index: 1, seconds: f32(0.933) }, dash: { index: 1, seconds: f32(0.933) }, run: { index: 1, seconds: f32(0.933) }, ko: { index: 2, seconds: f32(1.734) },',...bindings,'} as const satisfies HeroClipTable;',
 'export const MEDIVH_DAMAGE_CLIPS: readonly HeroClip[] = [',...damageBindings,'];',"",
].join("\n"));
const finalDrawn=new DrawnModel(bytes,1.0);
const beforeDrawn=new DrawnModel(generateMDX(source),1.0);
const authored=new Set(records.map(record=>record.index));
for(const [index,sequence] of source.Sequences.entries()) if(!authored.has(index)&&(inPlace||index<22)) for(const phase of [0,0.5,1]) { const time=(sequence.Interval[1]-sequence.Interval[0])*phase/1000; const before=beforeDrawn.triangles(index,time,1), after=finalDrawn.triangles(index,time,1); ensure(before.length===after.length&&before.every((v,i)=>Math.abs(v-after[i]!)<0.001),`Medivh clip ${index} changed`); }
for(const pose of ["dashAttack","forwardTilt","forwardTiltUp","forwardTiltDown","upTilt","downTilt","downSmash","backAir","downAir","neutralSpecial","sideSpecial","upSpecial","downSpecial","rollForward","getUp","getUpAttack","grab","grabHold","pummel","throwForward","throwBack","throwUp","throwDown"]){const i=actions.findIndex(a=>a.pose===pose);if(i<0)continue;const action=actions[i]!,sequence=records[i]!.index;const panels:PoseFrame[]=[1,-1].flatMap(facing=>[0,Math.max(1,action.contact-3),action.contact,action.contact+4,action.frames].map(frame=>({frame,phase:frame<action.contact?AttackPhase.startup:frame<=action.contact+4?AttackPhase.active:AttackPhase.recovery,x:0,z:0,facing,parts:[],strikes:[],clip:sequence,seconds:Math.min(action.frames,frame)/60})));await Bun.write(join(output,`${pose}.png`),sheet(`Medivh ${pose}`,finalDrawn,panels,5).png);}
await Bun.write(join(output,"medivh-clips.json"),JSON.stringify({stockSequences:source.Sequences.length,appended:records.length,records},null,2)+"\n");console.log(`MEDIVH_CLIPS_PASS ${records.length} authored clips; ${source.Sequences.length} stock sequences retained; private output ${output}`);

}, catch: cause => new ClipFailure({ cause }) }));
