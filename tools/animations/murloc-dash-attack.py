"""Blender boundary: author Murloc's dash attack (#345), a spear lunge driven through Melee's 12 active frames.

The rig comes from `murloc-clips.ts SHIPPED OUT dashAttack --rig RIG.json`: every node becomes a bone with
identity rest orientation, so a bone's local rotation and location are the model's own keys. Each joint is
pitched about the side-view axis in armature space, so the rig's yawed leg frames cannot turn a bend into a
roll; the waist twists about the vertical, and the spear is aimed by the blade axis the rig measures from
its mesh. His round body hides pitch, so the move reads through stance, twist and spear: he rocks back over
a bent back leg wound away with the spear cocked, drives forward square on the first active frame, twists
into a lower, longer lunge with the tip dropping through the last, steps through as the tip dips, then
rises into ready along an even arc-length glide. Clip frame N is attack frame N; `murloc-clips.ts --keys`
splices the baked frames and sets each one on his feet.

  blender --background --factory-startup --python tools/animations/murloc-dash-attack.py -- RIG.json KEYS.json
"""
import json
import sys
from math import cos, radians, sin

import bpy
from mathutils import Matrix, Quaternion, Vector

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
spec = json.loads(open(rig_path).read())
frames, contact, active = spec['frames'], spec['contact'], spec['active']
last = contact + active - 1

bpy.ops.wm.read_factory_settings(use_empty=True)
armature = bpy.data.armatures.new('Murloc')
rig = bpy.data.objects.new('Murloc', armature)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
created = []
for n in spec['nodes']:
    bone = armature.edit_bones.new(n['name'])
    bone.head = Vector(n['pivot'])
    bone.tail = bone.head + Vector((0, 4, 0))
    bone.roll = 0
    created.append(bone.name)
for n, name in zip(spec['nodes'], created):
    if n['parent'] >= 0:
        armature.edit_bones[name].parent = armature.edit_bones[created[n['parent']]]
nodes = dict(zip(created, spec['nodes']))
bpy.ops.object.mode_set(mode='POSE')
bones = rig.pose.bones

JOINTS = {
    'lean': 'Bone_Root', 'twist': 'Bone_Waist', 'waist': 'Bone_Waist', 'chest': 'Bone_Chest', 'head': 'Bone_Head',
    'arm': 'Bone_Arm1_R', 'elbow': 'Bone_Arm2_R', 'leftArm': 'Bone_Arm1_L', 'leftElbow': 'Bone_Arm2_L',
    'front': 'Bone_Leg1_L', 'kneeFront': 'Bone_Leg2_L', 'footFront': 'Bone_Foot_L',
    'back': 'Bone_Leg1_R', 'kneeBack': 'Bone_Leg2_R', 'footBack': 'Bone_Foot_R',
}
ORDER = ['lean', 'twist', 'waist', 'chest', 'head', 'arm', 'elbow', 'leftArm', 'leftElbow',
         'front', 'kneeFront', 'footFront', 'back', 'kneeBack', 'footBack']
HAND = 'Bone_Hand_R'


def rest():
    for b in bones:
        n = nodes[b.name]
        b.rotation_mode = 'QUATERNION'
        x, y, z, w = n['rotation'] or (0, 0, 0, 1)
        b.rotation_quaternion = Quaternion((w, x, y, z))
        b.location = Vector(n['translation'] or (0, 0, 0))
    bpy.context.view_layer.update()


def turn(b, rotation):
    head = b.matrix.to_translation()
    b.matrix = Matrix.Translation(head) @ rotation.to_matrix().to_4x4() @ Matrix.Translation(-head) @ b.matrix
    bpy.context.view_layer.update()


blade_local = Vector(spec['blade']).normalized()


def pose(p):
    rest()
    bones[JOINTS['lean']].location += Vector((p.get('travel', 0), 0, p.get('drop', 0)))
    bpy.context.view_layer.update()
    for joint in ORDER:
        if p.get(joint):
            turn(bones[JOINTS[joint]], Quaternion((0, 0, 1) if joint == 'twist' else (0, 1, 0), radians(p[joint])))
    if 'aim' in p:
        hand = bones[HAND]
        blade = hand.matrix.to_quaternion() @ blade_local
        elevation = radians(p['aim'])
        whole = blade.rotation_difference(Vector((cos(elevation), 0, sin(elevation))))
        turn(hand, Quaternion().slerp(whole, p.get('grip', 1)))


READY = {}
load = dict(twist=-30, lean=-20, chest=-10, head=12, arm=90, elbow=-40, leftArm=-50, aim=115, grip=1,
            front=-30, kneeFront=0, back=25, kneeBack=55, footBack=-20, travel=-34, drop=-6)
strike = dict(twist=0, lean=15, chest=8, head=-12, arm=-90, elbow=-5, leftArm=60, aim=-12, grip=1,
              front=-45, kneeFront=45, footFront=-20, back=30, kneeBack=5, travel=34, drop=-2)
lunge = dict(twist=30, lean=22, chest=10, head=-16, arm=-95, elbow=0, leftArm=70, aim=-22, grip=1,
             front=-72, kneeFront=60, footFront=-30, back=33, kneeBack=0, travel=36, drop=-6)
drive = dict(twist=55, lean=30, chest=14, head=-22, arm=-100, elbow=0, leftArm=80, aim=-40, grip=1,
             front=-85, kneeFront=80, footFront=-35, back=32, kneeBack=0, travel=44, drop=-10)
carry = dict(twist=25, lean=15, chest=8, head=-12, arm=-55, elbow=-30, leftArm=45, aim=-75, grip=1,
             front=-35, kneeFront=40, footFront=-10, back=-40, kneeBack=50, travel=22, drop=-6)


def blend(a, b, t):
    held = {**a, **b, 'grip': a.get('grip', 0) * (1 - t) + b.get('grip', 0) * t}
    held.update({k: a.get(k, held[k] if k == 'aim' else 0) * (1 - t) + b.get(k, held[k] if k == 'aim' else 0) * t for k in set(a) | set(b) if k != 'grip'})
    return held


def glide(t, ramp=0.25):
    peak = 1 / (1 - ramp)
    if t < ramp:
        return peak * t * t / (2 * ramp)
    if t < 1 - ramp:
        return peak * (t - ramp / 2)
    return 1 - peak * (1 - t) ** 2 / (2 * ramp)


beats = [(0, READY), (contact - 2, load), (contact - 1, blend(load, strike, 0.15)), (contact, strike), ((contact + last) // 2, lunge), (last, drive)]
SPEAR = Vector(spec["blade"]).length


def recovery(u):
    return blend(drive, carry, u * 2) if u < 0.5 else blend(carry, READY, u * 2 - 1)


def drawn(p):
    pose(p)
    hand = bones[HAND]
    points = [b.head.copy() for b in bones] + [hand.head + (hand.matrix.to_quaternion() @ blade_local) * SPEAR]
    floor = min(bones[JOINTS[foot]].head.z for foot in ('footFront', 'footBack'))
    return [point - Vector((0, 0, floor)) for point in points]


samples = [i / 200 for i in range(201)]
walked = [0.0]
previous_points = drawn(recovery(0))
for u in samples[1:]:
    points = drawn(recovery(u))
    walked.append(walked[-1] + sum((a - b).length for a, b in zip(points, previous_points)))
    previous_points = points


def along(s):
    goal = s * walked[-1]
    for i in range(1, len(walked)):
        if walked[i] >= goal:
            return samples[i - 1] + (samples[i] - samples[i - 1]) * (goal - walked[i - 1]) / max(walked[i] - walked[i - 1], 1e-9)
    return 1.0


def at(frame):
    if frame > last:
        return recovery(along(glide((frame - last) / (frames - last))))
    for (a, pa), (b, pb) in zip(beats, beats[1:]):
        if a <= frame <= b:
            t = (frame - a) / (b - a)
            return blend(pa, pb, t * t if a == 0 else t)
    return READY


out = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
previous = {}
for frame in range(frames + 1):
    pose(at(frame))
    for name, entry in zip(created, out['nodes']):
        q = bones[name].rotation_quaternion.normalized()
        if name in previous and previous[name].dot(q) < 0:
            q.negate()
        previous[name] = q
        entry['rotation'].append([q.x, q.y, q.z, q.w])
        entry['translation'].append(list(bones[name].location))
open(keys_path, 'w').write(json.dumps(out))
print('MURLOC_DASH_ATTACK_KEYS', keys_path, frames + 1, 'frames', flush=True)
