"""Blender boundary: author a humanoid's down tilt as a low leg sweep (#517), Fox's and Falco's floor sweep on two legs.

The rig comes from `rekey-clip.ts PRIVATE_ASSETS OUT --character ID --pose downTilt --limb R --rig RIG.json`: every
node becomes a bone with identity rest orientation, so a bone's local rotation and location are the model's own keys,
and the canonical joint map names the pelvis, chest, legs and arms. From ready the body drops and coils, the support
foot stays planted where it stood, and the sweeping foot is solved onto a floor arc: drawn back behind the hip, swung
out in front along the floor to full reach on the active frames with the hips and chest turning with it, carried on
across, folded back into the crouch and risen to ready. Clip frame N is attack frame N;
`rekey-clip.ts ... --keys KEYS.json` splices the baked frames into the shipped clip in place.

`--stomp` bakes a down air from a `--pose downAir` rig instead, Falco's tilted, twirling stomp (#512): one compact
spindle, legs straight and together with the toes pointed and both arms raised close over the head so a held weapon
trails above, leaned back 30 degrees about the pelvis so the feet lead down and forward, and turned once about that
long axis through the strike; it holds through the active frames, then unwinds to the aerial ready pose.

  blender --background --factory-startup --python tools/animations/leg-sweep.py -- RIG.json KEYS.json FIGHTER [--stomp]
"""
import json
import sys
from math import radians, sqrt

import bpy
from mathutils import Matrix, Quaternion, Vector

rig_path, keys_path, fighter = sys.argv[sys.argv.index('--') + 1:][:3]
spec = json.loads(open(rig_path).read())
frames, contact, last = spec['frames'], spec['contact'], spec['contact'] + spec['active'] - 1
joints, kick = spec['joints'], spec['limb']
plant = 'L' if kick == 'R' else 'R'

bpy.ops.wm.read_factory_settings(use_empty=True)
armature = bpy.data.armatures.new('Sweep')
rig = bpy.data.objects.new('Sweep', armature)
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
PITCH, YAW = Vector((0, 1, 0)), Vector((0, 0, 1))


def update():
    bpy.context.view_layer.update()


def rest():
    for b in bones:
        n = nodes[b.name]
        b.rotation_mode = 'QUATERNION'
        x, y, z, w = n['rotation'] or (0, 0, 0, 1)
        b.rotation_quaternion = Quaternion((w, x, y, z))
        b.location = Vector(n['translation'] or (0, 0, 0))
    update()


def joint(name):
    return bones[joints[name]]


def turn(b, rotation, pivot=None):
    head = b.matrix.to_translation() if pivot is None else pivot
    b.matrix = Matrix.Translation(head) @ rotation.to_matrix().to_4x4() @ Matrix.Translation(-head) @ b.matrix
    update()


def aim(b, endpoint, target):
    turn(b, (endpoint - b.head).rotation_difference(target - b.head))


def chain(upper, lower, end, target, pole):
    start = upper.head.copy()
    a, b = (lower.head - start).length, (end.head - lower.head).length
    direction = (target - start).normalized()
    distance = min(max((target - start).length, abs(a - b) + .01), a + b - .01)
    across = pole - direction * pole.dot(direction)
    along = (a * a - b * b + distance * distance) / (2 * distance)
    aim(upper, lower.head.copy(), start + direction * along + across.normalized() * sqrt(max(0, a * a - along * along)))
    aim(lower, end.head.copy(), start + direction * distance)


def reach(side, target, pole):
    chain(joint(f'hip.{side}'), joint(f'knee.{side}'), joint(f'ankle.{side}'), target, pole)


def body():
    pelvis, chest = joint('pelvis'), joint('chest')
    ancestors = list(pelvis.parent_recursive)
    return next(b for b in chest.parent_recursive if b in ancestors)


def stomp():
    tilt, turns, lift = 30, 1, 12
    rest()
    gesture, pelvis = joint('root').parent, joint('pelvis').head.copy()
    hips = {s: joint(f'hip.{s}').head.copy() for s in 'LR'}
    shoulders = {s: joint(f'shoulder.{s}').head.copy() for s in 'LR'}
    leg = {s: (joint(f'knee.{s}').head - hips[s]).length + (joint(f'ankle.{s}').head - joint(f'knee.{s}').head).length for s in 'LR'}
    arm = {s: (joint(f'elbow.{s}').head - shoulders[s]).length + (joint(f'wrist.{s}').head - joint(f'elbow.{s}').head).length for s in 'LR'}

    def eased(t):
        c = max(0.0, min(1.0, t))
        return c * c * (3 - 2 * c)

    def spin(frame):
        return 360 * turns * eased((frame - 1) / (last + 3))

    def pose(frame):
        rest()
        w = eased(frame / 3) * (1 - eased((frame - last - 3) / 12))
        joint('root').location += Vector((0, 0, lift * w))
        update()
        for s, sign in (('L', 1), ('R', -1)):
            foot = hips[s] + Vector((0, -sign * (abs(hips[s].y - pelvis.y) - 5), -leg[s]))
            reach(s, joint(f'ankle.{s}').head.lerp(foot, w), Vector((1, 0, 0)))
            turn(joint(f'ankle.{s}'), Quaternion(PITCH, radians(50 * w)))
            hand = shoulders[s] + Vector((-4, sign * 4, arm[s] * 0.96))
            chain(joint(f'shoulder.{s}'), joint(f'elbow.{s}'), joint(f'wrist.{s}'), joint(f'wrist.{s}').head.lerp(hand, w), Vector((-1, sign * 0.3, 0)))
        turn(joint('head'), Quaternion(PITCH, radians(-8 * w)))
        centre = joint('pelvis').head.copy()
        turn(gesture, Quaternion(PITCH, radians(-tilt * w)) @ Quaternion(YAW, radians(spin(frame))))
        joint('root').matrix = Matrix.Translation(centre - joint('pelvis').head) @ joint('root').matrix
        update()

    out = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
    previous = {}
    for frame in range(frames + 1):
        pose(frame)
        for name, entry in zip(created, out['nodes']):
            q = bones[name].rotation_quaternion.normalized()
            if name in previous and previous[name].dot(q) < 0:
                q.negate()
            previous[name] = q
            entry['rotation'].append([q.x, q.y, q.z, q.w])
            entry['translation'].append(list(bones[name].location))
        ankle, wrist = joint('ankle.R').head, joint('wrist.R').head
        print(f'STOMP frame {frame}: spin {spin(frame):.0f} ankle.R ({ankle.x:.1f}, {ankle.z:.1f}) wrist.R ({wrist.x:.1f}, {wrist.z:.1f})', flush=True)
    open(keys_path, 'w').write(json.dumps(out))
    print('STOMP_KEYS', keys_path, frames + 1, 'frames', flush=True)


if '--stomp' in sys.argv:
    stomp()
    sys.exit(0)


rest()
BODY = body()
ANKLE = {side: joint(f'ankle.{side}').head.copy() for side in 'LR'}
HIP = joint(f'hip.{kick}').head.copy()
BODY_REST = BODY.matrix.to_quaternion().inverted()
POLE = {side: (joint(f'knee.{side}').head - (joint(f'hip.{side}').head + ANKLE[side]) / 2).normalized() for side in 'LR'}
LEG = (joint(f'knee.{kick}').head - HIP).length + (ANKLE[kick] - joint(f'knee.{kick}').head).length
FLOOR = min(a.z for a in ANKLE.values())
SIDE = 1 if kick == 'L' else -1
TURN = -SIDE


def pose(p, lifts=None):
    rest()
    pivot = joint('pelvis').head.copy()
    BODY.location += Vector((p.get('travel', 0), 0, p.get('drop', 0)))
    update()
    pivot += Vector((p.get('travel', 0), 0, p.get('drop', 0)))
    turn(BODY, Quaternion(YAW, radians(p.get('twist', 0) * TURN)) @ Quaternion(PITCH, radians(p.get('lean', 0))), pivot)
    turn(joint('chest'), Quaternion(YAW, radians(p.get('chestTwist', 0) * TURN)) @ Quaternion(PITCH, radians(p.get('chest', 0))))
    turn(joint('head'), Quaternion(PITCH, radians(p.get('head', 0))))
    planted = ANKLE[plant] + Vector((p.get('plantX', 0), 0, p.get('plantZ', 0)))
    reach(plant, planted, BODY.matrix.to_quaternion() @ BODY_REST @ POLE[plant] + Vector((p.get('plantKnee', 0), 0, 0)))
    fx, fy, fz = p.get('foot', (ANKLE[kick].x, 0, ANKLE[kick].z - FLOOR))
    reach(kick, Vector((fx, ANKLE[kick].y + fy * SIDE, FLOOR + fz)), BODY.matrix.to_quaternion() @ BODY_REST @ POLE[kick] + Vector((0, 0, p.get('knee', 0))))
    turn(joint(f'ankle.{kick}'), Quaternion(PITCH, radians(p.get('toe', 0))))
    for side, key in ((kick, 'kickArm'), (plant, 'plantArm')):
        turn(joint(f'shoulder.{side}'), Quaternion(PITCH, radians(p.get(key, 0))))
        turn(joint(f'elbow.{side}'), Quaternion(PITCH, radians(p.get(key + 'Elbow', 0))))
    found = {}
    for node, chain in OWN.get('clear', []):
        for turned in chain:
            key = f'{node}/{turned}'
            if lifts is not None:
                turn(bones[turned], Quaternion(PITCH, radians(lifts.get(key, 0))))
                continue
            cleared, found[key] = lift(bones[node], bones[turned], -p.get('drop', 0))
            if cleared:
                break
    return found


def lowest(b):
    head = Vector(nodes[b.name]['pivot'])
    own = [(b.matrix @ (Vector(p) - head)).z for p in POINTS.get(b.name, [])]
    return min(own + [lowest(c) for c in b.children], default=b.head.z)


def lift(node, turned, drop):
    start, floor = turned.matrix.copy(), REST_LOW[node.name] + MARGIN * min(1, drop / MARGIN_DROP)
    tried = []
    sides = [SIDES[node.name]] if node.name in SIDES else [1, -1]
    for degrees in sorted((side * step for side in sides for step in range(91)), key=abs):
        turned.matrix = start
        update()
        turn(turned, Quaternion(PITCH, radians(degrees)))
        if lowest(node) >= floor:
            if degrees:
                SIDES.setdefault(node.name, 1 if degrees > 0 else -1)
            return True, degrees
        tried.append((lowest(node), degrees))
    turned.matrix = start
    update()
    best = max(tried)[1]
    turn(turned, Quaternion(PITCH, radians(best)))
    return False, best


def smoothed(searched):
    keys = {key for found in searched for key in found}
    held = [frame == 0 or frame >= frames - 1 for frame in range(len(searched))]
    def window(frame, values):
        return [values[g] for g in range(max(0, frame - 2), min(len(values), frame + 3))]
    def taper(frame):
        return min(1, (frames - 1 - frame) / SETTLE)
    out = [dict(found) for found in searched]
    for key in keys:
        raw = [found.get(key, 0) for found in searched]
        for f in range(len(raw)):
            out[f][key] = raw[f] if held[f] else taper(f) * sum(window(f, raw)) / len(window(f, raw))
    return out


READY = {}
OWN = json.loads(open(__file__.replace('leg-sweep.py', f'leg-sweeps/{fighter}.json')).read())
BEATS = OWN['beats']
MARGIN = OWN.get('margin', 0)
MARGIN_DROP = 10
SETTLE = 3
SIDES = dict(OWN.get('sides', {}))
POINTS = spec['points']
rest()
REST_LOW = {node: lowest(bones[node]) for node, _ in OWN.get('clear', [])}

def blend(a, b, t):
    out = {}
    for k in set(a) | set(b):
        va, vb = a.get(k), b.get(k)
        if isinstance(va or vb, list):
            va = va or [ANKLE[kick].x, 0, 0]
            vb = vb or [ANKLE[kick].x, 0, 0]
            out[k] = [x * (1 - t) + y * t for x, y in zip(va, vb)]
        else:
            out[k] = (va or 0) * (1 - t) + (vb or 0) * t
    return out


def ease(t):
    return t * t * (3 - 2 * t)


def keyframes():
    marks = {'contact': contact, 'last': last, 'end': frames - 1}
    return [(marks.get(at, at) if isinstance(at, str) else (at if at >= 0 else frames + at), p, shape) for at, p, *shape in BEATS]


def at(frame):
    beats = keyframes()
    for (a, pa, _), (b, pb, shape) in zip(beats, beats[1:]):
        if a <= frame <= b:
            t = (frame - a) / max(1, b - a)
            return blend(pa, pb, t if shape == ['linear'] else ease(t))
    return beats[-1][1]


out = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
previous = {}
LIFTS = smoothed([pose(at(frame)) for frame in range(frames + 1)])
for frame in range(frames + 1):
    pose(at(frame), LIFTS[frame])
    for name, entry in zip(created, out['nodes']):
        q = bones[name].rotation_quaternion.normalized()
        if name in previous and previous[name].dot(q) < 0:
            q.negate()
        previous[name] = q
        entry['rotation'].append([q.x, q.y, q.z, q.w])
        entry['translation'].append(list(bones[name].location))
    toe = joint(f'ankle.{kick}').head
    hip = joint(f'hip.{kick}').head
    knee = joint(f'knee.{kick}').head
    head = joint('head').head
    print(f'LEG_SWEEP frame {frame}: head ({head.x:.1f}, {head.z - FLOOR:.1f}) {kick} hip ({hip.x:.1f}, {hip.z - FLOOR:.1f}) knee ({knee.x:.1f}, {knee.z - FLOOR:.1f}) ankle ({toe.x:.1f}, {toe.y:.1f}, {toe.z - FLOOR:.1f}) planted ankle z {joint(f"ankle.{plant}").head.z - FLOOR:.1f}', flush=True)
open(keys_path, 'w').write(json.dumps(out))
print('LEG_SWEEP_KEYS', keys_path, frames + 1, 'frames; leg', round(LEG, 1), flush=True)
