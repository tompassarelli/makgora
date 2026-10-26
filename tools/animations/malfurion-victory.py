"""Blender boundary: author Malfurion's victory cheer (#545) with the staff arm low and the cloak unstretched.

His cloak is skinned to the chest and both upper arms, so any upper arm lifted far from the body pulls it into a
wedge (#514). The cheer therefore moves the whole body instead: he crouches with the staff upright in his right hand
and his free fist at his hip, then hops up leaning back with the staff hand lifted no higher than his shoulder, three
times, with both upper arms kept near his sides. The staff hangs from Bone_Hand_R; the Weapon Ref on the left hand
holds nothing.
The rig comes from `malfurion-victory.ts PRIVATE_ASSETS PRIVATE_OUTPUT --rig RIG.json`: every node becomes a bone with
identity rest orientation, so a bone's local rotation and location are the model's own keys. Each joint turn is
(pitch, yaw, roll) in degrees, composed as roll, then yaw, then pitch on top of the stand pose, as `rotated()` in
original-clips.ts does; `lift` is his hop above the floor. `malfurion-victory.ts ... --keys KEYS.json` splices the
baked frames, sets each one on the floor and adds the hop.

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
    'root': 'Bone_RootArchDruid', 'pelvis': 'Bone_PelvisArchDruid', 'chest': 'Bone_ChestArchDruid', 'head': 'Bone_Head',
    'staffArm': 'Bone_Arm1_RArchDruid', 'staffElbow': 'Bone_Arm2_RArchDruid', 'freeArm': 'Bone_Arm1_LArchDruid', 'freeElbow': 'Bone_Arm2_LArchDruid',
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
UP = dict(root=(-10, 0, 0), chest=(-12, 0, 0), head=(-15, 0, 0), freeElbow=(-12, 0, 0), staffArm=(15, -20, -35), staffElbow=(-20, -30, 0),
          hipL=(8, 0, 0), kneeL=(-5, 0, 0), hipR=(8, 0, 0), kneeR=(-5, 0, 0), lift=(16, 0, 0))
DOWN = dict(root=(12, 0, 0), chest=(12, 0, 0), head=(10, 0, 0), freeElbow=(10, 0, 0),
            hipL=(-35, 0, 0), kneeL=(60, 0, 0), hipR=(-35, 0, 0), kneeR=(60, 0, 0))


def blend(a, b, t):
    return {k: tuple(x * (1 - t) + y * t for x, y in zip(a.get(k, (0, 0, 0)), b.get(k, (0, 0, 0)))) for k in set(a) | set(b)}


keys = {0: READY, 15: UP, 30: DOWN, 45: UP, 60: DOWN, 75: UP, 90: READY}
order = sorted(keys)
posed, lift = {}, []
for frame in range(frames + 1):
    after = next(k for k in order if k >= frame)
    before = max(k for k in order if k <= frame)
    t = 0 if after == before else (frame - before) / (after - before)
    p = blend(keys[before], keys[after], (1 - cos(pi * t)) / 2)
    pose(p)
    lift.append(p.get('lift', (0, 0, 0))[0])
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
out = {'frames': frames, 'lift': lift, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
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
