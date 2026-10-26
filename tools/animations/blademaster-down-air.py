"""Blender boundary: author Blademaster's down air (#256), one downward swipe per airborne hit.

The rig comes from `blademaster-clips.ts --rig`: every node becomes a bone with
identity rest orientation, so a bone's local rotation and location are the
model's own keys. The blade swings like a pendulum under him: each hit cuts down
from the side the last one finished on, the chest crunching and twisting into
the cut while the hips counter-twist, then the overhead plunge, the landing
squash and an eased return to guard. Clip frame N is attack frame N.

  blender --background --factory-startup --python tools/animations/blademaster-down-air.py -- RIG.json KEYS.json
"""
import json
import sys
from math import cos, radians, sin

import bpy
from mathutils import Matrix, Quaternion, Vector

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
spec = json.loads(open(rig_path).read())
frames = spec['frames']

bpy.ops.wm.read_factory_settings(use_empty=True)
armature = bpy.data.armatures.new('Blademaster')
rig = bpy.data.objects.new('Blademaster', armature)
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


def update():
    bpy.context.view_layer.update()


def rest():
    for b in bones:
        n = nodes[b.name]
        b.rotation_mode = 'QUATERNION'
        x, y, z, w = n['rotation'] or (0, 0, 0, 1)
        b.rotation_quaternion = Quaternion((w, x, y, z))
        b.location = Vector(n['translation'] or (0, 0, 0))
        b.scale = Vector(n['scaling'] or (1, 1, 1))
    update()


def turn(name, axis, degrees):
    b = bones[name]
    b.rotation_quaternion = Quaternion(Vector(axis), radians(degrees)) @ b.rotation_quaternion


def aim(name, endpoint, target):
    b = bones[name]
    pivot = b.matrix.translation.copy()
    q = (endpoint - pivot).rotation_difference(target - pivot)
    b.matrix = Matrix.Translation(pivot) @ q.to_matrix().to_4x4() @ Matrix.Translation(-pivot) @ b.matrix
    update()


def head(name):
    return bones[name].head.copy()


def side(degrees, length=1.0):
    return Vector((cos(radians(degrees)), 0, sin(radians(degrees)))) * length


ARM = ('Bone_Arm1_R', 'Bone_Arm2_R', 'Bone_Hand_R')
REACH = (head(ARM[1]) - head(ARM[0])).length + (head(ARM[2]) - head(ARM[1])).length if False else None


def pose(p):
    rest()
    y = (0, 1, 0)
    turn('Bone_Root', y, p.get('pitch', 0))
    bones['Bone_Root'].location.z += p.get('drop', 0)
    turn('Bone_Chest', y, p.get('chest', 0))
    turn('Bone_Chest', (0, 0, 1), p.get('twist', 0))
    turn('Bone_Pelvis', y, p.get('hips', 0))
    turn('Bone_Pelvis', (0, 0, 1), -0.5 * p.get('twist', 0))
    turn('Bone_Head', y, -0.4 * p.get('chest', 0))
    for s in 'LR':
        hip, knee = p.get('leg' + s, (0, 0))
        turn(f'Bone_Leg1_{s}', y, -hip)
        turn(f'Bone_Leg2_{s}', y, knee)
        turn(f'Bone_Foot_{s}', y, -0.4 * knee)
    turn('Bone_Arm1_L', y, -p.get('offhand', 20))
    turn('Bone_Arm2_L', y, 0.5 * abs(p.get('offhand', 20)))
    update()
    if 'blade' not in p:
        return
    shoulder, elbow, wrist = (head(n) for n in ARM)
    upper, lower = (elbow - shoulder).length, (wrist - elbow).length
    target = shoulder + side(p['arm'], (upper + lower) * p.get('reach', 0.92))
    target.y = shoulder.y - 6
    for _ in range(6):
        aim(ARM[0], head(ARM[2]), target)
        aim(ARM[1], head(ARM[2]), target)
    grip = head('Sword')
    for _ in range(3):
        aim(ARM[2], head('Shimmer'), grip + side(p['blade'], 100))


def cut(frame, depth, lean, front):
    s = 1 if front else -1
    lead, trail = (('legR', 'legL') if front else ('legL', 'legR'))
    first = depth == 0
    windup = dict(pitch=lean - 6, drop=-2 * depth, chest=-14 - 2 * depth, twist=-18 * s, hips=-6, blade=70 if front else 150, arm=60 if front else 140,
                  reach=.9, offhand=50 * s, **{lead: (85, 120), trail: (65, 105)})
    contact = dict(pitch=lean, drop=-34 if first else -2 * depth, chest=26 + 3 * depth, twist=22 * s, hips=14 + 3 * depth, blade=-90,
                   arm=-70 if front else -110, reach=1 if first else .86, offhand=-45 * s, **{lead: (10, 20), trail: (35, 70 - 4 * depth)})
    carry = dict(contact, chest=contact['chest'] + 6, twist=26 * s, blade=-140 if front else -40, arm=-100 if front else -75, reach=.9)
    return {frame - 1: windup, frame: contact, frame + 1: carry}


GUARD = {}
plunge = dict(pitch=0, drop=-6, chest=26, twist=4, hips=14, blade=-90, arm=-88, reach=.85, offhand=-70, legL=(8, 14), legR=(16, 26))
landing = dict(pitch=4, drop=-10, chest=16, twist=4, hips=10, blade=-120, arm=-100, reach=.8, offhand=-30, legL=(40, 72), legR=(36, 66))
keys = {0: GUARD,
        3: dict(pitch=-4, drop=4, chest=-6, blade=55, arm=25, reach=.85, offhand=25, legL=(30, 55), legR=(20, 40)),
        6: dict(pitch=-6, drop=6, chest=-14, twist=-12, hips=-6, blade=85, arm=70, reach=.9, offhand=40, legL=(45, 80), legR=(30, 55))}
for hit, frame in enumerate((9, 12, 15, 18, 21)):
    keys.update(cut(frame, hit, 4 * hit, hit % 2 == 0))
keys[8] = dict(keys[8], drop=6, chest=-18, blade=80, arm=80, reach=.97)
keys[10] = dict(keys[10], drop=-68, chest=keys[10]['chest'] + 8, blade=-112, arm=-92, reach=1)
keys[23] = dict(pitch=0, drop=-2, chest=-14, twist=-6, hips=-8, blade=95, arm=95, reach=.98, offhand=35, legL=(90, 125), legR=(75, 115))
keys[24] = plunge
keys[28] = dict(plunge, chest=30, hips=16, arm=-90)
keys[31] = landing
keys[33] = dict(landing, drop=-9, chest=13, blade=-155, arm=-118, offhand=-20)
keys[38] = dict(pitch=1, drop=-4, chest=6, twist=1, hips=3, blade=160, arm=-120, reach=.85, offhand=5, legL=(16, 28), legR=(14, 24))
keys[43] = dict(drop=-1, chest=2, blade=130, arm=-75, reach=.75, offhand=12, legL=(6, 10), legR=(5, 8))
keys[46] = GUARD

posed = {}
for frame in sorted(keys):
    pose(keys[frame])
    posed[frame] = {b.name: (b.rotation_quaternion.copy(), b.location.copy()) for b in bones}
rig.animation_data_create()
rig.animation_data.action = bpy.data.actions.new('Down Air Sword Plunge')
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
    update()
    for name, entry in zip(created, out['nodes']):
        b = bones[name]
        q = b.rotation_quaternion.normalized()
        entry['rotation'].append([q.x, q.y, q.z, q.w])
        entry['translation'].append(list(b.location))
open(keys_path, 'w').write(json.dumps(out))
print('BLADEMASTER_DOWN_AIR_KEYS', keys_path, frames + 1, 'frames', flush=True)
