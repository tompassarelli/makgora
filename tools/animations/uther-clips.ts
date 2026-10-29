import { NO_GLOBAL_SEQ, type KeyVector } from './animVector';
import { BunRuntime } from "../../ts/node_modules/@effect/platform-bun/dist/index.js";
import { Effect, Schema } from "effect";
import { mkdirSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { generateMDX, ModelRenderer, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackStyle, AttackPhase, Character, GrabAction } from "../../ts/src/game/sim/codes";
import { heroDefinition } from "../../ts/src/game/roster/kits";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { DOWN_DAMAGE_FRAMES, DOWN_ROLL_FRAMES, TECH_ROLL_FRAMES } from "../../ts/src/game/sim/down";
import { LEDGE_ROLL_FRAMES } from "../../ts/src/game/sim/ledge";
import { GROUND_ROLL_FRAMES } from "../../ts/src/game/sim/conditions";
import { STOCK_MODEL_SCALES } from "../../ts/src/game/presentation/modelScale";
import { HAMMER_SLIDE, UTHER_HAMMER_SWINGS, swingGrip, type HammerSwing } from "../../ts/src/game/fighters/uther/moves";
import { UTHER_SPECIAL_SWINGS } from "../../ts/src/game/fighters/uther/specials";
import { seconds } from "./asset-info";
import { highestGrip, ledgeGripOffset } from "./ledge-grip";
import { ensure, parseSource, tracks, onGlobalClock, encodeVerified } from "./original-clips";
class ClipFailure extends Schema.TaggedError<ClipFailure>()("ClipFailure", { cause: Schema.Unknown }) {}
const args = process.argv.slice(2), [input, output] = args.slice(0, 2).map(p => resolve(p));
const replaced = args.slice(2) as HeroPose[], inPlace = replaced.length > 0;
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/uther-clips.ts STOCK_UTHER.mdx|SHIPPED_UTHER.mdx PRIVATE_OUTPUT [POSE...]");
const source = parseSource(await Bun.file(input).arrayBuffer()), model = structuredClone(source);
ensure((inPlace ? source.Sequences.some(s => s.Name === "Uther Damage 0 0") : source.Sequences.length === 13) && source.Bones.some(b => b.Name === "Hammer"), "Expected original classic Uther");
const stand = source.Sequences[1]!;
const hero = heroDefinition(Character.uther); ensure(hero, "Register Uther before exporting his clips");
const SCALE = STOCK_MODEL_SCALES[Character.uther].scale, GRIP_Y = -24, OFF_Y = 14, FOOT_REST = 10.6;
type Point = readonly [number, number, number];
const node = (name: string) => { const found = model.Nodes.find(n => n?.Name === name); ensure(found, `Uther has no ${name}`); return found!; };
const hammer = node("Hammer"), handR = node("HandR");
const handPivot = Array.from(source.PivotPoints[handR.ObjectId]!);
const hammerVerts: number[][] = [];
for (const g of source.Geosets) for (let v = 0; v < g.Vertices.length / 3; v++) if (g.Groups[g.VertexGroup[v]!]?.includes(hammer.ObjectId)) hammerVerts.push(Array.from(g.Vertices.subarray(3 * v, 3 * v + 3)));
const butt = hammerVerts.reduce((far, p) => Math.hypot(...p.map((x, i) => x - handPivot[i]!)) > Math.hypot(...far.map((x, i) => x - handPivot[i]!)) ? p : far);
const axis = butt.map((x, i) => x - handPivot[i]!), axisLength = Math.hypot(...axis);
const headSide = hammerVerts.filter(p => p.reduce((s, x, i) => s + (x - handPivot[i]!) * axis[i]! / axisLength, 0) < 0);
const HEAD_BIND = [0, 1, 2].map(i => headSide.reduce((s, p) => s + p[i]!, 0) / headSide.length);
const attack2 = source.Sequences.findIndex(s => s.Name === "Attack - 2");
const slideKeys = (hammer.Translation?.Keys ?? []).filter(k => k.Frame >= source.Sequences[attack2]!.Interval[0] && k.Frame <= source.Sequences[attack2]!.Interval[1]);
const SLIDE = Array.from(slideKeys.reduce((far, k) => Math.hypot(...k.Vector) > Math.hypot(...far.Vector) ? k : far).Vector);
const HANG_SLACK=8,hangHands=["HandL","HandR"].map(name=>model.Nodes.findIndex(n=>n?.Name===name));
function hangRoot(drawn:DrawnModel,index:number,time:number,old?:ArrayLike<number>){const [x,z]=ledgeGripOffset(drawn,index,time,highestGrip(drawn,index,time,hangHands),Character.uther);return new Float32Array([(old?.[0]??0)+x-HANG_SLACK,old?.[1]??0,(old?.[2]??0)+z]);}
interface Gesture { chest?: number; waist?: number; arm?: number; wrist?: number; leftArm?: number; leftWrist?: number; head?: number; front?: number; back?: number; kneeFront?: number; kneeBack?: number; yaw?: number; lean?: number; }
interface Beat { frame: number; g: Gesture; hand: Point; direction: Point; offHand?: Point; slide: number; }
interface Action { pose: HeroPose; frames: number; contact: number; gesture: Gesture; hold?: boolean; air?: boolean; roll?: number; beats?: readonly Beat[]; slide?: number; }
const forward: Gesture = {chest:20,arm:-80,wrist:15,leftArm:-55,head:-12,front:18,back:-12};
const overhead: Gesture = {chest:-12,arm:-140,wrist:10,leftArm:-85,head:-10,front:-12,back:10};
const low: Gesture = {chest:42,arm:20,wrist:35,leftArm:-35,head:-24,front:-75,back:-65,kneeFront:120,kneeBack:110};
const back: Gesture = {chest:-12,arm:55,wrist:25,leftArm:-30,head:15,yaw:155,front:12,back:12};
const cast: Gesture = {chest:-12,arm:-120,wrist:20,leftArm:-90,head:-15,front:10};
const brace: Gesture = {chest:16,arm:-30,wrist:25,leftArm:-45,head:-8,front:22,back:22};
const tuck: Gesture = {front:-55,back:35,kneeFront:95,kneeBack:85};
const SWING_BODY: Partial<Record<HeroPose, Gesture>> = {
 jab:{chest:10,front:16,back:-10}, forwardTilt:{chest:18,front:22,back:-16,head:-10}, forwardTiltUp:{chest:8,front:20,back:-14}, forwardTiltDown:{chest:26,front:24,back:-18,head:-14},
 upTilt:{chest:-12,front:8,back:-4}, downTilt:{...low,lean:6}, dashAttack:{lean:12,chest:22,front:34,back:-26,head:-10},
 forwardSmash:{chest:30,waist:-10,front:30,back:-24,head:-12}, upSmash:{chest:-20,front:6,back:6,head:-15}, downSmash:{...low},
 neutralAir:tuck, forwardAir:{...tuck,chest:24}, backAir:{...tuck,chest:-10}, upAir:{...tuck,chest:-18,head:-18}, downAir:{front:-35,back:-35,kneeFront:70,kneeBack:70,chest:20},
 sideSpecial:{chest:22,front:30,back:-24,head:-10}, upSpecial:{...tuck,chest:-14,head:-16},
};
const WIND: Partial<Record<HeroPose, number>> = { downAir: 80, backAir: 0, neutralAir: 90, jab: -40, upSpecial: -40, dashAttack: -4, forwardTilt: 160, forwardTiltUp: 170, forwardTiltDown: 150 };
const LEAD: Partial<Record<HeroPose, number>> = { sideSpecial: 14, dashAttack: 8 };
const SWINGS: Partial<Record<HeroPose, HammerSwing>> = { ...UTHER_HAMMER_SWINGS, ...UTHER_SPECIAL_SWINGS };
const unit = (angle: number): Point => [Math.cos(angle * Math.PI / 180), 0, Math.sin(angle * Math.PI / 180)];
const inModel = ([x, z]: readonly [number, number], y = GRIP_Y): Point => [x / SCALE, y, z / SCALE];
function swingBeats(pose: HeroPose, swing: HammerSwing, total: number): Beat[] {
 const first = swing.beats[0]!, last = swing.beats.at(-1)!, sign = Math.sign(last.angle - first.angle) || -1;
 const lead = LEAD[pose] ?? Math.min(6, Math.max(2, Math.round((first.frame - 1) / 2)));
 const wind = { frame: Math.max(1, first.frame - lead), angle: WIND[pose] ?? first.angle - sign * 70 };
 const follow = { frame: Math.min(total - 2, last.frame + 4), angle: last.angle + sign * 30 };
 const body = SWING_BODY[pose] ?? {};
 const windBody = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, k === "chest" || k === "lean" ? -0.4 * v : 0.6 * v])) as Gesture;
 const slide = HAMMER_SLIDE[swing.grip];
 const beat = (frame: number, angle: number, g: Gesture): Beat => {
  const direction = unit(angle), grip = inModel(swingGrip(swing, angle));
  return { frame: Math.max(1, frame - 1), g, hand: grip, direction, offHand: [grip[0] - 14 * direction[0], OFF_Y, grip[2] - 14 * direction[2]], slide };
 };
 return [beat(wind.frame, wind.angle, windBody), ...swing.beats.map(b => beat(b.frame, b.angle, body)), beat(follow.frame, follow.angle, body)];
}
const actions: Action[] = [];
const normals: readonly [HeroPose, AttackStyle, Gesture][] = [
 ["jab",AttackStyle.jab,forward], ["jab2",AttackStyle.jab2,{...forward,chest:24,leftArm:-90}],
 ["forwardTilt",AttackStyle.forwardTilt,forward], ["forwardTiltUp",AttackStyle.forwardTiltUp,forward], ["forwardTiltDown",AttackStyle.forwardTiltDown,forward],
 ["upTilt",AttackStyle.upTilt,overhead], ["downTilt",AttackStyle.downTilt,low], ["dashAttack",AttackStyle.dashAttack,forward],
 ["forwardSmash",AttackStyle.forwardSmash,forward], ["upSmash",AttackStyle.upSmash,overhead], ["downSmash",AttackStyle.downSmash,low],
 ["neutralAir",AttackStyle.neutralAir,forward], ["forwardAir",AttackStyle.forwardAir,forward], ["backAir",AttackStyle.backAir,back], ["upAir",AttackStyle.upAir,overhead], ["downAir",AttackStyle.downAir,low],
];
for (const [pose,style,gesture] of normals) { const move=hero.moves.normals[style];ensure(move,`${pose}: missing move timing`); const swing=SWINGS[pose]; actions.push({pose,frames:move.totalFrames,contact:move.startupFrames,gesture,air:pose.endsWith("Air"),beats:swing?swingBeats(pose,swing,move.totalFrames):undefined,slide:swing?HAMMER_SLIDE[swing.grip]:undefined}); }
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
for(const [pose,key,gesture]of [["neutralSpecial","neutral",cast],["sideSpecial","side",forward],["upSpecial","up",{...overhead,front:-55,back:35,lean:-15}],["downSpecial","down",{...brace,head:22,chest:10,kneeFront:40,kneeBack:30}]] as const){
 const move=hero.specials?.[key]; ensure(move,`${pose}: missing special`);
 for(const air of [false,true]) { const form = air ? move.air ?? move.ground : move.ground; const contact = Math.min(...[...(form.regions?.map(r=>r.firstFrame)??[]),...(form.motion?.map(r=>r.first)??[]),...(form.projectiles?.map(r=>r.spawnFrame)??[]),...(form.guard?[form.guard.first]:[]),form.endFrame]); const swing=SWINGS[pose]; actions.push({pose:(air?`${pose}Air`:pose) as HeroPose,frames:form.endFrame,contact:Math.max(3,contact),gesture,air,beats:swing?swingBeats(pose,swing,form.endFrame):undefined,slide:swing?HAMMER_SLIDE[swing.grip]:undefined}); }
}
function rotated(q: ArrayLike<number>, y:number,z=0){const a=y*Math.PI/360,b=z*Math.PI/360;const u=[-Math.sin(a)*Math.sin(b),Math.sin(a)*Math.cos(b),Math.cos(a)*Math.sin(b),Math.cos(a)*Math.cos(b)];const [x=0,v=0,w=0,t=1]=Array.from(q);const [i=0,j=0,k=0,l=1]=u;return new Float32Array([l*x+i*t+j*w-k*v,l*v-i*w+j*t+k*x,l*w+i*v-j*x+k*t,l*t-i*x-j*v-k*w]);}
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
const ARM_BONES = { L: ["UpArmL", "LowArmL", "HandL"], R: ["UpArmR", "LowArmR", "HandR"] } as const;
function aimArm(index:number,start:number,action:Action,phases:readonly Phase[],left:boolean,target:Point,direction?:Point) {
 const renderer=new ModelRenderer(model),data=Reflect.get(renderer,"rendererData");renderer.setSequence(index);
 const [armName,elbowName,handName]=ARM_BONES[left?"L":"R"],arm=node(armName),elbow=node(elbowName),hand=node(handName);
 const sample=start+Math.round(action.contact*1000/60);data.frame=sample;
 const base=(n:mdx.Node)=>source.Nodes[n.ObjectId]?.Rotation?.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1])?.Vector??new Float32Array([0,0,0,1]);
 const key=(n:mdx.Node,frame:number)=>n.Rotation!.Keys.find(k=>k.Frame===start+Math.round(frame*1000/60))!;
 const set=(n:mdx.Node,frame:number,q:KeyVector)=>{const k=key(n,frame);k.Vector=q;if(k.InTan){k.InTan=q.slice();k.OutTan=q.slice();}};
 const apply=(m:ArrayLike<number>,p:ArrayLike<number>):Point=>[m[0]!*p[0]!+m[4]!*p[1]!+m[8]!*p[2]!+m[12]!,m[1]!*p[0]!+m[5]!*p[1]!+m[9]!*p[2]!+m[13]!,m[2]!*p[0]!+m[6]!*p[1]!+m[10]!*p[2]!+m[14]!];
 const point=(n:mdx.Node):Point=>apply(data.nodes[n.ObjectId].matrix,model.PivotPoints[n.ObjectId]!);
 const armBase=base(arm),elbowBase=base(elbow),handBase=base(hand),gesture=action.gesture,angles=[left?gesture.leftArm??0:gesture.arm??0,0,left?gesture.leftWrist??0:gesture.wrist??0,0];set(hand,action.contact,handBase.slice());
 const loss=()=>{set(arm,action.contact,rotated(armBase,angles[0]!,angles[1]!));set(elbow,action.contact,rotated(elbowBase,angles[2]!,angles[3]!));renderer.update(0);const p=point(hand);return p.reduce((sum,v,i)=>sum+(v-target[i]!)**2,0);};
 for(const step of [30,10,3,1])for(let pass=0;pass<2;pass++)for(let dim=0;dim<4;dim++){const origin=angles[dim]!,range=step===30?180:step*3;let best=loss(),angle=origin;for(let delta=-range;delta<=range;delta+=step){angles[dim]=origin+delta;const score=loss();if(score<best){best=score;angle=angles[dim]!;}}angles[dim]=angle;}
 loss();
 let handDelta=new Float32Array([0,0,0,1]);
 if(direction){const tip=apply(data.nodes[hammer.ObjectId].matrix,HEAD_BIND),grip=point(hand),m=data.nodes[hand.Parent!].matrix;
  const local=(v:Point)=>[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[4]*v[0]+m[5]*v[1]+m[6]*v[2],m[8]*v[0]+m[9]*v[1]+m[10]*v[2]];
  const a=local([tip[0]-grip[0],tip[1]-grip[1],tip[2]-grip[2]]),b=local(direction),al=Math.hypot(...a),bl=Math.hypot(...b);for(let i=0;i<3;i++){a[i]!/=al;b[i]!/=bl;}
  const q=[a[1]!*b[2]!-a[2]!*b[1]!,a[2]!*b[0]!-a[0]!*b[2]!,a[0]!*b[1]!-a[1]!*b[0]!,1+a.reduce((s,v,i)=>s+v*b[i]!,0)],length=Math.hypot(...q);handDelta=new Float32Array(q.map(v=>v/length));
 }
 for(const {frame,amount}of phases){set(arm,frame,rotated(armBase,angles[0]!*amount,angles[1]!*amount));set(elbow,frame,rotated(elbowBase,angles[2]!*amount,angles[3]!*amount));if(direction)set(hand,frame,multiply(scaledRotation(handDelta,amount),handBase));}
}
function contactAim(pose:HeroPose):{hand:Point;direction?:Point;left?:boolean}|undefined {
 if(pose==="jab2")return {hand:[50,OFF_Y,72],left:true};
 if(pose==="neutralSpecial"||pose==="neutralSpecialAir")return {hand:[6,GRIP_Y,104],direction:[0.15,0,1]};
 if(pose==="downSpecial"||pose==="downSpecialAir")return {hand:[20,GRIP_Y,64],direction:[0.05,0,1]};
 if(pose==="getUpAttack"||pose==="throwDown")return {hand:[30,GRIP_Y,30],direction:[1,0,-0.3]};
 if(pose==="backAir"||pose==="throwBack")return {hand:[-30,GRIP_Y,65],direction:[-1,0,0]};
 if(pose==="upSmash"||pose==="throwUp")return {hand:[8,GRIP_Y,110],direction:[0,0,1]};
 if(["ledgeAttack","throwForward"].includes(pose))return {hand:[30,GRIP_Y,62],direction:[1,0,0]};
 return undefined;
}
function joint(name:string,g:Gesture):[number,number]{
 if(name==="Bone_Chest")return [g.chest??0,g.yaw??0];
 if(name==="Pelvis")return [g.waist??0,0];
 if(name==="UpArmR")return [g.arm??0,0];
 if(name==="LowArmR")return [g.wrist??0,0];
 if(name==="UpArmL")return [g.leftArm??0,0];
 if(name==="LowArmL")return [g.leftWrist??0,0];
 if(name==="Bone_Head")return [g.head??0,0];
 if(name==="UpperLegL"||name==="UpperLegR")return [name==="UpperLegL"?g.front??0:g.back??0,0];
 if(name==="LowerLegL"||name==="LowerLegR")return [name==="LowerLegL"?g.kneeFront??Math.abs(g.front??0):g.kneeBack??Math.abs(g.back??0),0];
 if(name==="Root")return [g.lean??0,0];
 return [0,0];
}
const originals=new Map<string,mdx.AnimVector>();tracks(source,(t,p)=>originals.set(p,t));
let cursor=Math.max(...source.Sequences.map(s=>s.Interval[1]))+100;
const bindings:string[]=[],damageBindings:string[]=[], records:{pose:string;index:number;frames:number;contact:number}[]=[];
const damageActions:Action[]=[];
for(let height=0;height<3;height++)for(let strength=0;strength<3;strength++){const gain=[0.45,0.8,1.2][strength]!;if(!inPlace)damageActions.push({pose:"damageGround",frames:24,contact:3,hold:true,gesture:height===0?{front:65*gain,back:55*gain,waist:25*gain,chest:25*gain,head:-15*gain}:height===1?{chest:55*gain,waist:-25*gain,arm:30*gain,leftArm:35*gain}:{head:-45*gain,chest:-35*gain,arm:45*gain,leftArm:55*gain}});}
if(inPlace){ensure(replaced.every(pose=>actions.some(action=>action.pose===pose)),`unknown pose in ${replaced.join(" ")}`);actions.splice(0,actions.length,...actions.filter(action=>replaced.includes(action.pose)));}
const hammerTranslation=`.Bones.${source.Bones.findIndex(b=>b.Name==="Hammer")}.Translation`;
const footNodes=["FootL","FootR"].map(name=>model.Nodes.findIndex(n=>n?.Name===name));
function placeSequence(name:string,action:Action){
 const existing=inPlace?model.Sequences.findIndex(sequence=>sequence.Name===name):-1;ensure(!inPlace||existing>=0,`${name}: shipped sequence missing`);
 const index=existing>=0?existing:model.Sequences.length,start=existing>=0?model.Sequences[index]!.Interval[0]!:cursor,end=start+Math.round(action.frames*1000/60);
 if(existing>=0){const shipped=model.Sequences[index]!.Interval[1]!,next=Math.min(...model.Sequences.map(sequence=>sequence.Interval[0]!).filter(first=>first>start));ensure(end<next,`${name}: no room before the next sequence`);
  tracks(model,track=>{if(!onGlobalClock(track))track.Keys=track.Keys.filter(key=>key.Frame<start||key.Frame>Math.max(end,shipped));});model.Sequences[index]!.Interval=new Uint32Array([start,end]);}
 else{cursor=end+100;model.Sequences.push({...stand,Name:name,Interval:new Uint32Array([start,end]),NonLooping:true,MoveSpeed:0,Rarity:0,MinimumExtent:new Float32Array([-300,-300,-200]),MaximumExtent:new Float32Array([300,300,350]),BoundsRadius:400});}
 return {index,start,end};
}
function phasesOf(action:Action){
 const beatAt=(frame:number)=>action.beats?.find(beat=>beat.frame===frame);
 const phaseFrames=action.beats?[...new Set([0,...action.beats.map(beat=>beat.frame),action.frames])].sort((a,b)=>a-b):[...new Set([0,Math.max(1,action.contact-3),action.contact,Math.min(action.frames-1,action.contact+4),action.frames,...action.roll?[0.25,0.5,0.75].map(p=>Math.round(action.frames*p)):[]])].sort((a,b)=>a-b);
 const phases=phaseFrames.map(frame=>({frame,amount:action.beats?beatAt(frame)?1:0:action.hold?1:action.roll?Math.sin(Math.PI*frame/action.frames):frame===0||frame===action.frames?0:frame===Math.max(1,action.contact-3)?-0.3:1}));
 return {beatAt,phases};
}
function keyPose(start:number,action:Action,phases:readonly Phase[],beatAt:(frame:number)=>Beat|undefined){
 tracks(model,(track,path)=>{
  const donor=originals.get(path);if(!donor||onGlobalClock(donor))return;
  let first=donor.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);
  if(!first&&/^\.(Bones|Helpers)\.\d+\.(Rotation|Translation|Scaling)$/.test(path)){const Vector=new Float32Array(path.endsWith("Rotation")?[0,0,0,1]:path.endsWith("Scaling")?[1,1,1]:[0,0,0]);first={Frame:stand.Interval[0],Vector,...track.LineType>1?{InTan:Vector.slice(),OutTan:Vector.slice()}: {}};}
  if(!first)return;
  const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path),bone=match?source[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
  for(const {frame,amount}of phases){let Vector=first.Vector.slice();if(bone){let[y,z]=joint(bone.Name,beatAt(frame)?.g??action.gesture);if(bone.Name==="Root"&&action.roll)y=frame/action.frames*360*action.roll;else y*=amount;z*=amount;if(bone.Name==="Root"&&(action.pose==="getUp"||action.pose==="getUpAttack")&&frame<action.contact)y=85*(1-frame/action.contact);Vector=rotated(first.Vector,y,z);}
   if(path===hammerTranslation&&action.slide!==undefined&&frame>0&&frame<action.frames)Vector=new Float32Array(SLIDE.map(v=>v*action.slide!));
   const tangent=()=>match||track.LineType===mdx.LineType.Bezier?Vector.slice():new Float32Array(Vector.length);
   track.Keys.push({...first,Frame:start+Math.round(frame*1000/60),Vector,...first.InTan?{InTan:tangent(),OutTan:tangent()}: {}});
  }
 });
 if(inPlace)tracks(model,track=>track.Keys.sort((a,b)=>a.Frame-b.Frame));
}
function aimArms(ordinal:number,index:number,start:number,action:Action,phases:readonly Phase[]){
 if(action.beats)for(const beat of action.beats){aimArm(index,start,{...action,contact:beat.frame},[{frame:beat.frame,amount:1}],false,beat.hand,beat.direction);if(beat.offHand)aimArm(index,start,{...action,contact:beat.frame},[{frame:beat.frame,amount:1}],true,beat.offHand);}
 const aim=contactAim(action.pose);if(ordinal<actions.length&&aim&&!action.beats)aimArm(index,start,action,phases,aim.left===true,aim.hand,aim.direction);
 if(["grab","grabHold","pummel","throwForward","neutralSpecial","neutralSpecialAir"].includes(action.pose))aimArm(index,start,action,phases,true,[36,OFF_Y,70]);
 if(["downSpecial","downSpecialAir"].includes(action.pose))aimArm(index,start,action,phases,true,[22,OFF_Y,58]);
}
function plantRoot(index:number,start:number,end:number,action:Action,phases:readonly Phase[]){
 const center=model.Nodes.find(b=>b.Name==="Root");ensure(center,"No Uther root");
 if(!center.Translation)center.Translation={LineType:1,GlobalSeqId: NO_GLOBAL_SEQ,Keys:source.Sequences.flatMap(s=>Array.from(s.Interval).map(Frame=>({Frame,Vector:new Float32Array([0,0,0])})))};
 const beforeKeys=center.Translation.Keys.filter(k=>k.Frame<start||(inPlace&&k.Frame>end));
 const drawn=new DrawnModel(generateMDX(model),1);
 const translations:mdx.AnimKeyframe[]=[];
 for(const {frame}of phases){const posed=drawn.posed(index,frame/60,1);const lowest=Math.min(...footNodes.map(n=>posed.nodes[n*2+1]!))-FOOT_REST;const old=center.Translation.Keys.find(k=>k.Frame===start+Math.round(frame*1000/60));translations.push({Frame:start+Math.round(frame*1000/60),Vector:(action.pose==="ledgeHang"?hangRoot(drawn,index,frame/60,old?.Vector):undefined)??new Float32Array([old?.Vector[0]??0,old?.Vector[1]??0,(old?.Vector[2]??0)-(action.air||action.pose.startsWith("upSpecial")?0:lowest)]),...(center.Translation.LineType>1?{InTan:new Float32Array([0,0,0]),OutTan:new Float32Array([0,0,0])}:{})});}
 center.Translation.Keys=[...beforeKeys,...translations].sort((a,b)=>a.Frame-b.Frame);
}
function bindAction(ordinal:number,name:string,index:number,start:number,end:number,action:Action){
 const victimContact=/^victim(Pummel|Throw)/.test(action.pose);
 const pairedContact=/^(pummel|throw|victimPummel|victimThrow)/.test(action.pose)?`, contact: ${seconds(victimContact?0.5:action.contact/60)}`:"";
 const binding=`{ index: ${index}, seconds: ${seconds(victimContact?1:(end-start)/1000)}, aligned: true${pairedContact} }`;
 if(ordinal<actions.length)bindings.push(`  ${action.pose}: ${binding},`);else damageBindings.push(`  ${binding},`);
 records.push({pose:name,index,frames:victimContact?60:action.frames,contact:victimContact?30:action.contact});
}
function bakeAction(ordinal:number,action:Action){
 const name=ordinal<actions.length?`Uther ${action.pose}`:`Uther Damage ${Math.floor((ordinal-actions.length)/3)} ${((ordinal-actions.length)%3)}`;
 const {index,start,end}=placeSequence(name,action);
 const {beatAt,phases}=phasesOf(action);
 keyPose(start,action,phases,beatAt);
 aimArms(ordinal,index,start,action,phases);
 plantRoot(index,start,end,action,phases);
 bindAction(ordinal,name,index,start,end,action);
}
function retimeVictims(){
if(!inPlace)for(const [ordinal,action]of actions.entries())if(/^victim(Pummel|Throw)/.test(action.pose)){
 const sequence=model.Sequences[source.Sequences.length+ordinal]!,[first,last]=sequence.Interval,contact=first!+Math.round(action.contact*1000/60),start=cursor;cursor=start+1100;
 tracks(model,track=>{if(onGlobalClock(track))return;for(const key of track.Keys)if(key.Frame>=first!&&key.Frame<=last!)key.Frame=start+(key.Frame<=contact?Math.round((key.Frame-first!)/(contact-first!)*500):500+Math.round((key.Frame-contact)/(last!-contact)*500));track.Keys.sort((a,b)=>a.Frame-b.Frame);});
 sequence.Interval=new Uint32Array([start,start+1000]);
}
}
async function writeClipTable(){
const clipTable=join(project,"ts/src/game/fighters/uther/clips.ts");
if(inPlace){let table=await Bun.file(clipTable).text();for(const binding of bindings){const line=new RegExp(`^  ${binding.trim().split(":")[0]}: .*,$`,"m");ensure(line.test(table),`${binding}: no binding to replace`);table=table.replace(line,()=>binding);}await Bun.write(clipTable,table);}
else await Bun.write(clipTable,[
 "// Generated by tools/animations/uther-clips.ts from the stock classic Uther rig.",'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClip, HeroClipTable } from "../../sim/heroes/hero";',
 'export const UTHER_MODEL_FILE = '+JSON.stringify("units\\human\\Uther\\Uther.mdl")+';',
 `export const UTHER_FALLBACK: HeroClip = { index: 1, seconds: ${seconds((stand.Interval[1]-stand.Interval[0])/1000)} };`,
 `export const UTHER_CLIPS = { idle: UTHER_FALLBACK, walk: { index: 12, seconds: ${seconds((source.Sequences[12]!.Interval[1]-source.Sequences[12]!.Interval[0])/1000)} }, dash: { index: 12, seconds: ${seconds((source.Sequences[12]!.Interval[1]-source.Sequences[12]!.Interval[0])/1000)} }, run: { index: 12, seconds: ${seconds((source.Sequences[12]!.Interval[1]-source.Sequences[12]!.Interval[0])/1000)} }, ko: { index: 7, seconds: ${seconds((source.Sequences[7]!.Interval[1]-source.Sequences[7]!.Interval[0])/1000)} },`,...bindings,'} as const satisfies HeroClipTable;',
 'export const UTHER_DAMAGE_CLIPS: readonly HeroClip[] = [',...damageBindings,'];',"",
].join("\n"));
}
function checkStockUnchanged(bytes:ArrayBuffer){
const finalDrawn=new DrawnModel(bytes,1.0);
const beforeDrawn=new DrawnModel(generateMDX(source),1.0);
const authored=new Set(records.map(record=>record.index));
for(const [index,sequence] of source.Sequences.entries()) if(!authored.has(index)&&(inPlace||index<13)) for(const phase of [0,0.5,1]) { const time=(sequence.Interval[1]-sequence.Interval[0])*phase/1000; const before=beforeDrawn.triangles(index,time,1), after=finalDrawn.triangles(index,time,1); ensure(before.length===after.length&&before.every((v,i)=>Math.abs(v-after[i]!)<0.001),`Uther clip ${index} changed`); }
 return finalDrawn;
}
async function writeSheets(finalDrawn:DrawnModel){
for(const pose of ["jab","jab2","forwardTilt","forwardTiltUp","forwardTiltDown","upTilt","downTilt","dashAttack","forwardSmash","upSmash","downSmash","neutralAir","forwardAir","backAir","upAir","downAir","neutralSpecial","sideSpecial","upSpecial","downSpecial","grab","throwForward","throwBack","throwUp","throwDown","getUpAttack","ledgeAttack"] as HeroPose[]){const i=actions.findIndex(a=>a.pose===pose);if(i<0)continue;const action=actions[i]!,sequence=records[i]!.index;const shown=action.beats?[0,...action.beats.map(b=>b.frame),action.frames]:[0,Math.max(1,action.contact-3),action.contact,action.contact+4,action.frames];const panels:PoseFrame[]=[1,-1].flatMap(facing=>shown.map(frame=>({frame,phase:frame<action.contact?AttackPhase.startup:frame<=action.contact+4?AttackPhase.active:AttackPhase.recovery,x:0,z:0,facing,parts:[],strikes:[],clip:sequence,seconds:Math.min(action.frames,frame)/60})));await Bun.write(join(output,`${pose}.png`),sheet(`Uther ${pose}`,finalDrawn,panels,Math.min(8,shown.length)).png);}
}
async function generate(){
 for(const [ordinal,action]of [...actions,...damageActions].entries())bakeAction(ordinal,action);
 retimeVictims();
const bytes=encodeVerified(parseSource(generateMDX(model)));mkdirSync(output,{recursive:true});await Bun.write(join(output,"uther.mdx"),bytes);
 await writeClipTable();
 await writeSheets(checkStockUnchanged(bytes));
await Bun.write(join(output,"uther-clips.json"),JSON.stringify({stockSequences:source.Sequences.length,appended:records.length,records},null,2)+"\n");console.log(`UTHER_CLIPS_PASS ${records.length} authored clips; ${source.Sequences.length} stock sequences retained; private output ${output}`);
}
BunRuntime.runMain(Effect.tryPromise({ try: generate, catch: cause => new ClipFailure({ cause }) }));
