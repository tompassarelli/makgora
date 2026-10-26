"""Blender boundary: author Malfurion's dash attack (#342), a staff lunge driven through Melee's 12 active frames.

The rig comes from `malfurion-clips.ts SHIPPED OUT dashAttack --rig RIG.json`: every node becomes a bone
with identity rest orientation, so a bone's local rotation and location are the model's own keys. He checks
his run and rears back about 30 degrees on bent knees with the staff drawn up behind his shoulder, held from
frame 2 to the coil, lunges the staff out on the first active frame, pitches about 45 degrees into a flat pounce
mid-window (docs/dash-attacks.md), then glides evenly from the pounce back to ready. Clip frame N is attack frame N; `malfurion-clips.ts --keys`
splices the baked frames and sets each one on the floor.

  blender --background --factory-startup --python tools/animations/malfurion-dash-attack.py -- RIG.json KEYS.json
"""
import json
import sys
from math import radians

import bpy
from mathutils import Quaternion, Vector

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
spec = json.loads(open(rig_path).read())
frames, contact, active = spec['frames'], spec['contact'], spec['active']
last = contact + active - 1

bpy.ops.wm.read_factory_settings(use_empty=True)
armature = bpy.data.armatures.new('Malfurion')
rig = bpy.data.objects.new('Malfurion', armature)
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
scene = bpy.context.scene
scene.render.fps = 60

PITCH = (0, 1, 0)
JOINTS = {
    'lean': 'Bone_RootArchDruid', 'waist': 'Bone_PelvisArchDruid', 'chest': 'Bone_ChestArchDruid', 'head': 'Bone_Head',
    'arm': 'Bone_Arm1_RArchDruid', 'wrist': 'Bone_Arm2_RArchDruid', 'hand': 'Bone_Hand_RArchDruid',
    'leftArm': 'Bone_Arm1_LArchDruid', 'leftElbow': 'Bone_Arm2_LArchDruid',
    'front': 'Bone_Leg1_LArchDruid', 'kneeFront': 'Bone_Leg2_LArchDruid', 'back': 'Bone_Leg1_RArchDruid', 'kneeBack': 'Bone_Leg2_RArchDruid',
}


def pose(p):
    for b in bones:
        n = nodes[b.name]
        b.rotation_mode = 'QUATERNION'
        x, y, z, w = n['rotation'] or (0, 0, 0, 1)
        b.rotation_quaternion = Quaternion((w, x, y, z))
        b.location = Vector(n['translation'] or (0, 0, 0))
    for joint, degrees in p.items():
        if joint in JOINTS:
            b = bones[JOINTS[joint]]
            b.rotation_quaternion = Quaternion(Vector(PITCH), radians(degrees)) @ b.rotation_quaternion
    root = bones[JOINTS['lean']]
    root.location += Vector((p.get('travel', 0), 0, p.get('drop', 0)))
    bpy.context.view_layer.update()


READY = {}
coil = dict(chest=-20, waist=12, lean=-32, head=20, arm=20, wrist=20, hand=120, leftArm=-30, leftElbow=-10,
            front=-30, kneeFront=55, back=-20, kneeBack=95, travel=-60, drop=-22)
strike = dict(chest=26, waist=-18, lean=4, head=20, arm=-55, wrist=25, hand=80, leftArm=-55, leftElbow=-15,
              front=-35, kneeFront=40, back=30, kneeBack=15, travel=45)
drive = dict(chest=40, waist=-20, lean=45, head=-10, arm=-110, wrist=20, hand=80, leftArm=-100, leftElbow=-25,
             front=-70, kneeFront=95, back=20, kneeBack=10, travel=75, drop=-22)


def blend(a, b, t):
    return {k: a.get(k, 0) * (1 - t) + b.get(k, 0) * t for k in set(a) | set(b)}


def glide(t, ramp=0.15):
    peak = 1 / (1 - ramp)
    if t < ramp:
        return peak * t * t / (2 * ramp)
    if t < 1 - ramp:
        return peak * (t - ramp / 2)
    return 1 - peak * (1 - t) ** 2 / (2 * ramp)


keys = {
    0: READY,
    contact - 5: blend(READY, coil, 0.8),
    contact - 2: coil,
    contact: strike,
    (contact + last) // 2: drive,
}
settle = (contact + last) // 2
keys.update({frame: blend(drive, READY, glide((frame - settle) / (frames - settle))) for frame in range(settle + 1, frames + 1)})

posed = {}
for frame in sorted(keys):
    pose(keys[frame])
    posed[frame] = {b.name: (b.rotation_quaternion.copy(), b.location.copy()) for b in bones}
rig.animation_data_create()
rig.animation_data.action = bpy.data.actions.new('Malfurion dashAttack')
previous = {}
for frame in sorted(posed):
    for b in bones:
        q, location = posed[frame][b.name]
        if b.name in previous and previous[b.name].dot(q) < 0:
            q.negate()
        previous[b.name] = q
        b.rotation_quaternion = q
        b.location = location
        b.keyframe_insert('rotation_quaternion', frame=frame)
        b.keyframe_insert('location', frame=frame)
out = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
for frame in range(frames + 1):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    for name, entry in zip(created, out['nodes']):
        b = bones[name]
        q = b.rotation_quaternion.normalized()
        entry['rotation'].append([q.x, q.y, q.z, q.w])
        entry['translation'].append(list(b.location))
open(keys_path, 'w').write(json.dumps(out))
print('MALFURION_DASH_ATTACK_KEYS', keys_path, frames + 1, 'frames', flush=True)
