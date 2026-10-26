"""Blender boundary: author Malfurion's victory cheer (#545) with the staff arm low and the cloak unstretched.

His cloak is skinned to the chest and both upper arms, so any upper arm lifted far from the body pulls it into a
wedge (#514). The cheer therefore keeps both upper arms near his sides: the staff hand stays at his hip and stamps
the staff, while the free fist pumps from the elbow out beside his shoulder, the chest swells and the knees bounce.
The rig comes from `malfurion-victory.ts PRIVATE_ASSETS PRIVATE_OUTPUT --rig RIG.json`: every node becomes a bone with
identity rest orientation, so a bone's local rotation and location are the model's own keys. Each joint turn is
(pitch, yaw, roll) in degrees, composed as roll, then yaw, then pitch on top of the stand pose, as `rotated()` in
original-clips.ts does. `malfurion-victory.ts ... --keys KEYS.json` splices the baked frames and sets each one on the floor.

  blender --background --factory-startup --python tools/animations/malfurion-victory.py -- RIG.json KEYS.json
"""
import json
import sys
from math import cos, pi, radians

import bpy
from mathutils import Quaternion, Vector

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
spec = json.loads(open(rig_path).read())
frames = spec['frames']

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

JOINTS = {
    'pelvis': 'Bone_PelvisArchDruid', 'chest': 'Bone_ChestArchDruid', 'head': 'Bone_Head',
    'staffArm': 'Bone_Arm1_LArchDruid', 'staffElbow': 'Bone_Arm2_LArchDruid',
    'fistArm': 'Bone_Arm1_RArchDruid', 'fistElbow': 'Bone_Arm2_RArchDruid', 'fist': 'Bone_Hand_RArchDruid',
    'hipL': 'Bone_Leg1_LArchDruid', 'kneeL': 'Bone_Leg2_LArchDruid', 'hipR': 'Bone_Leg1_RArchDruid', 'kneeR': 'Bone_Leg2_RArchDruid',
}


def turn(pitch=0, yaw=0, roll=0):
    return Quaternion((1, 0, 0), radians(roll)) @ Quaternion((0, 0, 1), radians(yaw)) @ Quaternion((0, 1, 0), radians(pitch))


def pose(p):
    for b in bones:
        n = nodes[b.name]
        b.rotation_mode = 'QUATERNION'
        x, y, z, w = n['rotation'] or (0, 0, 0, 1)
        b.rotation_quaternion = Quaternion((w, x, y, z))
        b.location = Vector(n['translation'] or (0, 0, 0))
    for joint, angles in p.items():
        if joint in JOINTS:
            b = bones[JOINTS[joint]]
            b.rotation_quaternion = turn(*angles) @ b.rotation_quaternion
    bpy.context.view_layer.update()


READY = {}
GATHER = dict(chest=(10, 0, 0), head=(8, 0, 0), staffElbow=(-10, 0, 0), fistArm=(10, 0, 0), fistElbow=(-30, 0, 0),
              hipL=(-18, 0, 0), kneeL=(30, 0, 0), hipR=(-18, 0, 0), kneeR=(30, 0, 0))
CHEER = dict(chest=(-10, 0, 0), head=(-10, 0, 0), staffElbow=(6, 0, 0), fistArm=(15, -20, -35), fistElbow=(-20, -30, 0))
EASE = dict(chest=(-3, 0, 0), head=(-4, 0, 0), fistArm=(8, -10, -18), fistElbow=(-30, -15, 0),
            hipL=(-8, 0, 0), kneeL=(14, 0, 0), hipR=(-8, 0, 0), kneeR=(14, 0, 0))


def blend(a, b, t):
    return {k: tuple(x * (1 - t) + y * t for x, y in zip(a.get(k, (0, 0, 0)), b.get(k, (0, 0, 0)))) for k in set(a) | set(b)}


keys = {0: READY, 10: GATHER, 22: CHEER, 34: EASE, 46: CHEER, 58: EASE, 70: CHEER, 90: READY}
order = sorted(keys)
posed = {}
for frame in range(frames + 1):
    after = next(k for k in order if k >= frame)
    before = max(k for k in order if k <= frame)
    t = 0 if after == before else (frame - before) / (after - before)
    pose(blend(keys[before], keys[after], (1 - cos(pi * t)) / 2))
    posed[frame] = {b.name: (b.rotation_quaternion.copy(), b.location.copy()) for b in bones}
rig.animation_data_create()
rig.animation_data.action = bpy.data.actions.new('Malfurion victory')
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
print('MALFURION_VICTORY_KEYS', keys_path, frames + 1, 'frames', flush=True)

